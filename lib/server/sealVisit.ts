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

    /* ── SNAPSHOT: pricing. The job's own numbers, not the catalogue's. ── */
    const subtotal = services.reduce((n, s) => n + (s.price ?? 0), 0);
    const total = job.totalAmount ?? booking?.totalAmount ?? subtotal;
    const amounts = { subtotal, discount: Math.max(0, subtotal - total), total };

    /* ── SNAPSHOT: warranty, as the catalogue reads it AT THIS MOMENT ──
       `source: 'captured'` is the whole point — this is what was sold, frozen. */
    const appliedOn = (job.completedAt ?? job.updatedAt ?? Timestamp.now())
      .toDate().toISOString().slice(0, 10);
    const termsCaptured: CapturedTerm[] = captureTerms({
      work: services.map(s => ({ serviceName: s.name, category: s.category, appliedOn })),
      catalogue,
      source: 'captured',
    }).map(t2 => Object.fromEntries(
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
    const rows = protectionsFromVisit({ ...visit, id: visitId } as Visit, appliedOn);
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
