/**
 * THE FIGURE ON THE SCREEN IS THE FIGURE THE SERVER WILL CHARGE.
 *
 * `/api/booking/create` recomputes every rupee and ignores anything the client
 * sends, which is correct - but it makes the sheet's number a PREVIEW, and a
 * preview that disagrees with the invoice is worse than no preview at all.
 *
 * It disagreed for every member. The discount effect was gated on `user` from
 * the client store, and `ClientSession` - which mounts `AuthProvider` - is
 * mounted only under `/admin`, `/store` and `/auth`. The customer rooms render
 * on the server and mount none of it, so `user` is always null there: members
 * were quoted the full price and charged the discounted one. Verified against
 * the live route, which returned `totalAmount: 54400` with a "Gold member 15%
 * off" discount while the sheet was showing ₹64,000.
 *
 * These assertions are on the SHARED pricing module both sides use, plus the
 * shape of the client effect that feeds it.
 */
import { readFileSync } from 'fs';
import { computeBestDiscount, applyDiscount } from '@/lib/services/pricing';

const codeOf = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const flow = codeOf('components/studio/BookingFlow.tsx');

describe('a member is quoted the member rate', () => {
  it('the membership discount needs no promo lookup', () => {
    const d = computeBestDiscount({
      price: 64000,
      membershipPlan: 'Gold',
      eligiblePromos: [],
    });
    expect(d).toBeTruthy();
    expect(applyDiscount(64000, d)).toBeLessThan(64000);
  });

  it('and the sheet no longer quotes at all - the SERVER does', () => {
    /* THE STRONGER FIX. The regression these assertions were written for was a
       client-side discount effect gated on a session the customer rooms never
       mount, so members were quoted full price and charged the discounted one.
       Both versions of that effect - the broken one and the corrected one -
       shared the same flaw: a total worked out in a browser is a total the
       server has never agreed to.

       The sheet asks `/api/estimate` with `preview: true`, which runs
       `priceVisit` - the one calculation the booking, the approval and the
       invoice also run - and stores nothing. The figure on the screen and the
       figure in the record are produced by the same code, so they cannot
       differ for a member or for anybody else. */
    expect(flow).not.toMatch(/from '@\/lib\/services\/pricing'/);
    expect(flow).not.toMatch(/computeBestDiscount|applyDiscount/);
    expect(flow).toMatch(/preview: true/);
    expect(flow).toMatch(/authedFetch\('\/api\/estimate'/);
  });

  it('and it needs no client-side session to get the member rate', () => {
    /* No Zustand user, no uid lookup, and no standing down because the
       Firebase SDK has not woken up - nothing optional stands between a member
       and their rate. `authedFetch` identifies the caller by token or by the
       cookie the room was already rendered from, and the SERVER reads the
       membership. */
    expect(flow).not.toMatch(/from '@\/lib\/store'/);
    expect(flow).not.toMatch(/currentUid\(\)/);
    expect(flow).not.toMatch(/if \(!token\)/);
    expect(codeOf('lib/clientSession.ts')).toMatch(/if \(token\) headers\.set\('Authorization'/);
  });

  it('and shows nothing rather than a guess when the studio is unreachable', () => {
    expect(flow).toMatch(/if \(live\) setQuoted\(null\)/);
  });

  it('a non-member is quoted the plain price', () => {
    const d = computeBestDiscount({
      price: 64000, membershipPlan: null, eligiblePromos: [],
    });
    expect(applyDiscount(64000, d)).toBe(64000);
  });

  it('the preview is never sent as an instruction', () => {
    /* §22.1 - the server recomputes. Nothing priced may travel in the body. */
    const call = flow.slice(flow.indexOf("fetch('/api/booking/create'"),
      flow.indexOf("fetch('/api/booking/create'") + 700);
    for (const forged of ['totalAmount', 'discountAmount', 'serviceBasePrice', 'promoId']) {
      expect(call).not.toContain(forged);
    }
  });
});
