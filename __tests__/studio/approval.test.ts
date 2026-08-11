/**
 * MID-VISIT APPROVAL — design screen 12.
 *
 * The only place a customer agrees to spend more money after their car is on a
 * bay. Four things can go wrong and all four cost real money:
 *
 *   the studio answering for the customer
 *   a second tap charging twice
 *   a figure that moves between being shown and being applied
 *   an approval that outlives the visit it belonged to
 *
 * Each is asserted here, at the level it is actually decided.
 */
import { readFileSync } from 'fs';
import { Timestamp } from 'firebase/firestore';
import type { Approval, StoredBreakdown } from '@/lib/types';
import { toApproval, pendingApprovals } from '@/lib/customer/project';
import {
  approvalTransition, approvalHasExpired, APPROVAL_VALID_HOURS, APPROVAL_TRANSITIONS,
} from '@/lib/os/lifecycle';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));
const NOW = new Date('2026-02-12T08:00:00Z');

const breakdown = (total: number): StoredBreakdown => ({
  subtotal: total, discountAmount: 0, fees: [], feesTotal: 0,
  taxable: total, total, washCovered: false,
});

const approval = (over: Partial<Approval> = {}): Approval => ({
  id: 'ap1', jobId: 'job1', bookingId: 'bk1', customerId: 'u1',
  vehicleId: 'v1', vehicleName: 'BMW M340i',
  reason: 'We found something under the film',
  detail: 'Left as it is, the film will lift at the edge within a season.',
  photos: [
    { url: 'https://x.test/a.jpg', caption: 'Rear quarter' },
    { url: 'https://x.test/b.jpg', caption: 'Under light' },
  ],
  proposed: { label: 'Extra stage', price: 6000, minutes: 120 },
  priceDelta: 6000,
  timeDeltaMinutes: 120,
  before: breakdown(37622),
  after: breakdown(43622),
  status: 'requested',
  requestedByEmployeeId: 'emp-rahul',
  requestedAt: ts('2026-02-12T06:00:00Z'),
  expiresAt: ts('2026-02-12T12:50:00Z'),
  ...over,
} as unknown as Approval);

/* ── the screen ──────────────────────────────────────────────────────────── */

describe('screen 12 states what changes, and never who found it', () => {
  it('shows the delta AND the new total, because only one is what they pay', () => {
    const m = toApproval(approval(), NOW);
    expect(m.priceDelta).toBe('+₹6,000');
    expect(m.currentTotal).toBe('₹37,622');
    expect(m.newTotal).toBe('₹43,622');
  });

  it('says whether the extra time still fits today', () => {
    /* "Same day" and "another day" are different decisions, and the price does
       not say which. */
    expect(toApproval(approval(), NOW).timeDelta).toBe('+2 hours · same day');
    expect(toApproval(approval({ timeDeltaMinutes: 900 }), NOW).timeDelta)
      .toBe('+2 days in the bay');
    expect(toApproval(approval({ timeDeltaMinutes: 0 }), NOW).timeDelta)
      .toBe('No extra time');
  });

  it('NEVER NAMES THE TECHNICIAN, though the record holds one', () => {
    /* §2.2 — no individual is ever named on a customer surface, and a
       notification is the surface most likely to be read on a lock screen by
       whoever is holding the phone. */
    const m = toApproval(approval(), NOW);
    expect(JSON.stringify(m)).not.toContain('emp-rahul');
    expect(JSON.stringify(m)).not.toMatch(/Rahul/i);
    expect(approval().requestedByEmployeeId).toBe('emp-rahul');
  });

  it('carries the evidence, because "trust us" is not evidence', () => {
    expect(toApproval(approval(), NOW).photos).toHaveLength(2);
  });

  it('an answered request offers no controls, and says what was answered', () => {
    expect(toApproval(approval({ status: 'approved' }), NOW).settled)
      .toMatch(/You approved/);
    expect(toApproval(approval({ status: 'declined' }), NOW).settled)
      .toMatch(/You skipped/);
    expect(toApproval(approval({ status: 'cancelled' }), NOW).settled)
      .toMatch(/withdrew/);
  });

  it('one that has run out says so rather than silently refusing later', () => {
    const late = new Date('2026-02-12T20:00:00Z');
    expect(toApproval(approval(), late).settled).toMatch(/run out/);
    expect(toApproval(approval(), late).standsUntil).toBeUndefined();
  });

  it('a live one says when it retires, so the customer knows they must answer', () => {
    expect(toApproval(approval(), NOW).standsUntil).toBe('Stands until 6:20 pm');
  });

  it('it opens the visit it belongs to, addressed by the resolver', () => {
    expect(toApproval(approval(), NOW).visitHref).toBe('/history/bk1');
  });
});

describe('what is still waiting', () => {
  it('only requests that stand — answered and expired ones are not questions', () => {
    const list = [
      approval({ id: 'live' }),
      approval({ id: 'done', status: 'approved' }),
      approval({ id: 'no', status: 'declined' }),
      approval({ id: 'gone', requestedAt: ts('2026-02-11T00:00:00Z') }),
    ];
    expect(pendingApprovals(list, NOW).map(a => a.id)).toEqual(['live']);
  });
});

/* ── the machine ─────────────────────────────────────────────────────────── */

describe('the studio cannot answer for the customer', () => {
  it('approval and decline belong to the customer alone', () => {
    expect(approvalTransition('requested', 'approved', 'studio').ok).toBe(false);
    expect(approvalTransition('requested', 'declined', 'studio').ok).toBe(false);
    expect(approvalTransition('requested', 'approved', 'system').ok).toBe(false);
    expect(approvalTransition('requested', 'approved', 'customer').ok).toBe(true);
  });

  it('the studio may withdraw its own question and nothing more', () => {
    expect(approvalTransition('requested', 'cancelled', 'studio').ok).toBe(true);
  });

  it('every resolved state is terminal — a double approval is impossible', () => {
    for (const from of ['approved', 'declined', 'expired', 'cancelled'] as const) {
      expect(APPROVAL_TRANSITIONS[from]).toEqual([]);
    }
  });

  it('a request retires itself, so a bay is not held on an unanswered question', () => {
    const requestedAtMs = Date.parse('2026-02-12T06:00:00Z');
    expect(approvalHasExpired({ status: 'requested', requestedAtMs },
      requestedAtMs + (APPROVAL_VALID_HOURS - 1) * 3600_000)).toBe(false);
    expect(approvalHasExpired({ status: 'requested', requestedAtMs },
      requestedAtMs + (APPROVAL_VALID_HOURS + 1) * 3600_000)).toBe(true);
  });
});

/* ── the service and the doors ───────────────────────────────────────────── */

describe('the answer and its consequence are one commit', () => {
  const service = readFileSync('lib/server/approvalService.ts', 'utf8');
  const route = readFileSync('app/api/approval/route.ts', 'utf8');
  const rules = readFileSync('firestore.rules', 'utf8');
  const studio = readFileSync('components/workspace/ApprovalSection.tsx', 'utf8');

  it('the figure is FROZEN when the studio asks, not recomputed when answered', () => {
    /* A catalogue edit, an expiring promo or a lapsing membership between
       asking and answering would otherwise change what was agreed. */
    expect(service).toMatch(/const after: StoredBreakdown = approval\.after;/);
    expect(service).toMatch(/before = storedBreakdown\(priceVisit\(/);
    expect(service).toMatch(/after = storedBreakdown\(priceVisit\(/);
  });

  it('both figures come from priceVisit — the delta is not a hand subtraction', () => {
    expect(service).toMatch(/priceVisit\(\{/);
    expect(service).toMatch(/priceDelta: Math\.max\(0, after\.total - before\.total\)/);
  });

  it('approving updates the job, its booking and the breakdown behind them', () => {
    /* A total that moved while its working stayed behind is a receipt that
       cannot be checked. */
    expect(service).toMatch(/totalAmount: after\.total/);
    expect(service).toMatch(/breakdown: after/);
    expect(service).toMatch(/collection\('bookings'\)\.doc\(approval\.bookingId\)/);
  });

  it('a second answer is a replay, and applies nothing', () => {
    expect(service).toMatch(/replayed: true/);
    expect(service).toMatch(/approval\.status === 'approved' \|\| approval\.status === 'declined'/);
  });

  it('declining writes the answer and nothing else', () => {
    /* A decline is not a change to the visit; it is the absence of one. The
       branch reads the job's total in order to RETURN it, and writes only the
       approval — so what is asserted is that it touches no other document. */
    const decline = service.slice(
      service.indexOf("if (answer === 'declined')"),
      service.indexOf('── APPLIED IN THE SAME COMMIT'),
    );
    expect(decline).toMatch(/t\.update\(ref, \{ status: 'declined'/);
    expect(decline).not.toMatch(/t\.update\(jobRef/);
    expect(decline).not.toMatch(/serviceItems: \[/);
  });

  it('an approval on a finished visit is refused', () => {
    expect(service).toMatch(/visit-already-closed/);
  });

  it('a request for a car with no account is refused rather than addressed to nobody', () => {
    expect(service).toMatch(/job-has-no-customer/);
  });

  it('another customer’s approval is "not found", never "forbidden"', () => {
    /* The same answer as an id that does not exist, so this cannot be used to
       discover which approvals are real. */
    expect(service).toMatch(/approval\.customerId !== callerUid\) throw new ApprovalError\('not-found', 404\)/);
  });

  it('asking is staff-only, and answering is the owner’s', () => {
    expect(route).toMatch(/\['admin', 'employee'\]\.includes\(role\)/);
    expect(route).toMatch(/respondToApproval\(uid, approvalId, answer\)/);
  });

  it('no client writes an approval at all — rules cannot propagate a total', () => {
    const block = rules.slice(rules.indexOf('match /approvals/{id}'));
    expect(block.slice(0, 400)).toMatch(/allow write: if false;/);
    expect(block.slice(0, 400)).toMatch(/resource\.data\.customerId == request\.auth\.uid/);
  });

  it('the studio surface can ask, and carries no control that answers', () => {
    expect(studio).toMatch(/method: 'POST'/);
    expect(studio).not.toMatch(/'approved'|'declined'/);
  });

  it('the customer is told, and the telling breaks through quiet mode', () => {
    const events = readFileSync('lib/os/events.ts', 'utf8');
    expect(route).toMatch(/type: 'approval_requested'/);
    expect(events).toMatch(/BREAKS_QUIET[\s\S]{0,200}approval_requested/);
  });
});
