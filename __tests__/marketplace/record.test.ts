/**
 * ITS RECORD WITH US - design screen 17.
 *
 * The one place a private record crosses into public: "detailed here since
 * 2021 · 11 visits · 340 photos · full-body PPF 68% life", on a page anyone
 * can open. Every one of those is a fact about a real customer's car shown to
 * strangers.
 *
 * Four things must hold, and the fourth is the one that is easy to lose:
 *
 *   consent is required, and absent means no
 *   revocation is immediate
 *   an invalid link publishes nothing
 *   and NOTHING that crosses is money, a document, or a person
 */
import { readFileSync } from 'fs';
import { Timestamp } from 'firebase/firestore';
import type { CarListing, Protection, Vehicle, Visit } from '@/lib/types';
import { toListing } from '@/lib/customer/market';
import { publicHistoryOf, hasPublicHistoryConsent } from '@/lib/os/consent';
import { measuredLifeOf } from '@/lib/os/protection';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

const listing = (over: Partial<CarListing> = {}): CarListing => ({
  id: 'c1', title: '2021 BMW M340i', make: 'BMW', model: 'M340i', year: 2021,
  price: 4500000, kmDriven: 41208, fuel: 'petrol', transmission: 'automatic',
  ownership: 1, color: 'Phantom Black', description: 'Looked after.',
  photos: [], status: 'available', featured: false, active: true,
  createdAt: ts('2026-01-01T00:00:00Z'), updatedAt: ts('2026-01-01T00:00:00Z'),
  ...over,
} as CarListing);

const granted = (over: Partial<NonNullable<Vehicle['publicHistoryConsent']>> = {}) => ({
  granted: true, grantedAt: ts('2026-01-01T00:00:00Z'), ...over,
});

const record = (over: Partial<Parameters<typeof toListing>[3]> = {}) => ({
  vehicle: { publicHistoryConsent: granted() } as Pick<Vehicle, 'publicHistoryConsent'>,
  visits: [
    { servicedOn: '2021-06-04', stages: [] },
    { servicedOn: '2024-02-11', stages: [] },
  ] as Pick<Visit, 'servicedOn' | 'stages'>[],
  protections: [{ label: 'Paint protection film', detail: '68% life' }],
  photographs: 340,
  since: '2021',
  ...over,
});

/* ── the gate ────────────────────────────────────────────────────────────── */

describe('consent is the gate, and absent means no', () => {
  it('a car whose owner has consented shows its record', () => {
    const m = toListing(listing(), [], [], record());
    expect(m.history).toMatchObject({ since: '2021', visits: 2, photographs: 340 });
  });

  it('NO CONSENT, NO RECORD - and null, not zeroes', () => {
    /* Zeroes are themselves a claim about the car. A screen holding `null`
       cannot leak a count, because it has no count. */
    const m = toListing(listing(), [], [], record({
      vehicle: { publicHistoryConsent: undefined },
    }));
    expect(m.history).toBeNull();
  });

  it('NOBODY IS GRANDFATHERED IN - a car that was never asked is private', () => {
    expect(hasPublicHistoryConsent({ publicHistoryConsent: undefined })).toBe(false);
    expect(hasPublicHistoryConsent(undefined)).toBe(false);
    expect(hasPublicHistoryConsent(null)).toBe(false);
  });

  it('revocation is immediate, even with `granted` still true', () => {
    /* A record may carry `granted: true` from an earlier grant and a later
       `revokedAt`. The later timestamp wins, so revoking does not depend on
       somebody also remembering to flip the boolean. */
    const m = toListing(listing(), [], [], record({
      vehicle: {
        publicHistoryConsent: granted({ revokedAt: ts('2026-02-01T00:00:00Z') }),
      },
    }));
    expect(m.history).toBeNull();
  });

  it('a trade-in the studio never touched has no record at all', () => {
    expect(toListing(listing(), [], []).history).toBeNull();
  });

  it('consent with nothing to show is still nothing to show', () => {
    /* A car whose owner consented but which the studio has never worked on has
       no history - and "0 visits" would be a claim about the car. */
    expect(toListing(listing(), [], [], record({ visits: [], since: undefined })).history)
      .toBeNull();
    expect(publicHistoryOf({ ...record(), visits: [] })).toBeNull();
  });
});

/* ── what may cross ──────────────────────────────────────────────────────── */

describe('what crosses is a count or a worded fact, and nothing else', () => {
  const m = toListing(listing({ regNo: 'GJ01AB1234' }), [], [], record());
  const published = JSON.stringify(m);

  it('no money, anywhere on the listing', () => {
    expect(JSON.stringify(m.history)).not.toMatch(/₹|price|invoice|paid|total/i);
  });

  it('no customer, no phone, no email', () => {
    expect(JSON.stringify(m.history)).not.toMatch(/phone|email|customer|owner[A-Z]/);
  });

  it('no document, no photograph url, no note', () => {
    expect(JSON.stringify(m.history)).not.toMatch(/http|url|document|note/i);
  });

  it('the registration is not published, though the listing holds one', () => {
    /* Admin-only on the type. Publishing it hands a stranger the car's
       identity, which is a different thing from its description. */
    expect(published).not.toContain('GJ01AB1234');
  });

  it('the history is counts and worded protections, and nothing more', () => {
    expect(Object.keys(m.history!).sort())
      .toEqual(['photographs', 'protections', 'since', 'visits']);
  });
});

/* ── the percentage has to be measured ───────────────────────────────────── */

describe('a percentage on a public page is a measurement or it is absent', () => {
  const dated = (since?: string): Pick<Protection, 'since' | 'term'> => ({
    ...(since ? { since } : {}),
    term: { kind: 'dated', expiresOn: '2029-06-04' },
  } as Pick<Protection, 'since' | 'term'>);

  it('measured between two real dates', () => {
    const life = measuredLifeOf(dated('2021-06-04'), new Date('2025-06-04T12:00:00Z'));
    expect(life).not.toBeNull();
    expect(Math.round(life! * 100)).toBe(50);
  });

  it('NO START DATE, NO PERCENTAGE - a bucket wearing a number is not a claim', () => {
    /* The customer's own dial may fall back to a health bucket: they can see
       the word beside it and can ask the studio. A stranger reading a listing
       has neither. */
    expect(measuredLifeOf(dated())).toBeNull();
  });

  it('a perpetual promise has no fraction to take', () => {
    expect(measuredLifeOf({ since: '2021-06-04', term: { kind: 'perpetual' } } as never)).toBeNull();
  });

  it('a term that ends before it began is refused rather than clamped', () => {
    expect(measuredLifeOf({
      since: '2029-06-04', term: { kind: 'dated', expiresOn: '2021-06-04' },
    } as never)).toBeNull();
  });

  it('clamped to the range at both ends', () => {
    expect(measuredLifeOf(dated('2021-06-04'), new Date('2031-01-01T12:00:00Z'))).toBe(0);
    expect(measuredLifeOf(dated('2021-06-04'), new Date('2020-01-01T12:00:00Z'))).toBe(1);
  });
});

/* ── the link ────────────────────────────────────────────────────────────── */

describe('the link between a listing and a car is proven, never trusted', () => {
  const loader = readFileSync('lib/server/marketplace.ts', 'utf8');
  const link = readFileSync('app/api/cars/link/route.ts', 'utf8');
  const page = readFileSync('app/cars/[id]/page.tsx', 'utf8');

  it('the owner is validated by reading the car from UNDER them', () => {
    /* Never "find another vehicle with this id" - searching for a matching
       record is exactly how a plate join re-parented three bookings in
       production. */
    expect(loader).toMatch(/doc\(`users\/\$\{vehicleOwnerId\}\/vehicles\/\$\{vehicleId\}`\)/);
    expect(link).toMatch(/doc\(`users\/\$\{vehicleOwnerId\}\/vehicles\/\$\{vehicleId\}`\)/);
  });

  it('an unproven pair publishes nothing', () => {
    expect(loader).toMatch(/if \(!vehicleSnap\.exists\) return undefined;/);
    expect(link).toMatch(/vehicle-not-in-that-garage/);
  });

  it('half a link is refused - it names a car with no garage to look in', () => {
    expect(link).toMatch(/both-required/);
  });

  it('unlinking removes both fields rather than leaving one behind', () => {
    expect(link).toMatch(/vehicleId: FieldValue\.delete\(\)/);
    expect(link).toMatch(/vehicleOwnerId: FieldValue\.delete\(\)/);
  });

  it('LINKING IS NOT CONSENT - the admin route grants nothing', () => {
    /* An admin who could consent on a customer's behalf would defeat the point
       of asking. It only REPORTS whether the owner has. */
    expect(link).not.toMatch(/publicHistoryConsent: \{|granted: true/);
    expect(link).toMatch(/ownerConsented/);
  });

  it('linking is admin-only', () => {
    expect(link).toMatch(/!== 'admin'\) \{[\s\S]{0,120}admin-only/);
  });

  it('the consent check happens before the history is even read', () => {
    /* A record never loaded is a record that cannot leak. */
    expect(loader).toMatch(/if \(!hasPublicHistoryConsent\(vehicle\)\)/);
  });

  it('the page hands the record to the gate rather than rendering it itself', () => {
    expect(page).toMatch(/loadListingRecord\(car\)/);
    expect(page).toMatch(/toListing\(car, all, savedIds, record\)/);
  });

  it('the screen draws nothing when it was given nothing', () => {
    const screen = readFileSync('components/screens/ListingScreen.tsx', 'utf8');
    expect(screen).toMatch(/\{model\.history \?/);
  });
});
