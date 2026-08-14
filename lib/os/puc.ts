/**
 * THE POLLUTION CERTIFICATE - declaring, and what the car may say about it.
 *
 * Source: docs/AUTOMODZ-LIVING-STATES.md §2 (Protection is everything that
 *         shields a car), docs/AUTOMODZ-OS.md §14.2, §18.4, §19.1
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 * `kind: 'puc'` existed, `PROTECTION_TITLE` named it, and a car with one
 * rendered it in the ledger. Nothing could create one. The single act the
 * product offered was `declareHref` - a `wa.me` link that opened WhatsApp with
 * a sentence typed into it - so the answer to "how do I add my certificate"
 * was "send us a message and hope". Meanwhile `declareProtection()` in
 * lib/services/protections.ts had no caller at all, and `firestore.rules` let
 * the browser write a Protection directly, which meant the one path that did
 * exist was also the one a customer could have used to give themselves a
 * certificate valid until 2099.
 *
 * ── THE SEPARATION THIS FILE EXISTS TO HOLD ──────────────────────────────
 * A customer may state a fact about their own paperwork. A customer may not
 * make the product assert it. Those are different acts and they are now
 * different objects:
 *
 *   Declaration   what the owner sent - a reference, two dates, a photograph
 *   Protection    what AutoModz stands behind, created only by a studio
 *                 decision (`lib/server/pucService.ts`)
 *
 * Everything here is PURE. It validates, it reads, it derives - it never
 * writes and never learns where anything lives.
 */
import type { Declaration, DeclarationStatus, Protection, ProtectionKind } from '@/lib/types';
import type { LiveProtection } from './protection';
import type { Health } from './term';

/** The one kind this file speaks for. Widening it is a later decision. */
export const PUC: ProtectionKind = 'puc';

/* ── WHAT THE CAR MAY SAY ────────────────────────────────────────────────── */

/**
 * The five truths, and no sixth.
 *
 * `declared` and `renewing` are deliberately distinct. Both mean "the studio is
 * looking at it", but one is a car with nothing standing and the other is a car
 * that is still certified while its next certificate is checked - and telling
 * the second customer "verification in progress" and nothing else would hide a
 * fact they already have (§19.1: an absence is a state, and so is a wait).
 */
export type PucState =
  /** nothing declared, nothing verified */
  | 'missing'
  /** sent, not yet decided, and nothing stands behind the car meanwhile */
  | 'declared'
  /** verified and still in date */
  | 'active'
  /** verified, and the date has gone */
  | 'expired'
  /** verified and in date, with the next one waiting on the studio */
  | 'renewing'
  /** the studio looked and would not stand behind it */
  | 'rejected';

export interface PucReading {
  state: PucState;
  /** The promise standing right now, when one is. Never the pending one. */
  protection?: LiveProtection;
  /** What the studio has not decided yet. */
  pending?: Declaration;
  /** The last refusal, when the last thing that happened was one. */
  refused?: Declaration;
  /** Every declaration this car has, newest first - the record, unedited. */
  record: Declaration[];
}

/** Newest first, and deterministic when two share a moment. */
const byNewest = (a: Declaration, b: Declaration): number => {
  const at = (d: Declaration) => d.submittedAt?.toMillis?.() ?? 0;
  return at(b) - at(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
};

/**
 * WHAT THIS CAR'S CERTIFICATE ACTUALLY IS, right now.
 *
 * Reads the STORED protections and the STORED declarations and derives nothing
 * else. In particular it never treats a submission as a promise: a car with a
 * declaration and no verified protection is `declared`, not `active`, however
 * confident the dates on it look.
 *
 * Two pending declarations can exist - two tabs, one instant - and the reading
 * is still one answer: the newest submission is the one being waited on, and
 * the studio's decision supersedes the rest. Deterministic by construction,
 * exactly as `oneProtectionPerKind` is.
 */
export function readPuc(args: {
  protections: readonly LiveProtection[];
  declarations: readonly Declaration[];
}): PucReading {
  const mine = args.declarations.filter(d => d.kind === PUC);
  const record = [...mine].sort(byNewest);

  const protection = args.protections.find(p => p.kind === PUC);
  const pending = record.find(d => d.status === 'submitted');
  /* The refusal only speaks while it is still the latest word. A customer who
     was refused and then sent a better certificate is not "rejected". */
  const refused = record[0]?.status === 'rejected' ? record[0] : undefined;

  const holding = protection ? protection.health !== 'lapsed' : false;

  const state: PucState =
    pending && holding ? 'renewing'
      : pending ? 'declared'
        : holding ? 'active'
          : protection ? 'expired'
            : refused ? 'rejected'
              : 'missing';

  return { state, protection, pending, refused, record };
}

/**
 * MAY THE CUSTOMER SEND ONE RIGHT NOW?
 *
 * Not while the studio is holding one - a second submission on top of a
 * pending one is how a queue gets two answers to one question, and the
 * customer has nothing new to say until it is decided.
 *
 * A HEALTHY certificate can still be replaced. That is not a loophole: people
 * are re-tested early, and a product that refuses the new certificate until
 * the old one is nearly dead is a product that makes somebody remember to come
 * back. The server still refuses anything that does not run LATER than what
 * already stands (`resolveSubmission`), which is the rule that actually
 * matters.
 */
export const mayDeclare = (reading: Pick<PucReading, 'state'>): boolean =>
  reading.state !== 'declared' && reading.state !== 'renewing';

/* ── VALIDATION ──────────────────────────────────────────────────────────── */

/**
 * Every way a declaration can be refused before it is stored. Machine-readable,
 * and the same string the API returns - one vocabulary for the refusal, so the
 * screen's sentence and the server's answer cannot drift apart.
 */
export type PucRefusal =
  | 'vehicle-required'
  | 'reference-invalid'
  | 'issued-on-invalid'
  | 'expires-on-invalid'
  | 'expiry-not-after-issue'
  | 'issued-in-the-future'
  | 'already-expired'
  | 'term-too-long'
  | 'note-too-long'
  | 'evidence-invalid';

export interface PucDeclarationInput {
  vehicleId: string;
  reference: string;
  issuedOn: string;
  expiresOn: string;
  /** Both or neither - a URL with no path cannot be proven to belong here. */
  evidenceUrl?: string;
  evidencePath?: string;
  note?: string;
}

/** What survives validation: trimmed, normalised, and safe to store. */
export interface CleanDeclaration {
  vehicleId: string;
  reference: string;
  issuedOn: string;
  expiresOn: string;
  evidence?: { url: string; path: string };
  note?: string;
}

export type PucValidation =
  | { ok: true; value: CleanDeclaration }
  | { ok: false; reason: PucRefusal };

const refuse = (reason: PucRefusal): PucValidation => ({ ok: false, reason });

/**
 * A REAL DATE, not merely a well-shaped string.
 *
 * `2026-02-30` matches every ISO pattern anyone writes and is not a day. The
 * round trip through `Date.UTC` is what catches it: February rolls into March
 * and the parts no longer agree with what was asked for.
 */
export function isCalendarDate(iso: unknown): iso is string {
  if (typeof iso !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Studio-local today, as an ISO date. The studio keeps studio time. */
const STUDIO_UTC_OFFSET_MIN = 330;
export const studioToday = (now: Date = new Date()): string =>
  new Date(now.getTime() + STUDIO_UTC_OFFSET_MIN * 60_000).toISOString().slice(0, 10);

/**
 * THE OUTER BOUND OF A CERTIFICATE'S LIFE.
 *
 * A pollution certificate in India runs six months, or a year for a new
 * vehicle. Twenty-four is therefore not the rule - it is the TYPO GUARD, set
 * generously enough that no real certificate is ever refused by it and tight
 * enough that `2036` typed for `2026` cannot become ten years of protection
 * the studio would have had to notice by eye.
 */
export const MAX_TERM_MONTHS = 24;

const REFERENCE = /^[A-Z0-9][A-Z0-9 /-]{2,39}$/;
const MAX_NOTE = 300;

/** One shape, so two spellings of one certificate cannot both exist. */
const normaliseReference = (s: string) =>
  s.toUpperCase().replace(/\s+/g, ' ').trim();

/**
 * Is this a certificate the studio could be asked to stand behind?
 *
 * `now` is injected and the SERVER passes its own clock. A browser's
 * `Date.now()` never decides whether a certificate is in date.
 */
export function validateDeclaration(
  input: Partial<PucDeclarationInput> | null | undefined,
  now: Date = new Date(),
): PucValidation {
  const vehicleId = typeof input?.vehicleId === 'string' ? input.vehicleId.trim() : '';
  if (!vehicleId) return refuse('vehicle-required');

  const reference = normaliseReference(
    typeof input?.reference === 'string' ? input.reference : '',
  );
  if (!REFERENCE.test(reference)) return refuse('reference-invalid');

  if (!isCalendarDate(input?.issuedOn)) return refuse('issued-on-invalid');
  if (!isCalendarDate(input?.expiresOn)) return refuse('expires-on-invalid');
  const { issuedOn, expiresOn } = input as { issuedOn: string; expiresOn: string };

  /* ISO dates compare as strings, and that is the whole reason the product
     stores them this way - no parsing, no zone, no drift. */
  if (expiresOn <= issuedOn) return refuse('expiry-not-after-issue');

  const today = studioToday(now);
  /* A certificate issued tomorrow is a certificate nobody has. */
  if (issuedOn > today) return refuse('issued-in-the-future');
  /* And one that has already run out protects nothing. The customer is not
     refused a record here - they are told to go and be tested, which is the
     only thing that actually resolves it. */
  if (expiresOn <= today) return refuse('already-expired');

  const bound = new Date(`${issuedOn}T12:00:00Z`);
  bound.setUTCMonth(bound.getUTCMonth() + MAX_TERM_MONTHS);
  if (expiresOn > bound.toISOString().slice(0, 10)) return refuse('term-too-long');

  const note = typeof input?.note === 'string' ? input.note.trim() : '';
  if (note.length > MAX_NOTE) return refuse('note-too-long');

  const url = typeof input?.evidenceUrl === 'string' ? input.evidenceUrl.trim() : '';
  const path = typeof input?.evidencePath === 'string' ? input.evidencePath.trim() : '';
  if (Boolean(url) !== Boolean(path)) return refuse('evidence-invalid');
  if (url && !url.startsWith('https://')) return refuse('evidence-invalid');

  return {
    ok: true,
    value: {
      vehicleId,
      reference,
      issuedOn,
      expiresOn,
      ...(url ? { evidence: { url, path } } : {}),
      ...(note ? { note } : {}),
    },
  };
}

/* ── THE EVIDENCE BELONGS TO THIS CAR ────────────────────────────────────── */

/**
 * WHERE A CERTIFICATE PHOTOGRAPH LIVES, AND WHY THE SHAPE IS THE PROOF.
 *
 * There is one media pipeline (`lib/services/storage.ts` → `/api/media/sign` →
 * `lib/server/cloudinary.ts#mayWrite`) and it already binds a customer's
 * uploads to their own uid. This narrows that by one more turn: the path also
 * carries the CAR, so a URL lifted from one car's declaration cannot be
 * submitted as another's - including another customer's, whose uid would not
 * match either.
 *
 * The client builds the path with this function and the server checks it with
 * the same one. Two copies of this rule would be one copy too many.
 */
export const evidencePrefix = (uid: string, vehicleId: string): string =>
  `vehicles/${uid}-puc-${vehicleId}-`;

/** A fresh, unguessable-enough id for one certificate photograph. */
export const evidencePathFor = (uid: string, vehicleId: string, stamp: number): string =>
  `${evidencePrefix(uid, vehicleId)}${stamp}`;

/**
 * Does this stored path prove the photograph was uploaded for this car, by
 * this customer? `cloudinary:` is the prefix `uploadImage` returns and it is
 * accepted on either side of the check rather than being stripped by callers.
 */
export function evidenceBelongsTo(
  path: string | undefined, uid: string, vehicleId: string,
): boolean {
  if (!path) return false;
  const bare = path.startsWith('cloudinary:') ? path.slice('cloudinary:'.length) : path;
  if (bare.includes('..') || bare.includes('//')) return false;
  return bare.startsWith(evidencePrefix(uid, vehicleId));
}

/* ── WHAT A NEW SUBMISSION DOES TO THE ONES ALREADY THERE ────────────────── */

/**
 * Two customers double-tapping and one customer correcting a typo look
 * identical from the outside - a second POST while a first is unanswered - and
 * they must not have the same effect. This decides which, from the records
 * themselves, so the answer is the same however many times it is asked.
 */
export type PucSubmission =
  /** the same certificate, sent again. Nothing new is written. */
  | { act: 'replay'; existing: Declaration }
  /** a DIFFERENT certificate while one is pending: the older is withdrawn */
  | { act: 'replace'; withdraw: Declaration[] }
  /** nothing stands in its way */
  | { act: 'create' }
  /** it does not run later than what the studio already verified */
  | { act: 'refuse'; reason: 'not-later-than-current' };

const sameCertificate = (d: Declaration, c: CleanDeclaration) =>
  d.reference === c.reference && d.issuedOn === c.issuedOn && d.expiresOn === c.expiresOn;

/**
 * A RENEWAL MUST EXTEND. Anything else is either a mistake or an attempt to
 * shorten a promise that has already been made, and neither is a renewal.
 *
 * Note what this does NOT do: it never touches, edits or reconsiders the
 * verified record it compares against. The worst outcome available to it is
 * refusing to add something new.
 */
export function resolveSubmission(
  existing: readonly Declaration[], incoming: CleanDeclaration,
): PucSubmission {
  const mine = existing.filter(d => d.kind === PUC && d.vehicleId === incoming.vehicleId);

  const pending = mine.filter(d => d.status === 'submitted');
  const replay = pending.find(d => sameCertificate(d, incoming));
  if (replay) return { act: 'replay', existing: replay };

  const standing = mine
    .filter(d => d.status === 'verified')
    .map(d => d.expiresOn)
    .sort()
    .pop();
  if (standing && incoming.expiresOn <= standing) {
    return { act: 'refuse', reason: 'not-later-than-current' };
  }

  return pending.length > 0 ? { act: 'replace', withdraw: pending } : { act: 'create' };
}

/* ── THE PROTECTION A VERIFIED DECLARATION BECOMES ───────────────────────── */

/**
 * ONE DOCUMENT PER CERTIFICATE, and never the deterministic `${vehicleId}_puc`
 * slot the seed data uses.
 *
 * That slot holds ONE promise and a renewal would overwrite it - the `since`
 * gone, the old expiry gone, and no way to answer what the car was certified
 * for last March. `oneProtectionPerKind` already resolves a kind with several
 * documents (it was written for exactly this, after production carried two
 * glass coatings for one car), and it prefers the newest `since`. So a renewal
 * ADDS, the reader picks, and nothing is ever rewritten.
 */
export const protectionIdFor = (d: Pick<Declaration, 'id' | 'vehicleId'>): string =>
  `${d.vehicleId}_puc_${d.id}`;

/**
 * The promise a verified certificate makes. Only the facts the customer
 * actually gave: no provider, no plan, no coverage - a testing centre's name
 * was never asked for and inventing one would be a claim nobody made.
 */
export function protectionFromDeclaration(
  d: Declaration,
): Omit<Protection, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    vehicleId: d.vehicleId,
    kind: PUC,
    since: d.issuedOn,
    term: { kind: 'dated', expiresOn: d.expiresOn },
    termsSource: 'declared',
    declarationId: d.id,
    ...(d.evidence ? { document: { url: d.evidence.url, label: 'Pollution certificate' } } : {}),
  };
}

/* ── WORDS ───────────────────────────────────────────────────────────────── */

/** §21.8 - the customer's word for each state, never the enum. */
export const PUC_STATUS_WORD: Record<DeclarationStatus, string> = {
  submitted: 'With the studio',
  verified: 'Verified',
  rejected: 'Not accepted',
  superseded: 'Replaced',
  withdrawn: 'Withdrawn',
};

/** The tone each state wears, from the same four the product has (§9.2). */
export const PUC_TONE: Record<PucState, Health> = {
  missing: 'attention',
  declared: 'attention',
  active: 'healthy',
  expired: 'lapsed',
  renewing: 'healthy',
  rejected: 'urgent',
};
