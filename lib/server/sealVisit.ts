import 'server-only';
/**
 * THE IMMUTABLE VISIT PIPELINE.
 *
 * Source: docs/VISIT-OBJECT.md · docs/AUTOMODZ-OS.md §14.5, §16.2, §16.3, §22.6, §22.7
 *
 * When a job completes, ONE transaction writes a sealed Visit and the
 * Protections it creates. Everything the customer was promised is snapshotted
 * into that document at that moment: the services, the pricing, and the warranty
 * terms as the catalogue read them right then.
 *
 * §14.5 — "Changing a price list must never change what a past customer was
 * promised." Until this existed, nothing wrote a visit at all, so every warranty
 * a customer saw was recomputed live from a mutable catalogue: editing a service's
 * warranty string silently rewrote history. That is the bug the anchor was
 * designed to prevent and it was still live.
 *
 * ── THE FOUR GUARANTEES ──────────────────────────────────────────────────
 * IDEMPOTENT     the visit id is derived from the job id, and the transaction
 *                re-reads it before writing. Sealing twice is a no-op, so a
 *                retry, a double-tap and a backfill are all safe.
 * ATOMIC         the visit and every protection commit together, or not at all.
 *                §22.6 — nothing is half-written.
 * PERMANENT      once `sealedAt` is set the transaction refuses to touch it, and
 *                the rules refuse too (§16.2).
 * SERVER-ONLY    Admin SDK, so a closed browser tab cannot leave a promise
 *                half-recorded. §22.8 — the studio's plumbing stays server-side.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { captureTerms, protectionsFromVisit } from '@/lib/os/protection';
import { actFromJobStatus } from '@/lib/os/visit';
import { DEFAULT_LOCATION_ID } from '@/lib/services/visits';
import type {
  Booking, CapturedTerm, Job, Service, Visit, VisitService, VisitStage, VisitStageName,
} from '@/lib/types';

/**
 * The visit's identity IS the job's. That is what makes the whole pipeline
 * idempotent without a lock, a queue or a dedupe table: two concurrent seals
 * address the same document, and the transaction serialises them.
 */
export const visitIdForJob = (jobId: string) => `visit_${jobId}`;

/** A protection is one per car per kind, so a re-coat replaces its ancestor. */
export const protectionIdFor = (vehicleId: string, kind: string) => `${vehicleId}_${kind}`;

export type SealOutcome =
  | { status: 'sealed'; visitId: string; protections: number }
  | { status: 'already-sealed'; visitId: string }
  | { status: 'not-complete'; jobId: string }
  | { status: 'not-found'; jobId: string }
  /**
   * A walk-in whose car is not in anyone's garage. `Job` carries a PLATE, not a
   * vehicle id — only a booking carries the id — so such a job has no vehicle
   * document to anchor a visit to, and no customer surface on which it could
   * ever appear. Skipping is correct; it is reported so a backfill's numbers
   * stay honest rather than silently short.
   */
  | { status: 'no-vehicle'; jobId: string };

/** The customer's act, from the studio's own status history. §5.5, §21.8 */
const STAGE_OF: Record<string, VisitStageName> = {
  received: 'received',
  in_care: 'deep_clean',
  final_checks: 'final_inspection',
  ready: 'ready',
};

function stagesFromJob(job: Job): VisitStage[] {
  const out: VisitStage[] = [];
  for (const h of job.statusHistory ?? []) {
    const act = actFromJobStatus(h.status);
    const stage = act ? STAGE_OF[act] : undefined;
    if (!stage) continue;
    /* Firestore rejects `undefined`, and an optional field left off a
       statusHistory entry arrives as exactly that. Omitting the key is also the
       honest encoding: a stage with no note has no note, rather than a note
       whose value is nothing. `ignoreUndefinedProperties` would hide this class
       of bug globally instead of fixing it where it is written. */
    out.push({
      stage,
      at: h.at,
      ...(h.note ? { note: h.note } : {}),
      media: (job.photos ?? [])
        .filter(p => (p.kind === 'before' && stage === 'received')
          || (p.kind === 'after' && stage === 'ready')
          || (p.kind === 'during' && stage === 'deep_clean'))
        .map(p => ({ url: p.url, kind: 'photo' as const })),
      /* Recorded for the studio, NEVER rendered customer-side (§2.2). */
      ...(h.byEmployeeId ? { byEmployeeId: h.byEmployeeId } : {}),
    });
  }
  if (out.length === 0) {
    out.push({ stage: 'ready', at: job.completedAt ?? job.updatedAt ?? Timestamp.now(), media: [] });
  }
  return out;
}

/**
 * Seal the visit for one completed job.
 *
 * Reads happen first and writes last, all inside `runTransaction`, so a
 * concurrent seal of the same job either sees the sealed document and stops, or
 * is retried by Firestore against fresh data.
 */
export async function sealVisitForJob(jobId: string): Promise<SealOutcome> {
  if (!adminDb) throw new Error('Firebase Admin is not configured.');
  const db = adminDb;

  /* The catalogue is read OUTSIDE the transaction on purpose: it is the only
     input that is not part of the atomic unit, and reading it inside would put
     every service document into the transaction's conflict set. Its values are
     copied into the visit, so a later catalogue edit cannot reach back. */
  const catalogue: Service[] = (await db.collection('services').get())
    .docs.map(d => ({ id: d.id, ...d.data() } as Service));

  return db.runTransaction(async t => {
    const jobRef = db.doc(`jobs/${jobId}`);
    const jobSnap = await t.get(jobRef);
    if (!jobSnap.exists) return { status: 'not-found', jobId } as const;

    const job = { id: jobSnap.id, ...jobSnap.data() } as Job;
    if (job.status !== 'completed') return { status: 'not-complete', jobId } as const;

    const visitId = visitIdForJob(jobId);
    const visitRef = db.doc(`visits/${visitId}`);
    const existing = await t.get(visitRef);
    if (existing.exists && (existing.data() as Visit).sealedAt) {
      /* §16.2 — permanent. Not an error: a retry, a re-run of the backfill and a
         double status write all land here, which is what idempotent means. */
      return { status: 'already-sealed', visitId } as const;
    }

    const booking: Booking | null = job.bookingId
      ? ((await t.get(db.doc(`bookings/${job.bookingId}`))).data() as Booking ?? null)
      : null;

    /* ── SNAPSHOT: services ──────────────────────────────────────────── */
    const services: VisitService[] = (job.serviceItems ?? []).map(i => ({
      serviceId: i.serviceId,
      name: i.serviceName,
      category: i.category,
      price: i.price ?? 0,
    }));

    /* ── SNAPSHOT: pricing. The job's own numbers, not the catalogue's. ──
       THE DISCOUNT IS CARRIED, NOT DERIVED. This read
       `discount: Math.max(0, subtotal - total)`, which is only ever right when
       nothing but a discount separates the two. With a discount AND a fee it
       understates: services 1200, discount 200, fees 100 gives total 1100, and
       the subtraction reports 100 — half of what the customer was actually
       given, written permanently into a sealed record.

       The booking already stores what was decided at the counter, so the
       figure is read rather than reconstructed. A booking with no discount
       records none, which is the honest encoding of "nothing was given". */
    const subtotal = services.reduce((n, s) => n + (s.price ?? 0), 0);
    const total = job.totalAmount ?? booking?.totalAmount ?? subtotal;
    const discountAmount = booking?.discount?.amount ?? 0;
    const amounts = { subtotal, discount: discountAmount, total };

    /* ── SNAPSHOT: warranty, as the catalogue reads it AT THIS MOMENT ──
       `source: 'captured'` is the whole point — this is what was sold, frozen. */
    /**
     * WHEN THE WORK WAS DONE — and `updatedAt` is not that date.
     *
     * This read `completedAt ?? updatedAt ?? now`. `updatedAt` moves whenever
     * ANY field on the job is touched — a note corrected a fortnight later, a
     * photo added, a backfill — so using it as the application date silently
     * dates a warranty from an edit. A protection's whole life is measured
     * from this day; it must be a fact about the CAR, never about the record.
     *
     * So: the completion, then the day the work was booked for, and nothing
     * else. A job with neither is not datable and captures no term rather than
     * inheriting today's date, which would hand the customer a warranty that
     * starts whenever the seal happened to run.
     */
    const appliedOn = job.completedAt
      ? job.completedAt.toDate().toISOString().slice(0, 10)
      : booking?.scheduledDate ?? null;

    const termsCaptured: CapturedTerm[] = (appliedOn ? captureTerms({
      work: services.map(s => ({
        serviceName: s.name,
        /* The key first — see `resolveService`. A display name is not identity. */
        serviceId: s.serviceId,
        category: s.category,
        appliedOn,
      })),
      catalogue,
      source: 'captured',
    }) : []).map(t2 => Object.fromEntries(
      Object.entries(t2).filter(([, v]) => v !== undefined),
    ) as CapturedTerm);

    /* A visit is keyed by the vehicle, and only a booking carries that id. */
    const vehicleId = booking?.vehicleId;
    if (!vehicleId) return { status: 'no-vehicle', jobId } as const;

    const visit: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'> & {
      customerId?: string;
    } = {
      vehicleId,
      locationId: DEFAULT_LOCATION_ID,
      source: job.bookingId ? 'requested' : 'walk_in',
      authoredBy: 'studio',
      ...(booking ? { requestedFor: { date: booking.scheduledDate, time: booking.scheduledTime } } : {}),
      services,
      /* The day the work happened, frozen with everything else. Taken from the
         SAME value the protections' `since` uses, so a visit and the promise it
         created can never disagree about their day. */
      ...(appliedOn ? { servicedOn: appliedOn } : {}),
      ...(booking?.discount ? { discount: booking.discount } : {}),
      amounts,
      stages: stagesFromJob(job),
      termsCaptured,
      status: 'sealed',
      ...(job.bookingId ? { bookingId: job.bookingId } : {}),
      jobId: job.id,
      /* Denormalised so the read rule and the query can both be owner-scoped
         without an `exists()` lookup per document. */
      ...(job.customerId ? { customerId: job.customerId } : {}),
    };

    t.set(visitRef, {
      ...visit,
      sealedAt: FieldValue.serverTimestamp(),
      createdAt: existing.exists ? (existing.data() as Visit).createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    /* ── PROTECTIONS, in the same commit ─────────────────────────────── */
    /* No datable day, no protection — `termsCaptured` is already empty in that
       case, so this is belt and braces rather than a second rule. */
    const rows = appliedOn
      ? protectionsFromVisit({ ...visit, id: visitId } as Visit, appliedOn)
      : [];
    for (const p of rows) {
      /* Same rule: an absent optional field is omitted, never written as
         `undefined`, which Firestore refuses outright. */
      const clean = Object.fromEntries(
        Object.entries(p).filter(([, v]) => v !== undefined),
      );
      t.set(db.doc(`protections/${protectionIdFor(p.vehicleId, p.kind)}`), {
        ...clean,
        ownerUid: job.customerId ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return { status: 'sealed', visitId, protections: rows.length } as const;
  }, { maxAttempts: 12 });
}

/**
 * Seal every completed job that has no sealed visit yet.
 *
 * §22.7 — intent is idempotent, so this is safe to run repeatedly and safe to
 * run while the studio is working. Existing customers get their history without
 * anyone touching the admin.
 */
export async function backfillSealedVisits(limit = 500): Promise<{
  scanned: number; sealed: number; alreadySealed: number; skipped: number;
}> {
  if (!adminDb) throw new Error('Firebase Admin is not configured.');
  const snap = await adminDb.collection('jobs')
    .where('status', '==', 'completed')
    .limit(limit)
    .get();

  let sealed = 0, alreadySealed = 0, skipped = 0;
  /* Sequential on purpose: a parallel burst of transactions against the same
     protection documents would contend for no gain, and a backfill has no
     deadline. */
  for (const d of snap.docs) {
    const out = await sealVisitForJob(d.id);
    if (out.status === 'sealed') sealed++;
    else if (out.status === 'already-sealed') alreadySealed++;
    else skipped++;
  }
  return { scanned: snap.size, sealed, alreadySealed, skipped };
}

/**
 * REMEDIATE A VISIT SEALED WITH A DEFECT — not a rewrite of history.
 *
 * Two visits sealed on 2026-08-10 captured NO terms, because service
 * resolution matched the catalogue on an exact, case-sensitive display name
 * (`"Glass Coating"` vs `"Glass coating"`). The seal recorded what it computed;
 * what it computed was wrong. The car has a two-year glass coating and the
 * record says it has nothing.
 *
 * §16.2 makes a sealed visit permanent, and this does not weaken that. It
 * re-derives the snapshot the seal was SUPPOSED to take, and it refuses unless
 * it can prove that snapshot would be identical:
 *
 *   1. Only when `termsCaptured` is EMPTY. A visit that captured something has
 *      a real snapshot and is never touched.
 *   2. Only when NO service has been edited since `sealedAt`. This is the §14.5
 *      guarantee, checked rather than assumed: if the catalogue moved after the
 *      seal, re-deriving would apply today's warranty to yesterday's work,
 *      which is precisely the rewrite the anchor exists to prevent. It refuses.
 *   3. `appliedOn` comes from the visit's own dates, never from `now`.
 *
 * Idempotent: once terms exist, rule 1 makes a second run a no-op.
 */
export async function resealVisitTerms(visitId: string): Promise<
  | { status: 'repaired'; visitId: string; terms: number; protections: number }
  | { status: 'has-terms' | 'not-found' | 'no-job' | 'not-datable'; visitId: string }
  | { status: 'catalogue-moved'; visitId: string; movedAt: string }
> {
  if (!adminDb) throw new Error('Firebase Admin is not configured.');
  const db = adminDb;

  const catalogueSnap = await db.collection('services').get();
  const catalogue: Service[] = catalogueSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service));
  /* The newest catalogue edit, for guard 2. */
  const newestEdit = catalogueSnap.docs.reduce<number>((n, d) => {
    const u = d.data().updatedAt;
    return Math.max(n, typeof u?.toMillis === 'function' ? u.toMillis() : 0);
  }, 0);

  return db.runTransaction(async t => {
    const ref = db.doc(`visits/${visitId}`);
    const snap = await t.get(ref);
    if (!snap.exists) return { status: 'not-found', visitId } as const;
    const visit = { id: snap.id, ...snap.data() } as Visit;

    if ((visit.termsCaptured ?? []).length > 0) return { status: 'has-terms', visitId } as const;
    if (!visit.jobId) return { status: 'no-job', visitId } as const;

    const sealedAt = (visit.sealedAt as unknown as Timestamp | undefined)?.toMillis?.() ?? 0;
    if (sealedAt && newestEdit > sealedAt) {
      return {
        status: 'catalogue-moved', visitId,
        movedAt: new Date(newestEdit).toISOString(),
      } as const;
    }

    const jobSnap = await t.get(db.doc(`jobs/${visit.jobId}`));
    if (!jobSnap.exists) return { status: 'no-job', visitId } as const;
    const job = { id: jobSnap.id, ...jobSnap.data() } as Job;

    const appliedOn = job.completedAt
      ? job.completedAt.toDate().toISOString().slice(0, 10)
      : visit.requestedFor?.date ?? null;
    if (!appliedOn) return { status: 'not-datable', visitId } as const;

    const termsCaptured: CapturedTerm[] = captureTerms({
      work: (visit.services ?? []).map(s => ({
        serviceName: s.name, serviceId: s.serviceId, category: s.category, appliedOn,
      })),
      catalogue,
      source: 'captured',
    }).map(term => Object.fromEntries(
      Object.entries(term).filter(([, v]) => v !== undefined),
    ) as CapturedTerm);

    if (termsCaptured.length === 0) {
      /* Resolution still finds nothing. Correct outcome, not a failure: the
         work genuinely carries no promise we can evidence. Nothing written. */
      return { status: 'has-terms', visitId } as const;
    }

    t.update(ref, { termsCaptured, updatedAt: FieldValue.serverTimestamp() });

    const rows = protectionsFromVisit({ ...visit, termsCaptured }, appliedOn);
    for (const p of rows) {
      const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
      t.set(db.doc(`protections/${protectionIdFor(p.vehicleId, p.kind)}`), {
        ...clean,
        ownerUid: job.customerId ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    return { status: 'repaired', visitId, terms: termsCaptured.length, protections: rows.length } as const;
  }, { maxAttempts: 12 });
}
