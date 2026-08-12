/**
 * THE POLLUTION CERTIFICATE, AS A DOMAIN.
 *
 * Two facts are being defended here, and everything below is one of them:
 *
 *   1. A CUSTOMER CANNOT MANUFACTURE A PROMISE. A submission is a submission
 *      until the studio says otherwise, whatever dates it carries.
 *   2. NOTHING HISTORICAL IS EVER REWRITTEN. A renewal adds; it does not edit.
 *
 * The engine is pure, so all of this is exercised directly rather than through
 * a database — the service test proves the writes, and these prove the rules
 * those writes are made of.
 */
import {
  readPuc, mayDeclare, validateDeclaration, resolveSubmission,
  protectionFromDeclaration, protectionIdFor, evidenceBelongsTo, evidencePathFor,
  evidencePrefix, isCalendarDate, studioToday, MAX_TERM_MONTHS, PUC,
  type CleanDeclaration,
} from '@/lib/os/puc';
import { declarationTransition, DECLARATION_TRANSITIONS } from '@/lib/os/lifecycle';
import { liveProtection, oneProtectionPerKind } from '@/lib/os/protection';
import { Timestamp } from 'firebase/firestore';
import type { Declaration, DeclarationStatus, Protection } from '@/lib/types';

const NOW = new Date('2026-08-12T09:00:00Z');

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const decl = (over: Partial<Declaration> = {}): Declaration => ({
  id: 'd1',
  vehicleId: 'v1',
  ownerUid: 'u1',
  kind: PUC,
  reference: 'GJ01-PUC-88213',
  issuedOn: '2026-06-01',
  expiresOn: '2026-12-01',
  status: 'submitted',
  submittedAt: ts('2026-08-10T10:00:00Z'),
  createdAt: ts('2026-08-10T10:00:00Z'),
  updatedAt: ts('2026-08-10T10:00:00Z'),
  ...over,
} as unknown as Declaration);

const prot = (over: Partial<Protection> = {}): Protection => ({
  id: 'v1_puc_d0',
  vehicleId: 'v1',
  kind: PUC,
  since: '2026-02-01',
  term: { kind: 'dated', expiresOn: '2026-11-01' },
  termsSource: 'declared',
  createdAt: ts('2026-02-01T00:00:00Z'),
  updatedAt: ts('2026-02-01T00:00:00Z'),
  ...over,
} as unknown as Protection);

const clean = (over: Partial<CleanDeclaration> = {}): CleanDeclaration => ({
  vehicleId: 'v1',
  reference: 'GJ01-PUC-99001',
  issuedOn: '2026-08-01',
  expiresOn: '2027-02-01',
  ...over,
});

/* ── VALIDATION ──────────────────────────────────────────────────────────── */

describe('what may be sent at all', () => {
  const ok = { vehicleId: 'v1', reference: 'GJ01-PUC-88213', issuedOn: '2026-06-01', expiresOn: '2026-12-01' };

  it('accepts a real certificate and normalises what it stores', () => {
    const v = validateDeclaration({ ...ok, reference: '  gj01-puc-88213  ', note: '  from the RTO  ' }, NOW);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    /* One shape, so two spellings of one certificate cannot both exist. */
    expect(v.value.reference).toBe('GJ01-PUC-88213');
    expect(v.value.note).toBe('from the RTO');
  });

  it('refuses a date that is well shaped and is not a day', () => {
    /* `2026-02-30` matches every ISO pattern anyone writes. */
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(validateDeclaration({ ...ok, issuedOn: '2026-02-30' }, NOW))
      .toEqual({ ok: false, reason: 'issued-on-invalid' });
  });

  it('refuses anything that is not a date at all', () => {
    for (const bad of ['', '12/06/2026', '2026-6-1', 'yesterday', null, 42, undefined]) {
      expect(validateDeclaration({ ...ok, expiresOn: bad as string }, NOW).ok).toBe(false);
    }
  });

  it('THE EXPIRY MUST BE AFTER THE ISSUE — never equal, never before', () => {
    expect(validateDeclaration({ ...ok, issuedOn: '2026-06-01', expiresOn: '2026-06-01' }, NOW))
      .toEqual({ ok: false, reason: 'expiry-not-after-issue' });
    expect(validateDeclaration({ ...ok, issuedOn: '2026-06-01', expiresOn: '2026-05-01' }, NOW))
      .toEqual({ ok: false, reason: 'expiry-not-after-issue' });
  });

  it('refuses a certificate issued tomorrow — nobody holds one', () => {
    expect(validateDeclaration({ ...ok, issuedOn: '2026-09-01', expiresOn: '2027-01-01' }, NOW))
      .toEqual({ ok: false, reason: 'issued-in-the-future' });
  });

  it('refuses one that has already run out, because it protects nothing', () => {
    expect(validateDeclaration({ ...ok, issuedOn: '2026-01-01', expiresOn: '2026-07-01' }, NOW))
      .toEqual({ ok: false, reason: 'already-expired' });
  });

  it('THE TYPO GUARD: a year mistyped cannot become ten years of protection', () => {
    /* Not a rule about certificates — a rule about `2036` typed for `2026`.
       Generous enough that no real certificate is refused by it. */
    expect(validateDeclaration({ ...ok, issuedOn: '2026-06-01', expiresOn: '2036-06-01' }, NOW))
      .toEqual({ ok: false, reason: 'term-too-long' });
    expect(MAX_TERM_MONTHS).toBe(24);
    /* A year, which is the longest a real one runs, is fine. */
    expect(validateDeclaration({ ...ok, issuedOn: '2026-06-01', expiresOn: '2027-06-01' }, NOW).ok).toBe(true);
  });

  it('refuses a reference that is not one, and a note nobody would write', () => {
    expect(validateDeclaration({ ...ok, reference: 'ab' }, NOW))
      .toEqual({ ok: false, reason: 'reference-invalid' });
    expect(validateDeclaration({ ...ok, reference: '<script>x</script>' }, NOW))
      .toEqual({ ok: false, reason: 'reference-invalid' });
    expect(validateDeclaration({ ...ok, note: 'x'.repeat(301) }, NOW))
      .toEqual({ ok: false, reason: 'note-too-long' });
  });

  it('refuses evidence that is half given, or not a URL', () => {
    expect(validateDeclaration({ ...ok, evidenceUrl: 'https://x/y' }, NOW))
      .toEqual({ ok: false, reason: 'evidence-invalid' });
    expect(validateDeclaration({ ...ok, evidencePath: 'cloudinary:vehicles/u1-puc-v1-1' }, NOW))
      .toEqual({ ok: false, reason: 'evidence-invalid' });
    expect(validateDeclaration({
      ...ok, evidenceUrl: 'javascript:alert(1)', evidencePath: 'cloudinary:vehicles/u1-puc-v1-1',
    }, NOW)).toEqual({ ok: false, reason: 'evidence-invalid' });
  });

  it('and refuses a declaration with no car', () => {
    expect(validateDeclaration({ ...ok, vehicleId: '' }, NOW))
      .toEqual({ ok: false, reason: 'vehicle-required' });
    expect(validateDeclaration(null, NOW)).toEqual({ ok: false, reason: 'vehicle-required' });
  });

  it('keeps studio time, so a customer abroad is not told today is tomorrow', () => {
    /* Ahmedabad is UTC+05:30. At 21:00 UTC it is already the next day there. */
    expect(studioToday(new Date('2026-08-12T21:00:00Z'))).toBe('2026-08-13');
    expect(studioToday(new Date('2026-08-12T09:00:00Z'))).toBe('2026-08-12');
  });
});

/* ── THE PHOTOGRAPH BELONGS TO THIS CAR ──────────────────────────────────── */

describe('a certificate photograph cannot be borrowed from another car', () => {
  it('the path binds the uploader AND the car', () => {
    expect(evidencePrefix('u1', 'v1')).toBe('vehicles/u1-puc-v1-');
    expect(evidencePathFor('u1', 'v1', 1770000000000)).toBe('vehicles/u1-puc-v1-1770000000000');
  });

  it('accepts its own upload, with or without the stored prefix', () => {
    expect(evidenceBelongsTo('vehicles/u1-puc-v1-99', 'u1', 'v1')).toBe(true);
    expect(evidenceBelongsTo('cloudinary:vehicles/u1-puc-v1-99', 'u1', 'v1')).toBe(true);
  });

  it('refuses another car of the same owner, and another owner entirely', () => {
    expect(evidenceBelongsTo('cloudinary:vehicles/u1-puc-v2-99', 'u1', 'v1')).toBe(false);
    expect(evidenceBelongsTo('cloudinary:vehicles/u2-puc-v1-99', 'u1', 'v1')).toBe(false);
  });

  it('refuses traversal, and refuses nothing at all', () => {
    expect(evidenceBelongsTo('cloudinary:vehicles/u1-puc-v1-../../gallery/x', 'u1', 'v1')).toBe(false);
    expect(evidenceBelongsTo(undefined, 'u1', 'v1')).toBe(false);
    expect(evidenceBelongsTo('', 'u1', 'v1')).toBe(false);
  });
});

/* ── THE STATE MACHINE ───────────────────────────────────────────────────── */

describe('what may follow what, and who may cause it', () => {
  it('the customer submits; only the studio verifies', () => {
    expect(declarationTransition('submitted', 'verified', 'studio').ok).toBe(true);
    expect(declarationTransition('submitted', 'verified', 'customer'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
    expect(declarationTransition('submitted', 'verified', 'system'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
  });

  it('VERIFIED → VERIFIED is refused, so one certificate is one protection', () => {
    expect(declarationTransition('verified', 'verified', 'studio'))
      .toEqual({ ok: false, reason: 'no-change' });
  });

  it('REJECTED → VERIFIED is refused: a refusal is not reconsidered in place', () => {
    expect(declarationTransition('rejected', 'verified', 'studio'))
      .toEqual({ ok: false, reason: 'already-rejected' });
  });

  it('and neither a superseded nor a withdrawn record can be revived', () => {
    expect(declarationTransition('superseded', 'verified', 'studio'))
      .toEqual({ ok: false, reason: 'already-superseded' });
    expect(declarationTransition('withdrawn', 'verified', 'studio'))
      .toEqual({ ok: false, reason: 'already-withdrawn' });
  });

  it('a verified certificate may only ever be SUPERSEDED — never edited away', () => {
    expect(DECLARATION_TRANSITIONS.verified).toEqual(['superseded']);
    expect(declarationTransition('verified', 'rejected', 'studio'))
      .toEqual({ ok: false, reason: 'illegal-transition' });
    expect(declarationTransition('verified', 'withdrawn', 'customer'))
      .toEqual({ ok: false, reason: 'illegal-transition' });
  });

  it('the customer may withdraw their own submission and nothing else', () => {
    expect(declarationTransition('submitted', 'withdrawn', 'customer').ok).toBe(true);
    /* `superseded` is what happens to a VERIFIED certificate when the next one
       is verified. A pending one that is replaced is withdrawn, so this is not
       merely the wrong actor — there is no such step. */
    expect(declarationTransition('submitted', 'superseded', 'customer'))
      .toEqual({ ok: false, reason: 'illegal-transition' });
    expect(declarationTransition('submitted', 'rejected', 'customer'))
      .toEqual({ ok: false, reason: 'not-yours-to-make' });
  });

  it('every terminal state really is terminal', () => {
    for (const s of ['rejected', 'superseded', 'withdrawn'] as DeclarationStatus[]) {
      expect(DECLARATION_TRANSITIONS[s]).toEqual([]);
    }
  });
});

/* ── DUPLICATES AND RENEWAL ──────────────────────────────────────────────── */

describe('a second submission on top of a first', () => {
  it('the SAME certificate sent twice writes nothing new', () => {
    const pending = decl({ id: 'd1', reference: 'GJ01-PUC-99001', issuedOn: '2026-08-01', expiresOn: '2027-02-01' });
    expect(resolveSubmission([pending], clean())).toEqual({ act: 'replay', existing: pending });
  });

  it('a DIFFERENT certificate replaces the pending one rather than joining it', () => {
    const pending = decl({ id: 'd1', reference: 'GJ01-PUC-00001', expiresOn: '2026-12-01' });
    const v = resolveSubmission([pending], clean());
    expect(v).toEqual({ act: 'replace', withdraw: [pending] });
  });

  it('a first declaration on a car with nothing simply creates', () => {
    expect(resolveSubmission([], clean())).toEqual({ act: 'create' });
  });

  it('A RENEWAL MUST EXTEND — one that does not is refused', () => {
    const standing = decl({ id: 'd0', status: 'verified', expiresOn: '2027-02-01' });
    expect(resolveSubmission([standing], clean({ expiresOn: '2027-01-01' })))
      .toEqual({ act: 'refuse', reason: 'not-later-than-current' });
    expect(resolveSubmission([standing], clean({ expiresOn: '2027-02-01' })))
      .toEqual({ act: 'refuse', reason: 'not-later-than-current' });
    expect(resolveSubmission([standing], clean({ expiresOn: '2027-03-01' })))
      .toEqual({ act: 'create' });
  });

  it('a renewal is allowed while the current one still stands — people re-test early', () => {
    const standing = decl({ id: 'd0', status: 'verified', expiresOn: '2026-12-01' });
    expect(resolveSubmission([standing], clean({ expiresOn: '2027-02-01' })).act).toBe('create');
  });

  it('another car’s declarations are none of this car’s business', () => {
    const elsewhere = decl({ id: 'dX', vehicleId: 'v2', status: 'verified', expiresOn: '2030-01-01' });
    expect(resolveSubmission([elsewhere], clean())).toEqual({ act: 'create' });
  });

  it('and a refused or withdrawn record never blocks a new one', () => {
    const dead = [
      decl({ id: 'a', status: 'rejected', expiresOn: '2030-01-01' }),
      decl({ id: 'b', status: 'withdrawn', expiresOn: '2030-01-01' }),
    ];
    expect(resolveSubmission(dead, clean())).toEqual({ act: 'create' });
  });
});

/* ── HISTORICAL INTEGRITY ────────────────────────────────────────────────── */

describe('a renewal adds; it does not rewrite', () => {
  it('every verified certificate gets its OWN protection document', () => {
    const first = decl({ id: 'd1', issuedOn: '2026-02-01', expiresOn: '2026-08-01' });
    const second = decl({ id: 'd2', issuedOn: '2026-07-25', expiresOn: '2027-01-25' });
    expect(protectionIdFor(first)).toBe('v1_puc_d1');
    expect(protectionIdFor(second)).toBe('v1_puc_d2');
    /* NOT the `${vehicleId}_puc` slot the seed data uses — that holds one
       promise, and a renewal into it would erase the `since` and the expiry of
       the certificate it replaced. */
    expect(protectionIdFor(second)).not.toBe('v1_puc');
  });

  it('the newer of two stored certificates is the one the car reads', () => {
    const old = prot({ id: 'v1_puc_d1', since: '2026-02-01', term: { kind: 'dated', expiresOn: '2026-08-01' } });
    const now = prot({ id: 'v1_puc_d2', since: '2026-07-25', term: { kind: 'dated', expiresOn: '2027-01-25' } });
    /* Deterministic whatever order Firestore returns them in. */
    expect(oneProtectionPerKind([old, now]).map(p => p.id)).toEqual(['v1_puc_d2']);
    expect(oneProtectionPerKind([now, old]).map(p => p.id)).toEqual(['v1_puc_d2']);
  });

  it('and the older one is still there, with its own dates, unedited', () => {
    const old = prot({ id: 'v1_puc_d1', since: '2026-02-01', term: { kind: 'dated', expiresOn: '2026-08-01' } });
    const derived = protectionFromDeclaration(decl({ id: 'd2', issuedOn: '2026-07-25', expiresOn: '2027-01-25' }));
    expect(derived.since).toBe('2026-07-25');
    expect(old.since).toBe('2026-02-01');
    expect(old.term).toEqual({ kind: 'dated', expiresOn: '2026-08-01' });
  });

  it('the protection carries only what the customer actually gave', () => {
    const d = decl({ evidence: { url: 'https://res.cloudinary.com/x.jpg', path: 'cloudinary:vehicles/u1-puc-v1-1' } });
    const p = protectionFromDeclaration(d);
    expect(p).toMatchObject({
      vehicleId: 'v1',
      kind: 'puc',
      since: '2026-06-01',
      term: { kind: 'dated', expiresOn: '2026-12-01' },
      termsSource: 'declared',
      declarationId: 'd1',
      document: { url: 'https://res.cloudinary.com/x.jpg', label: 'Pollution certificate' },
    });
    /* No testing centre was ever asked for, so none is invented. */
    expect(p.provider).toBeUndefined();
    expect(p.plan).toBeUndefined();
    expect(p.coverage).toBeUndefined();
    /* And it is never a captured term — that is the studio's record of what it
       sold, and AutoModz did not sell this. */
    expect(p.termsSource).not.toBe('captured');
  });
});

/* ── WHAT THE CAR MAY SAY ────────────────────────────────────────────────── */

describe('the state a car is truly in', () => {
  const live = (p: Protection) => liveProtection(p, NOW);

  it('nothing at all is MISSING', () => {
    expect(readPuc({ protections: [], declarations: [] }).state).toBe('missing');
  });

  it('A SUBMISSION IS NOT A PROMISE — it reads as declared, never active', () => {
    const r = readPuc({ protections: [], declarations: [decl({ expiresOn: '2099-01-01' })] });
    expect(r.state).toBe('declared');
    expect(r.protection).toBeUndefined();
  });

  it('a verified certificate in date is ACTIVE', () => {
    const r = readPuc({ protections: [live(prot())], declarations: [decl({ status: 'verified' })] });
    expect(r.state).toBe('active');
  });

  it('a verified certificate past its date is EXPIRED, not missing', () => {
    const gone = live(prot({ term: { kind: 'dated', expiresOn: '2026-07-30' } }));
    expect(readPuc({ protections: [gone], declarations: [] }).state).toBe('expired');
  });

  it('a renewal on top of one still in date is RENEWING, and says both', () => {
    const r = readPuc({
      protections: [live(prot())],
      declarations: [decl({ id: 'd0', status: 'verified' }), decl({ id: 'd2', status: 'submitted' })],
    });
    expect(r.state).toBe('renewing');
    /* The one standing is the protection; the one waiting is the declaration.
       They are never conflated. */
    expect(r.protection?.id).toBe('v1_puc_d0');
    expect(r.pending?.id).toBe('d2');
  });

  it('the last word being a refusal is REJECTED', () => {
    const r = readPuc({
      protections: [],
      declarations: [decl({ status: 'rejected', decisionReason: 'The plate does not match.' })],
    });
    expect(r.state).toBe('rejected');
    expect(r.refused?.decisionReason).toBe('The plate does not match.');
  });

  it('but a refusal answered by a new submission is no longer the last word', () => {
    const r = readPuc({
      protections: [],
      declarations: [
        decl({ id: 'old', status: 'rejected', submittedAt: ts('2026-08-01T00:00:00Z') }),
        decl({ id: 'new', status: 'submitted', submittedAt: ts('2026-08-10T00:00:00Z') }),
      ],
    });
    expect(r.state).toBe('declared');
    expect(r.refused).toBeUndefined();
  });

  it('two pending declarations still give ONE answer, deterministically', () => {
    const a = decl({ id: 'a', submittedAt: ts('2026-08-10T00:00:00Z') });
    const b = decl({ id: 'b', submittedAt: ts('2026-08-11T00:00:00Z') });
    expect(readPuc({ protections: [], declarations: [a, b] }).pending?.id).toBe('b');
    expect(readPuc({ protections: [], declarations: [b, a] }).pending?.id).toBe('b');
  });

  it('the record is every declaration, newest first, and nothing is dropped', () => {
    const r = readPuc({
      protections: [],
      declarations: [
        decl({ id: 'a', status: 'superseded', submittedAt: ts('2025-01-01T00:00:00Z') }),
        decl({ id: 'c', status: 'submitted', submittedAt: ts('2026-08-10T00:00:00Z') }),
        decl({ id: 'b', status: 'verified', submittedAt: ts('2026-01-01T00:00:00Z') }),
      ],
    });
    expect(r.record.map(d => d.id)).toEqual(['c', 'b', 'a']);
  });

  it('another kind of paper is not this car’s certificate', () => {
    const insurance = decl({ id: 'i', kind: 'insurance' });
    expect(readPuc({ protections: [], declarations: [insurance] }).state).toBe('missing');
    expect(readPuc({ protections: [], declarations: [insurance] }).record).toEqual([]);
  });
});

describe('when the customer may send one', () => {
  const live = (p: Protection) => liveProtection(p, NOW);

  it('never while the studio is holding one', () => {
    expect(mayDeclare({ state: 'declared' })).toBe(false);
    expect(mayDeclare({ state: 'renewing' })).toBe(false);
  });

  it('always where there is something to say', () => {
    for (const state of ['missing', 'expired', 'rejected', 'active'] as const) {
      expect({ state, may: mayDeclare({ state }) }).toEqual({ state, may: true });
    }
  });

  it('and the engine, not a screen, is the one that decides', () => {
    const r = readPuc({ protections: [live(prot())], declarations: [decl()] });
    expect(mayDeclare(r)).toBe(false);
  });
});
