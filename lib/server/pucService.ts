import 'server-only';
/**
 * THE POLLUTION-CERTIFICATE SERVICE — the only thing that may turn a customer's
 * paperwork into a promise the product makes.
 *
 * Source: docs/AUTOMODZ-LIVING-STATES.md §2, docs/AUTOMODZ-OS.md §18.4
 *
 * ── THE CONTRACT ─────────────────────────────────────────────────────────
 *   The client expresses a FACT ABOUT ITS OWN PAPER: which car, which
 *   certificate, issued when, valid until when, and a photograph of it.
 *   The server decides whether that fact may be STORED at all.
 *   The studio decides whether it becomes a PROTECTION.
 *
 * Nothing a caller can put in a request body changes what the car is protected
 * by. Ownership is read from the session's own subtree; the vehicle id in the
 * body is only ever used to LOOK UNDER that subtree, never to establish that
 * the car is theirs. `verified` is refused to every non-staff caller before
 * anything else is read.
 *
 * ── AND NOTHING HISTORICAL IS EVER REWRITTEN ─────────────────────────────
 * A renewal writes a NEW declaration and a NEW protection document. The
 * previous declaration is marked `superseded`; its reference, its dates and
 * its photograph are left exactly as they were. No existing protection is
 * touched — not its `since`, not its `term` — which is what makes the record
 * of a car's certification a record rather than a current opinion.
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import {
  validateDeclaration, resolveSubmission, evidenceBelongsTo,
  protectionFromDeclaration, protectionIdFor, PUC,
  type CleanDeclaration, type PucDeclarationInput,
} from '@/lib/os/puc';
import { declarationTransition, type DeclarationState } from '@/lib/os/lifecycle';
import type { Declaration, Vehicle } from '@/lib/types';

/** Machine-readable, and exactly what the route returns. */
export class PucError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

/** The collection. One per paper the owner holds, whatever kind it is. */
const DECLARATIONS = 'declarations';
const PROTECTIONS = 'protections';

const db = () => {
  if (!adminDb) throw new PucError('not-configured', 503);
  return adminDb;
};

/**
 * THE DECLARATION'S OWN ID, DERIVED FROM THE CERTIFICATE.
 *
 * A car cannot hold two different pollution certificates issued on the same day
 * AND expiring on the same day — that is one certificate, described twice. So
 * the id is those three facts, and a double tap therefore lands on the SAME
 * document rather than racing to create two. Firestore locks a document a
 * transaction reads, so the collision is real rather than hoped for.
 *
 * A renewal has different dates and so takes a different id, which is why the
 * history survives: nothing ever writes over the last one.
 */
const declarationId = (c: CleanDeclaration): string =>
  `${c.vehicleId}_puc_${c.issuedOn}_${c.expiresOn}`;

/* ── THE CUSTOMER'S HALF ─────────────────────────────────────────────────── */

export interface DeclareResult {
  declarationId: string;
  status: DeclarationState;
  /** True when this request stored nothing because the same paper was already in. */
  replay: boolean;
}

/**
 * Send a certificate to the studio.
 *
 * `uid` MUST come from a verified session. Everything else arrives from the
 * browser and is treated as such.
 */
export async function declarePuc(
  uid: string,
  input: Partial<PucDeclarationInput> | null,
  now: Date = new Date(),
): Promise<DeclareResult> {
  const checked = validateDeclaration(input, now);
  if (!checked.ok) throw new PucError(checked.reason, 400);
  const clean = checked.value;

  /**
   * OWNERSHIP IS A LOOKUP UNDER THE SESSION, NOT A FIELD COMPARISON.
   *
   * Vehicles live at `users/{uid}/vehicles/{id}`, so asking for the car under
   * THIS uid is the whole check: another customer's vehicle id simply is not
   * there. There is deliberately no collection-group query and no `ownerUid`
   * comparison — those are ways to ask the same question that can be answered
   * `true` by a document somebody else wrote.
   */
  const carRef = db().doc(`users/${uid}/vehicles/${clean.vehicleId}`);
  const carSnap = await carRef.get();
  if (!carSnap.exists) throw new PucError('vehicle-not-yours', 403);
  const car = carSnap.data() as Partial<Vehicle>;

  /* The photograph must have been uploaded for THIS car by THIS customer. The
     media pipeline binds a path to the uid; the declaration binds it to the
     car as well, so a URL lifted from another declaration is refused. */
  if (clean.evidence && !evidenceBelongsTo(clean.evidence.path, uid, clean.vehicleId)) {
    throw new PucError('evidence-invalid', 400);
  }

  const base = declarationId(clean);

  return db().runTransaction(async tx => {
    /* Read the exact document first: this is what makes a double tap a
       collision the database resolves rather than a race the code hopes to
       win. Sequential, because a transaction's reads must all precede its
       writes and the order they are issued in is part of that contract. */
    const held = await tx.get(db().collection(DECLARATIONS).doc(base));
    const siblings = await tx.get(
      db().collection(DECLARATIONS).where('vehicleId', '==', clean.vehicleId),
    );

    const existing: Declaration[] = siblings.docs.map(
      d => ({ ...(d.data() as object), id: d.id }) as Declaration,
    );

    /**
     * THE SAME CERTIFICATE, SENT AGAIN.
     *
     * Still open, or already standing: answer with what is there and write
     * nothing. That is what makes a double tap free.
     *
     * Already CLOSED — withdrawn when a different certificate replaced it, or
     * refused — is a different question, and refusing it would be a dead end:
     * a customer who withdrew the right certificate by correcting it the wrong
     * way could never send it again. Re-sending a closed record is a new act,
     * so it gets a new record and the closed one keeps its own history.
     */
    let id = base;
    if (held.exists) {
      const prior = { ...(held.data() as object), id: base } as Declaration;
      if (prior.status === 'submitted' || prior.status === 'verified') {
        return { declarationId: base, status: prior.status, replay: true };
      }
      id = `${base}_${now.getTime()}`;
    }
    const mineRef = db().collection(DECLARATIONS).doc(id);

    const verdict = resolveSubmission(existing, clean);
    if (verdict.act === 'refuse') throw new PucError(verdict.reason, 409);
    if (verdict.act === 'replay') {
      return { declarationId: verdict.existing.id, status: 'submitted' as const, replay: true };
    }

    /* A DIFFERENT certificate while one is pending replaces it. The withdrawn
       one keeps every fact it was sent with — only its status moves, and only
       through the one table that says it may. */
    if (verdict.act === 'replace') {
      for (const old of verdict.withdraw) {
        const move = declarationTransition(old.status, 'withdrawn', 'customer');
        if (!move.ok) throw new PucError(move.reason ?? 'illegal-transition', 409);
        tx.update(db().collection(DECLARATIONS).doc(old.id), {
          status: 'withdrawn',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    tx.create(mineRef, {
      vehicleId: clean.vehicleId,
      ownerUid: uid,
      kind: PUC,
      reference: clean.reference,
      issuedOn: clean.issuedOn,
      expiresOn: clean.expiresOn,
      ...(clean.evidence ? { evidence: clean.evidence } : {}),
      ...(clean.note ? { note: clean.note } : {}),
      /* Snapshotted, exactly as a Visit snapshots its terms: a plate corrected
         next month must not re-label a decision already made. */
      ...(car.name ? { vehicleName: car.name } : {}),
      ...(car.registrationNumber ? { registrationNumber: car.registrationNumber } : {}),
      status: 'submitted',
      submittedAt: Timestamp.fromDate(now),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { declarationId: id, status: 'submitted' as const, replay: false };
  });
}

/* ── THE STUDIO'S HALF ───────────────────────────────────────────────────── */

export interface DecideResult {
  declarationId: string;
  status: DeclarationState;
  /** Written only on a verification, and only ever a new document. */
  protectionId?: string;
}

/**
 * Is this caller the studio? Read from their own profile, never from the body.
 */
export async function isStudio(uid: string): Promise<boolean> {
  const profile = await db().collection('users').doc(uid).get();
  return ['admin', 'employee'].includes((profile.data()?.role as string) ?? '');
}

/**
 * VERIFY OR REJECT — the studio's decision, and the only door to an
 * authoritative pollution certificate.
 *
 * The vehicle is taken from the DECLARATION and from nowhere else, so there is
 * no request that can verify one customer's certificate against another
 * customer's car: the caller names a declaration, and the declaration names
 * its own car. `actorUid` must already have been proven to be staff.
 */
export async function decidePuc(
  actorUid: string,
  input: { declarationId?: unknown; decision?: unknown; reason?: unknown } | null,
  now: Date = new Date(),
): Promise<DecideResult> {
  const id = typeof input?.declarationId === 'string' ? input.declarationId.trim() : '';
  if (!id) throw new PucError('declaration-required', 400);

  const decision = input?.decision;
  if (decision !== 'verify' && decision !== 'reject') {
    throw new PucError('decision-invalid', 400);
  }
  const reason = typeof input?.reason === 'string' ? input.reason.trim().slice(0, 300) : '';

  if (!await isStudio(actorUid)) throw new PucError('not-yours-to-make', 403);

  return db().runTransaction(async tx => {
    const ref = db().collection(DECLARATIONS).doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new PucError('not-found', 404);
    const held = { ...(snap.data() as object), id } as Declaration;

    const to: DeclarationState = decision === 'verify' ? 'verified' : 'rejected';
    const move = declarationTransition(held.status, to, 'studio');
    if (!move.ok) throw new PucError(move.reason ?? 'illegal-transition', 409);

    if (to === 'rejected') {
      tx.update(ref, {
        status: 'rejected',
        ...(reason ? { decisionReason: reason } : {}),
        decidedAt: Timestamp.fromDate(now),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { declarationId: id, status: 'rejected' as const };
    }

    /* THE DOCUMENT IS RE-VALIDATED AT THE MOMENT OF THE DECISION. It was
       checked when it was sent, but a stored record is still an input, and the
       write it is about to authorise is the most consequential one in this
       file. The clock is deliberately NOT part of this re-check: a certificate
       that expired while it sat in the queue is a real fact about the car, and
       refusing to record it would leave the customer's ledger saying nothing
       at all rather than saying "expired". */
    if (held.expiresOn <= held.issuedOn) throw new PucError('expiry-not-after-issue', 409);

    /* Everything else this car has already had, so the one being replaced can
       be named rather than guessed at. Read inside the transaction, so a
       second verification racing this one conflicts instead of writing two
       standing certificates. */
    const siblings = await tx.get(
      db().collection(DECLARATIONS).where('vehicleId', '==', held.vehicleId),
    );

    const protectionId = protectionIdFor(held);
    const rows = protectionFromDeclaration(held);
    /* `create`, not `set`: one certificate is one protection document, for
       ever. A second attempt is a conflict rather than an overwrite. */
    tx.create(db().collection(PROTECTIONS).doc(protectionId), {
      ...rows,
      ownerUid: held.ownerUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const d of siblings.docs) {
      if (d.id === id) continue;
      const other = { ...(d.data() as object), id: d.id } as Declaration;
      if (other.kind !== PUC || other.status !== 'verified') continue;
      /* Superseded, never edited. Its dates stay exactly as the studio saw
         them, and so does the protection document it created. */
      const step = declarationTransition(other.status, 'superseded', 'studio');
      if (!step.ok) continue;
      tx.update(d.ref, { status: 'superseded', updatedAt: FieldValue.serverTimestamp() });
    }

    tx.update(ref, {
      status: 'verified',
      protectionId,
      decidedAt: Timestamp.fromDate(now),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { declarationId: id, status: 'verified' as const, protectionId };
  });
}
