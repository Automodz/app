/**
 * ONE MEMBERSHIP, ONE STATE.
 *
 * `/membership` asked `os/club`. Three other surfaces did not, and each asked a
 * different question of the raw document instead:
 *
 *   `toYou`             `subscription ? …`            - any subscription at all
 *   `toHome.membership` `status === 'active'`         - a status, not a lifecycle
 *   `membershipAsProtection`
 *                       `status !== 'cancelled'`      - a third rule again
 *
 * A customer in production whose Silver membership had been CANCELLED was told
 * on `/you`:
 *
 *     Silver member.
 *     4 washes left this cycle.
 *     Renews 15 August 2026.
 *
 * and on `/membership`, one tap away, "You are not a member." Both sentences
 * described the same document. Only one of them had asked the engine.
 *
 * `status` and `endDate` are two independent facts and the lifecycle is BOTH:
 * a plan can be cancelled with weeks left on the clock, and it can carry
 * `status: 'active'` long after its end date has gone. `clubModel` is the only
 * thing entitled to combine them, which is why every assertion below drives the
 * real projections rather than a re-implementation of the rule.
 */
import { Timestamp } from 'firebase/firestore';
import type { MembershipStatus, Service, Subscription, User, Vehicle } from '@/lib/types';
import type { CarPicture, CustomerPicture } from '@/lib/customer/source';
import { toYou, toHome, toMembership } from '@/lib/customer/project';

const NOW = new Date('2026-07-30T12:00:00Z');
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const vehicle: Vehicle = {
  id: 'v1', name: 'BMW M4', registrationNumber: 'GJ01AB1234',
  createdAt: ts('2023-03-01T10:00:00Z'),
} as Vehicle;

const car: CarPicture = {
  vehicle, protections: [], declarations: [], visits: [], bookings: [], jobs: [],
};

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1', userId: 'u1', userName: 'Nikhil Patel', userEmail: 'n@example.com',
  userPhone: '9000000000', plan: 'Silver', status: 'active',
  startDate: '2026-07-16', endDate: '2026-08-15',
  washesTotal: 4, washesUsed: 0, paymentMethod: 'upi',
  createdAt: ts('2026-07-16T09:00:00Z'), updatedAt: ts('2026-07-16T09:00:00Z'),
  ...over,
} as Subscription);

const picture = (subscription: Subscription | null): CustomerPicture => ({
  user: { uid: 'u1', name: 'Nikhil Patel', email: 'n@example.com', role: 'customer' } as User,
  cars: [car], subscription, subscriptions: subscription ? [subscription] : [],
  invoices: [], notifications: [], catalogue: [] as Service[], addresses: [], approvals: [],
});

/** What every surface says about the membership, for one subscription. */
const asked = (subscription: Subscription | null) => {
  const p = picture(subscription);
  const home = toHome(p, NOW);
  return {
    you: toYou(p, NOW).membership?.lines,
    membershipHeld: toMembership(p, NOW).held,
    membershipTerm: toMembership(p, NOW).term,
    homeClub: home?.membership?.said,
    /* §15.2 - the membership stands among the car's protections. */
    homeProtection: home?.protections.find(x => x.id.startsWith('membership_')),
  };
};

describe('the membership state', () => {
  it('ACTIVE - every surface agrees it is held, with the engine’s count', () => {
    const a = asked(sub({ washesUsed: 1 }));

    expect(a.membershipHeld).toBe(true);
    expect(a.you).toEqual([
      'Silver member.',
      '3 washes left this cycle.',
      'Renews 15 August 2026.',
    ]);
    expect(a.homeClub).toBe('3 washes remaining this cycle');
    expect(a.homeProtection?.term).toBe('3 washes left');
  });

  it('CANCELLED - nothing anywhere calls it a membership, and nothing renews', () => {
    /* The production contradiction, in one assertion. The end date is still in
       the future: a cancellation is not a date, which is exactly why asking
       `healthOf` about it returned "healthy". */
    const a = asked(sub({ status: 'cancelled' }));

    expect(a.membershipHeld).toBe(false);
    expect(a.you).toBeUndefined();
    expect(a.homeClub).toBeUndefined();
    expect(a.homeProtection).toBeUndefined();
    expect(JSON.stringify(a)).not.toContain('Renews');
  });

  it('EXPIRED - held, plainly lapsed, and never described as renewing', () => {
    const a = asked(sub({ status: 'expired', endDate: '2026-07-01' }));

    expect(a.membershipHeld).toBe(true);
    expect(a.you?.[2]).toBe('Lapsed 1 July 2026.');
    expect(a.you?.join(' ')).not.toContain('Renews');
    expect(a.membershipTerm).toBe('Lapsed 1 July 2026');
    /* Not offered as a live benefit on Home. */
    expect(a.homeClub).toBeUndefined();
    /* But still shown among the protections, because a lapsed protection is
       the fact §15.2 exists to keep visible. */
    expect(a.homeProtection).toBeDefined();
    expect(a.homeProtection?.tone).toBe('lapsed');
  });

  it('LAPSED BY DATE while still marked active - the date wins', () => {
    /* `status: 'active'` and an end date three weeks gone. Home used to read
       the status alone and go on offering washes on a cycle that had ended. */
    const a = asked(sub({ status: 'active', endDate: '2026-07-08', washesUsed: 0 }));

    expect(a.homeClub).toBeUndefined();
    expect(a.you?.[2]).toBe('Lapsed 8 July 2026.');
    expect(a.you?.join(' ')).not.toContain('Renews');
  });

  it('PENDING - asked for, not yet confirmed, and never counted as active', () => {
    const a = asked(sub({ status: 'pending' }));

    expect(a.membershipHeld).toBe(true);
    expect(toMembership(picture(sub({ status: 'pending' })), NOW).awaitingPayment).toBe(true);
    expect(a.you?.[2]).toBe('Waiting on the studio to confirm it.');
    expect(a.you?.join(' ')).not.toContain('Renews');
    /* The club block on Home is for a membership in force. */
    expect(a.homeClub).toBeUndefined();
  });

  it('NONE - no membership, and no empty frame for one', () => {
    const a = asked(null);

    expect(a.membershipHeld).toBe(false);
    expect(a.you).toBeUndefined();
    expect(a.homeClub).toBeUndefined();
    expect(a.homeProtection).toBeUndefined();
  });

  it('You and Membership can never disagree about whether it is held', () => {
    /* The sweep. `held` is the Membership room's answer; a line on You is the
       other room's. Any state where one says yes and the other says no is the
       bug this file exists for. */
    const states: MembershipStatus[] = ['active', 'expired', 'cancelled', 'pending'];
    for (const status of states) {
      for (const endDate of ['2026-08-15', '2026-07-08']) {
        const p = picture(sub({ status, endDate }));
        const onYou = toYou(p, NOW).membership !== undefined;
        const onMembership = toMembership(p, NOW).held;
        expect([status, endDate, onYou]).toEqual([status, endDate, onMembership]);
      }
    }
    const empty = picture(null);
    expect(toYou(empty, NOW).membership).toBeUndefined();
    expect(toMembership(empty, NOW).held).toBe(false);
  });
});
