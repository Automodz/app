/**
 * DATE & CONCIERGE - design screen 08.
 *
 * `bookings.pickupAddress` was declared and never populated: 0% across every
 * booking in production, read by one WhatsApp template. The concierge was two
 * booleans and a fee, and nowhere in the product could a customer say where
 * their car actually was.
 *
 * What is asserted here is that an address is a place a van can be sent to,
 * that a booking freezes it rather than pointing at it, that a leg is priced
 * per leg, and that a multi-day job holds the bay for as long as it takes.
 */
import { readFileSync } from 'fs';
import {
  checkAddress, shortAddress, fullAddress, pickupTimeFor, normalisePhone,
  PICKUP_LEAD_MINUTES,
} from '@/lib/os/address';
import { isVpa, normaliseVpa, maskVpa, buildUpiIntent, isUpiReference } from '@/lib/os/upi';
import {
  spanEndDate, spanDates, spanDays, DAY_OPEN_MIN, expandIntervals, computeAvailability,
} from '@/lib/availability';
import { pickupFees, PICKUP_LEG_FEE } from '@/lib/services/pricing';

const good = {
  label: 'Home', line1: 'B-402, Silver Oak',
  area: 'Bodakdev', city: 'Ahmedabad', pincode: '380054',
};

/* ── an address is a place a van can be sent to ──────────────────────────── */

describe('an address is checked before a van is sent to it', () => {
  it('accepts a complete one, trimmed', () => {
    const r = checkAddress({ ...good, label: '  Home  ' });
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.label).toBe('Home');
  });

  it('refuses each missing part by name, so the screen can say which', () => {
    expect(checkAddress({ ...good, label: '' })).toEqual({ ok: false, reason: 'label-required' });
    expect(checkAddress({ ...good, line1: '' })).toEqual({ ok: false, reason: 'line1-required' });
    expect(checkAddress({ ...good, area: '' })).toEqual({ ok: false, reason: 'area-required' });
    expect(checkAddress({ ...good, city: '' })).toEqual({ ok: false, reason: 'city-required' });
  });

  it('a pincode is six digits and never starts with zero', () => {
    /* The one field a driver types into a maps application. A wrong one sends
       a van to the wrong district, not to the wrong street. */
    for (const bad of ['38005', '3800544', '080054', 'ABC054', '']) {
      expect(checkAddress({ ...good, pincode: bad }))
        .toEqual({ ok: false, reason: 'pincode-invalid' });
    }
    expect(checkAddress({ ...good, pincode: '380054' }).ok).toBe(true);
  });

  it('a contact number is optional, but a wrong one is refused', () => {
    /* A wrong number is worse than none: the driver rings a stranger while a
       customer waits. */
    expect(checkAddress({ ...good, contactPhone: '' }).ok).toBe(true);
    expect(checkAddress({ ...good, contactPhone: '12345' }))
      .toEqual({ ok: false, reason: 'phone-invalid' });
    const r = checkAddress({ ...good, contactPhone: '+91 95126 05088' });
    expect(r.ok && r.value.contactPhone).toBe('9512605088');
  });

  it('bounded, so a line 2 cannot become an essay stored on every booking', () => {
    expect(checkAddress({ ...good, line1: 'x'.repeat(200) }))
      .toEqual({ ok: false, reason: 'too-long' });
  });

  it('an empty optional is absent rather than an empty string', () => {
    const r = checkAddress(good);
    expect(r.ok && 'line2' in r.value).toBe(false);
    expect(r.ok && 'contactPhone' in r.value).toBe(false);
  });

  it('normalises a phone however it was written', () => {
    expect(normalisePhone('+91 (951) 260-5088')).toBe('9512605088');
  });
});

describe('how an address is said', () => {
  it('"Bodakdev · Home" on a chip', () => {
    expect(shortAddress(good)).toBe('Bodakdev · Home');
  });

  it('the whole thing, assembled from the parts and never stored twice', () => {
    /* Stored twice, a corrected pincode leaves a stale sentence behind it. */
    expect(fullAddress(good)).toBe('B-402, Silver Oak, Bodakdev, Ahmedabad 380054');
    expect(fullAddress({ ...good, line2: 'Off SG Road' }))
      .toBe('B-402, Silver Oak, Off SG Road, Bodakdev, Ahmedabad 380054');
  });
});

describe('when the van leaves is derived, never chosen', () => {
  it('twenty minutes before the slot', () => {
    expect(PICKUP_LEAD_MINUTES).toBe(20);
    expect(pickupTimeFor('10:00', DAY_OPEN_MIN)).toBe('09:40');
  });

  it('never before the studio opens - a van cannot leave a locked unit', () => {
    expect(pickupTimeFor('09:00', DAY_OPEN_MIN)).toBe('09:00');
    expect(pickupTimeFor('09:10', DAY_OPEN_MIN)).toBe('09:00');
  });

  it('a slot we cannot read produces no time at all', () => {
    expect(pickupTimeFor('soon', DAY_OPEN_MIN)).toBeNull();
  });
});

/* ── each leg is its own line ────────────────────────────────────────────── */

describe('a leg is priced per leg', () => {
  it('one leg is one fee; two legs are two lines', () => {
    /* A single boolean would make a customer who is collected AND returned pay
       once, and read a receipt that cannot explain the difference. */
    expect(pickupFees({})).toEqual([]);
    expect(pickupFees({ pickup: true })).toEqual([{ label: 'Pickup', amount: PICKUP_LEG_FEE }]);
    expect(pickupFees({ drop: true })).toEqual([{ label: 'Drop', amount: PICKUP_LEG_FEE }]);
    expect(pickupFees({ pickup: true, drop: true })).toEqual([
      { label: 'Pickup', amount: PICKUP_LEG_FEE },
      { label: 'Drop', amount: PICKUP_LEG_FEE },
    ]);
  });
});

/* ── multi-day ───────────────────────────────────────────────────────────── */

describe('a bay is held for as long as the work takes', () => {
  /* DURATION IS ELAPSED, so these numbers are clock time, not hours worked.
     1200 minutes is 20 hours: from 09:00 it ends at 05:00 the next morning, so
     the bay is held that day and released before opening the day after. The
     old reading consumed 600 working minutes a day and stretched the same job
     to two. See `expandIntervals`. */
  it('a twenty-hour job runs into the next morning, not the next evening', () => {
    /* 1200 minutes from 09:00 spills across the 600-minute working day. */
    expect(spanEndDate('2026-02-12', DAY_OPEN_MIN, 1200)).toBe('2026-02-12');
    expect(spanDates('2026-02-12', DAY_OPEN_MIN, 1200)).toEqual(['2026-02-12']);
    /* Two CALENDAR days is 2880 - the studio's own figure for a Garware Plus. */
    expect(spanDates('2026-02-12', DAY_OPEN_MIN, 2880))
      .toEqual(['2026-02-12', '2026-02-13']);
  });

  it('a same-day job ends the same day, so every booking carries the field', () => {
    /* Equal rather than absent, so no reader has to decide whether a missing
       end date means "same day" or "nobody worked it out". */
    expect(spanEndDate('2026-02-12', DAY_OPEN_MIN, 90)).toBe('2026-02-12');
  });

  it('a three-day job spans three, and the middle day is fully held', () => {
    /* 4320 elapsed minutes - LLumar Valor. */
    const days = expandIntervals({ date: '2026-02-12', startMin: DAY_OPEN_MIN, durationMin: 4320 });
    expect(days.map(d => d.date)).toEqual(['2026-02-12', '2026-02-13', '2026-02-14']);
    /* The middle day is held open to close: the car never leaves the bay. */
    expect(days[1]).toEqual({ date: '2026-02-13', startMin: 540, endMin: 1140 });
    expect(spanDays(DAY_OPEN_MIN, 4320)).toBe(3);
  });

  it('a later start pushes the finish into another day', () => {
    /* Elapsed: 1200 minutes from 14:00 ends at 10:00 the next morning, so the
       bay is still held when the studio opens. A job that ends BEFORE opening -
       600 minutes from 14:00, finishing at midnight - holds nothing the next
       day, because nothing can be booked at that hour anyway. */
    expect(spanEndDate('2026-02-12', 14 * 60, 1200)).toBe('2026-02-13');
    expect(spanEndDate('2026-02-12', 14 * 60, 600)).toBe('2026-02-12');
  });
});

describe('a multi-day reservation blocks every day it occupies', () => {
  /**
   * BOTH BAYS, because the studio has two.
   *
   * These asserted a one-bay floor - a single occupant, and `{ washCapacity: 1 }`
   * with protection hard-coded to 1 in `availability.ts`. The studio runs TWO
   * protection bays and two wash bays, so one car no longer fills the
   * discipline and the law being protected here needs both of them taken to
   * mean anything. The law itself is unchanged and is the one that matters: a
   * two-day job holds the SECOND day, on which nothing starts.
   */
  const inBay = (durationMin: number) => ({
    resource: 'protection' as const,
    date: '2026-02-12', startMin: DAY_OPEN_MIN, durationMin,
  });
  /* 2880 elapsed minutes - two days, the studio's own figure for a PPF. */
  const occupant = inBay(2880);
  const allBays = [inBay(2880), inBay(2880), inBay(2880)];
  const FLOOR = { washCapacity: 2, protectionCapacity: 3 };

  it('the second day is full even though nothing starts on it', () => {
    /* THE FAILURE THIS PREVENTS: a two-day PPF starting Thursday, and a second
       car accepted for Friday morning into a bay that is already occupied. */
    const { fullDates } = computeAvailability(
      ['2026-02-12', '2026-02-13', '2026-02-16'], 'PPF', 600,
      allBays, FLOOR,
    );
    expect(fullDates).toContain('2026-02-12');
    expect(fullDates).toContain('2026-02-13');
    expect(fullDates).not.toContain('2026-02-16');
  });

  it('a wash is unaffected - it is a different physical resource', () => {
    const { fullDates } = computeAvailability(
      ['2026-02-12', '2026-02-13'], 'Washing', 60,
      allBays, FLOOR,
    );
    expect(fullDates).toEqual([]);
  });
});

/* ── the payment address ─────────────────────────────────────────────────── */

describe('a UPI address is checked and never published', () => {
  it('accepts the shapes banks actually issue', () => {
    for (const v of ['aarav@okhdfc', 'nikhil.patel@ybl', '9512605088@paytm', 'a_b-c@okaxis']) {
      expect(isVpa(v)).toBe(true);
    }
  });

  it('refuses what a bank application would not open', () => {
    for (const v of ['', 'aarav', '@okhdfc', 'aarav@', 'a@b@c', 'aarav @okhdfc']) {
      expect(isVpa(v)).toBe(false);
    }
  });

  it('is one address however it was cased', () => {
    expect(normaliseVpa('  Aarav@OKHDFC ')).toBe('aarav@okhdfc');
  });

  it('is masked wherever it is shown back - a screen gets photographed', () => {
    expect(maskVpa('aarav@okhdfc')).toBe('aa•••@okhdfc');
    expect(maskVpa('ab@ybl')).toBe('ab••@ybl');
    expect(maskVpa('')).toBe('');
  });

  it('a transaction reference is checked before the studio reconciles it', () => {
    expect(isUpiReference('412345678901')).toBe(true);
    expect(isUpiReference('12/02/2026')).toBe(false);
    expect(isUpiReference('')).toBe(false);
  });
});

describe('the UPI intent carries the studio’s figure', () => {
  const link = buildUpiIntent({
    payeeVpa: 'automodz@okhdfc', payeeName: 'AutoModz',
    amount: 43622, note: 'Visit 14', reference: 'VIS14ABC',
  });

  it('names the payee, the amount to two decimals, and the currency', () => {
    expect(link.startsWith('upi://pay?')).toBe(true);
    expect(link).toContain('pa=automodz%40okhdfc');
    /* Two decimals, because a bank application shown `43622` has been known to
       read it as something other than rupees. */
    expect(link).toContain('am=43622.00');
    expect(link).toContain('cu=INR');
  });

  it('ties the payment to what it settles', () => {
    expect(link).toContain('tr=VIS14ABC');
  });

  it('strips what would end the query string early', () => {
    const dirty = buildUpiIntent({
      payeeVpa: 'automodz@okhdfc', payeeName: 'AutoModz',
      amount: 100, note: 'a&b=c#d', reference: 'r?e&f',
    });
    expect(dirty).toContain('tn=abc');
    expect(dirty).toContain('tr=ref');
  });
});

/* ── where the rules cannot reach ────────────────────────────────────────── */

describe('the writes rules cannot check are the server’s', () => {
  const rules = readFileSync('firestore.rules', 'utf8');
  const service = readFileSync('lib/server/addressService.ts', 'utf8');
  const booking = readFileSync('lib/server/bookingService.ts', 'utf8');

  it('no client writes an address - one default and delete-protection need a query', () => {
    const block = rules.slice(rules.indexOf('match /addresses/{addressId}'));
    expect(block.slice(0, 300)).toMatch(/allow write: if false;/);
    expect(block.slice(0, 300)).toMatch(/allow read: if request\.auth != null && request\.auth\.uid == userId;/);
  });

  it('exactly one default, in one commit', () => {
    expect(service).toMatch(/runTransaction/);
    expect(service).toMatch(/isDefault: false/);
  });

  it('an address a van is due at cannot be removed', () => {
    expect(service).toMatch(/address-in-use/);
    expect(service).toMatch(/pickupAddressRef/);
  });

  it('the booking freezes the address rather than pointing at it', () => {
    /* A customer who moves house and corrects "Home" has not changed the
       street the studio drove to last March. */
    expect(booking).toMatch(/pickupAddressRef/);
    expect(booking).toMatch(/addresses'\)\.doc\(intent\.pickupAddressId\)/);
  });

  it('a leg with nowhere to go is refused rather than charged for', () => {
    expect(booking).toMatch(/pickup-address-required/);
  });

  it('the collection time is derived from the slot, never taken from the body', () => {
    expect(booking).toMatch(/pickupTimeFor\(intent\.scheduledTime/);
    expect(booking).not.toMatch(/intent\.pickupTime/);
  });

  it('neither the payment address nor quiet mode is client-writable', () => {
    const users = rules.slice(rules.indexOf('match /users/{userId}'), rules.indexOf('match /bookings'));
    expect(users).toMatch(/get\('upiVpa', null\) ==/);
    expect(users).toMatch(/get\('quietMode', null\) ==/);
  });
});
