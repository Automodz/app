/**
 * THE FIGURE ON THE SCREEN IS THE FIGURE THE SERVER WILL CHARGE.
 *
 * `/api/booking/create` recomputes every rupee and ignores anything the client
 * sends, which is correct — but it makes the sheet's number a PREVIEW, and a
 * preview that disagrees with the invoice is worse than no preview at all.
 *
 * It disagreed for every member. The discount effect was gated on `user` from
 * the client store, and `ClientSession` — which mounts `AuthProvider` — is
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

  it('and no client-side session either', () => {
    /* The whole regression in one assertion: the effect must not stand down
       because the Zustand user is absent. */
    const effect = flow.slice(
      flow.indexOf('setDiscount(undefined)'),
      flow.indexOf('const total = washCovered'),
    );
    expect(effect).not.toBe('');
    expect(flow).not.toMatch(/if \(!open \|\| !service \|\| !user\b/);
    expect(flow).toMatch(/if \(!open \|\| !service \|\| washCovered\)/);
  });

  it('the uid is only ever reached for promos, and may be absent', () => {
    const effect = flow.slice(
      flow.indexOf('setDiscount(undefined)'),
      flow.indexOf('const total = washCovered'),
    );
    /* Falls back to the Firebase session, and skips promos when neither is
       available — rather than abandoning the whole quote. */
    expect(effect).toMatch(/auth\?\.currentUser\?\.uid/);
    expect(effect).toMatch(/if \(uid\) \{/);
  });

  it('a non-member is quoted the plain price', () => {
    const d = computeBestDiscount({
      price: 64000, membershipPlan: null, eligiblePromos: [],
    });
    expect(applyDiscount(64000, d)).toBe(64000);
  });

  it('the preview is never sent as an instruction', () => {
    /* §22.1 — the server recomputes. Nothing priced may travel in the body. */
    const call = flow.slice(flow.indexOf("fetch('/api/booking/create'"),
      flow.indexOf("fetch('/api/booking/create'") + 700);
    for (const forged of ['totalAmount', 'discountAmount', 'serviceBasePrice', 'promoId']) {
      expect(call).not.toContain(forged);
    }
  });
});
