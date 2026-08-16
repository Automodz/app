import { termState, daysLeft, termAlive } from '@/lib/os/term';
import { visitPhase, careAct, actIndex } from '@/lib/os/visit';
import { truthOf } from '@/lib/os/truth';
import { proposalFor } from '@/lib/os/proposal';
import { liveProtection } from '@/lib/os/protection';
import { deriveStay } from '@/lib/os/stay';
import { clubModel, cycleDaysLeft, cadenceLine } from '@/lib/os/club';
import { conciergeLog, logDay } from '@/lib/os/log';
import type { LiveProtection as Protection } from '@/lib/os/protection';
import type { Booking, Job, Subscription } from '@/lib/types';

const NOW = new Date('2026-07-20T10:00:00');
const iso = (d: number) => {
  const t = new Date(NOW);
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

describe('term engine', () => {
  it('walks active → waning → expiring → lapsed', () => {
    expect(termState(iso(90), { now: NOW })).toBe('active');
    expect(termState(iso(20), { now: NOW })).toBe('waning');
    expect(termState(iso(3), { now: NOW })).toBe('expiring');
    expect(termState(iso(-1), { now: NOW })).toBe('lapsed');
  });
  it('membership gets grace, protection does not', () => {
    expect(termState(iso(-3), { grace: true, now: NOW })).toBe('grace');
    expect(termState(iso(-3), { now: NOW })).toBe('lapsed');
    expect(termState(iso(-10), { grace: true, now: NOW })).toBe('lapsed');
  });
  it('daysLeft counts to end of day', () => {
    expect(daysLeft(iso(0), NOW)).toBe(1);
    expect(termAlive('grace')).toBe(true);
    expect(termAlive('lapsed')).toBe(false);
  });
});

describe('visit translation boundary', () => {
  it('maps ops statuses to phases', () => {
    expect(visitPhase('pending')).toBe('proposed');
    expect(visitPhase('confirmed')).toBe('agreed');
    expect(visitPhase('in_progress')).toBe('live');
    expect(visitPhase('completed')).toBe('archived');
    expect(visitPhase('cancelled')).toBe('cancelled');
  });
  it('maps live statuses to acts in order', () => {
    expect(careAct('vehicle_received')).toBe('received');
    expect(careAct('quality_check')).toBe('final_checks');
    expect(careAct('ready_for_delivery')).toBe('ready');
    expect(actIndex('in_care')).toBeGreaterThan(actIndex('received'));
  });
});

describe('truthOf priority', () => {
  const visit = (status: Booking['status'], date = iso(3)): Booking =>
    ({ status, scheduledDate: date, scheduledTime: '10:00' } as unknown as Booking);
  const none = { live: null, next: null };

  it('live beats everything', () => {
    expect(truthOf({
      live: visit('in_progress'), next: visit('confirmed'),
      protections: [{ label: 'Ceramic coat', expiresOn: iso(5) }],
      now: NOW,
    })).toBe('In the studio - in care.');
  });
  it('ready reads as ready', () => {
    expect(truthOf({ ...none, live: visit('ready_for_delivery'), protections: [], now: NOW }))
      .toBe('Ready for collection.');
  });
  it('agreed beats term edge', () => {
    const t = truthOf({
      ...none, next: visit('confirmed'),
      protections: [{ label: 'Ceramic coat', expiresOn: iso(5) }],
      now: NOW,
    });
    expect(t).toContain("we're ready for it");
  });

  /**
   * IT DOES NOT DECIDE WHICH VISIT IS NEXT, AND MUST NOT LEARN TO.
   *
   * This engine used to take the whole booking list and pick the next visit
   * itself - the third implementation of that question, and the one that
   * outlived the other two. It was hidden because Home suppressed this
   * sentence whenever a visit was booked; when lapsed requests stopped
   * counting as booked, this line began announcing the bookings that had just
   * been retired, under a hero reading "Cared for".
   */
  it('says nothing about a visit it was not handed', () => {
    expect(truthOf({ ...none, protections: [], now: NOW })).not.toContain('ready for it');
  });
  it('a booking with no hour is named by its day, not by an invented time', () => {
    const noTime = { status: 'confirmed', scheduledDate: iso(3) } as unknown as Booking;
    const t = truthOf({ ...none, next: noTime, protections: [], now: NOW });
    expect(t).toContain("we're ready for it");
    expect(t).not.toContain('undefined');
  });

  it('term edge beats care due; protected is the quiet floor', () => {
    expect(truthOf({
      ...none, protections: [{ label: 'Ceramic coat', expiresOn: iso(5) }],
      lastCaredOn: iso(-60), now: NOW,
    })).toBe('Ceramic coat - 6 days of protection left.');
    expect(truthOf({
      ...none, protections: [{ label: 'Ceramic coat', expiresOn: iso(200) }], now: NOW,
    })).toBe('All quiet. Protected.');
    expect(truthOf({ ...none, protections: [], now: NOW })).toBe('All quiet.');
  });
  it('never leaks ops vocabulary', () => {
    for (const s of ['in_progress', 'quality_check', 'ready_for_delivery'] as const) {
      expect(truthOf({ ...none, live: visit(s), protections: [], now: NOW }))
        .not.toMatch(/_|pending|progress|quality/);
    }
    expect(truthOf({ ...none, next: visit('pending'), protections: [], now: NOW }))
      .not.toMatch(/_|pending|progress|quality/);
  });
});

describe('proposal engine', () => {
  /* Built through `liveProtection` rather than hand-faked, so `health` and
     `daysLeft` come from the real term engine - the fixture cannot drift away
     from the lifecycle the engine actually implements. */
  const P = (until: number | null, kind: 'ceramic' | 'ppf' = 'ceramic') =>
    liveProtection({
      id: `p-${kind}-${until}`, vehicleId: 'v1', kind,
      term: until === null
        ? { kind: 'perpetual' as const }
        : { kind: 'dated' as const, expiresOn: iso(until) },
      termsSource: 'captured' as const,
      createdAt: null as never, updatedAt: null as never,
    }, NOW);
  it('proposes protection renewal when a coat is waning/expiring, citing it', () => {
    const p = proposalFor({ vehicleId: 'v1', protections: [P(5)], now: NOW });
    expect(p).not.toBeNull();
    expect(p!.serviceCategory).toBe('Ceramic');
    expect(p!.reason.toLowerCase()).toContain('ceramic coating');
  });
  it('prefers the sooner-expiring protection', () => {
    const p = proposalFor({ vehicleId: 'v1', protections: [P(20, 'ppf'), P(3, 'ceramic')], now: NOW });
    expect(p!.serviceCategory).toBe('Ceramic');
  });
  it('falls back to a wash when cadence is exceeded, citing last care', () => {
    const p = proposalFor({ vehicleId: 'v1', protections: [P(200)], lastCaredOn: iso(-45), now: NOW });
    expect(p!.serviceCategory).toBe('Washing');
    expect(p!.reason).toMatch(/\d+ days since the last wash/);
  });
  it('is silent when protected and recently cared for (one-or-none per vehicle)', () => {
    expect(proposalFor({ vehicleId: 'v1', protections: [P(200)], lastCaredOn: iso(-5), now: NOW })).toBeNull();
    expect(proposalFor({ vehicleId: 'v1', protections: [], now: NOW })).toBeNull();
  });
});

describe('the Stay model', () => {
  const ts = (d: Date) => ({ toDate: () => d }) as unknown as import('firebase/firestore').Timestamp;
  const at = (minAgo: number) => ts(new Date(NOW.getTime() - minAgo * 60000));

  const booking = (over: Partial<Booking> = {}) => ({
    id: 'b1', status: 'in_progress', totalAmount: 24000,
    serviceDurationMinutes: 120, scheduledDate: iso(0), scheduledTime: '10:00',
    paymentStatus: 'pending', ...over,
  }) as unknown as Booking;

  const job = (over: Record<string, unknown> = {}) => ({
    id: 'j1', status: 'in_progress',
    assignments: [{ employeeId: 'e1', employeeName: 'Ravi Sharma', role: 'lead', assignedAt: at(60) }],
    statusHistory: [
      { status: 'checked_in', at: at(60), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma' },
      { status: 'in_progress', at: at(40), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma', note: 'Clay and decontamination done.' },
    ],
    photos: [
      { url: 'a.jpg', path: 'p1', kind: 'before' },
      { url: 'b.jpg', path: 'p2', kind: 'during' },
    ],
    ...over,
  }) as unknown as Parameters<typeof deriveStay>[1];

  it('takes the act from the job and marks earlier acts done', () => {
    const s = deriveStay(booking(), job(), NOW);
    expect(s.act).toBe('in_care');
    expect(s.acts.map(a => a.state)).toEqual(['done', 'done', 'current', 'coming', 'coming']);
    expect(s.acts[0].at).toEqual(new Date(NOW.getTime() - 60 * 60000));
  });

  it('prefers the studio’s own note as the narration', () => {
    const s = deriveStay(booking(), job(), NOW);
    expect(s.narration).toBe('Clay and decontamination done.');
    expect(s.narrationIsStudio).toBe(true);
  });

  it('falls back to the act line when the studio has been quiet', () => {
    const quiet = job({ statusHistory: [{ status: 'checked_in', at: at(10), byEmployeeId: 'e', byEmployeeName: 'R' }], status: 'checked_in' });
    const s = deriveStay(booking({ status: 'vehicle_received' }), quiet, NOW);
    expect(s.narrationIsStudio).toBe(false);
    expect(s.narration).toBe('Your car has arrived safely.');
  });

  it('records the arrival and chains the evidence', () => {
    const s = deriveStay(booking(), job(), NOW);
    expect(s.arrivedAt).not.toBeNull();
    expect(s.arrivalPhoto).toBe('a.jpg');
    expect(s.craftPhoto).toBe('b.jpg');
    expect(s.latestPhoto).toBe('b.jpg');
  });

  /* THE PLANNED FINISH must be a time the studio could actually deliver.
     The studio works 09:00-19:00 and does not run overnight, so wall-clock
     arithmetic lies. Audit finding B7: an 8h ceramic taken in at 18:49
     was promised "around 2:49 am". */
  describe('the planned finish', () => {
    // arrival is derived from the `checked_in` entry, so drive it from there
    const arrivedAt = (d: Date) =>
      job({
        statusHistory: [{ status: 'checked_in', at: ts(d), byEmployeeId: 'e', byEmployeeName: 'R' }],
        status: 'checked_in',
      });

    it('never promises a time outside opening hours', () => {
      const evening = new Date('2026-07-20T18:49:00');       // 11 minutes before close
      const s = deriveStay(
        booking({ status: 'vehicle_received', serviceDurationMinutes: 480 }), // 8 hours
        arrivedAt(evening),
        evening,
      );
      expect(s.timing).not.toMatch(/\b(1[012]|[1-9]):\d\d am\b/); // no small hours
      expect(s.timing).toMatch(/Planned finish Tuesday around/);   // rolls to the next day
    });

    it('names only the clock when the work finishes the same day', () => {
      const morning = new Date('2026-07-20T10:00:00');
      const s = deriveStay(
        booking({ status: 'vehicle_received', serviceDurationMinutes: 120 }),
        arrivedAt(morning),
        morning,
      );
      expect(s.timing).toBe('Planned finish around 12:00 pm.');
    });

    it('says so plainly once it runs past the plan', () => {
      const morning = new Date('2026-07-20T09:30:00');
      const s = deriveStay(
        booking({ status: 'vehicle_received', serviceDurationMinutes: 60 }),
        arrivedAt(morning),
        new Date('2026-07-20T14:00:00'),
      );
      expect(s.timing).toBe('Running longer than planned - the work sets the pace.');
    });
  });

  /* THE ACTOR LAW (Constitution Art. 8): AutoModz performs the work; no
     individual is ever named on a customer surface. The job carries real
     assignments - the studio needs them - and none of them may cross into
     the Stay's model. */
  it('never names an individual, however the floor recorded it', () => {
    const s = deriveStay(booking(), job(), NOW);
    expect(job()!.assignments.length).toBeGreaterThan(0); // the data is there
    expect(JSON.stringify(s)).not.toContain('Ravi Sharma'); // and it never leaks
    expect(JSON.stringify(s)).not.toContain('Karan Patel');
  });

  it('offers a planned finish only while it is still a plan', () => {
    expect(deriveStay(booking(), job(), NOW).timing).toMatch(/^Planned finish around /);
    const late = deriveStay(booking({ serviceDurationMinutes: 30 }), job(), NOW);
    expect(late.timing).toBe('Running longer than planned - the work sets the pace.');
  });

  it('says nothing about time at Ready, or before the car has arrived', () => {
    expect(deriveStay(booking({ status: 'ready_for_delivery' }), job({ status: 'ready_for_delivery' }), NOW).timing).toBeNull();
    expect(deriveStay(booking({ status: 'confirmed' }), null, NOW).timing).toBeNull();
  });

  it('hands a collected visit over as archived', () => {
    const s = deriveStay(booking({ status: 'completed' }), job({ status: 'completed' }), NOW);
    expect(s.archived).toBe(true);
    expect(s.acts.every(a => a.state === 'done')).toBe(true);
  });
});

describe('the Club model', () => {
  const sub = (over: Record<string, unknown> = {}) => ({
    id: 'm1', plan: 'Silver', status: 'active',
    startDate: iso(-20), endDate: iso(10),
    washesTotal: 4, washesUsed: 1, ...over,
  }) as unknown as Subscription;

  const wash = (day: number) => ({
    id: `w${day}`, status: 'completed', serviceCategory: 'Washing',
    scheduledDate: iso(day),
  }) as unknown as Booking;

  it('is silent about the Club for a car that has barely visited', () => {
    const c = clubModel({ membership: null, completed: [wash(-10)], now: NOW });
    expect(c.state).toBe('none');
    expect(c.invited).toBe(false);
  });

  it('earns the invitation after the second visit', () => {
    expect(clubModel({ membership: null, completed: [wash(-10), wash(-40)], now: NOW }).invited).toBe(true);
  });

  it('counts the cycle off the membership, never recomputing it', () => {
    const c = clubModel({ membership: sub(), completed: [], now: NOW });
    expect(c.state).toBe('active');
    expect([c.washesUsed, c.washesLeft, c.washesTotal]).toEqual([1, 3, 4]);
    expect(c.context).toBe(`3 washes left this cycle · renews ${new Date(`${iso(10)}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    expect(cycleDaysLeft(c, NOW)).toBe(11);
  });

  it('holds a pending join without a context line - the card says it', () => {
    const c = clubModel({ membership: sub({ status: 'pending' }), completed: [], now: NOW });
    expect(c.state).toBe('pending');
    expect(c.awaitingPayment).toBe(true);
    expect(c.context).toBeNull();
  });

  it('gives membership its grace, then lets it lapse with dignity', () => {
    expect(clubModel({ membership: sub({ endDate: iso(-3) }), completed: [], now: NOW }).state).toBe('grace');
    const lapsed = clubModel({ membership: sub({ endDate: iso(-40) }), completed: [], now: NOW });
    expect(lapsed.state).toBe('lapsed');
    expect(lapsed.context).toBe('Rejoin any time - your history holds.');
    expect(clubModel({ membership: sub({ status: 'expired' }), completed: [], now: NOW }).state).toBe('lapsed');
  });

  it('treats a cancelled membership as no membership', () => {
    expect(clubModel({ membership: sub({ status: 'cancelled' }), completed: [], now: NOW }).state).toBe('none');
  });

  it('states the customer’s own cadence, and says nothing when it cannot', () => {
    expect(cadenceLine({ washesPerMonth: 4, washes: [wash(-5)], now: NOW })).toBeNull();
    // less than a month of history says nothing at all
    expect(cadenceLine({ washesPerMonth: 4, washes: [wash(-2), wash(-20)], now: NOW })).toBeNull();
    expect(cadenceLine({ washesPerMonth: 4, washes: [wash(-5), wash(-35), wash(-65)], now: NOW }))
      .toBe('You wash about 1.4 times a month · this covers 4.');
  });
});

describe('the concierge log', () => {
  const ts = (d: Date) => ({ toDate: () => d }) as unknown as import('firebase/firestore').Timestamp;
  const LOG_NOW = new Date('2026-07-20T18:00:00');

  const visit = (over: Partial<Booking> = {}) => ({
    id: 'v1', serviceName: 'Kovalent Graphene', scheduledDate: '2026-07-18',
    status: 'completed',
    createdAt: ts(new Date('2026-07-10T09:00:00')),
    updatedAt: ts(new Date('2026-07-11T09:00:00')),
    ...over,
  }) as unknown as Booking;

  const job = (over: Record<string, unknown> = {}) => ({
    id: 'j1', status: 'completed',
    statusHistory: [
      { status: 'checked_in', at: ts(new Date('2026-07-18T09:05:00')), byEmployeeId: 'e', byEmployeeName: 'R' },
      { status: 'in_progress', at: ts(new Date('2026-07-18T09:40:00')), byEmployeeId: 'e', byEmployeeName: 'R' },
    ],
    completedAt: ts(new Date('2026-07-18T17:00:00')),
    ...over,
  }) as unknown as Job;

  const log = (over: Partial<Parameters<typeof conciergeLog>[0]> = {}) => conciergeLog({
    visits: [visit()],
    jobByBooking: new Map([['v1', job()]]),
    membership: null, protections: [], now: LOG_NOW,
    ...over,
  });

  it('writes what CHANGED, newest first - not every step of the floor', () => {
    /**
     * THE OWNER'S REPORT, AND THE REWRITE THAT CAME OUT OF IT.
     *
     * One ceramic coating used to produce four lines here and seven in
     * production - the request, each act the floor moved through, and the
     * filing - each of them wrapping to two lines on a phone:
     *
     *     Kovalent Graphene was finished and filed to the BMW M340i's story.
     *     Work began on the BMW M340i.
     *     The BMW M340i arrived at the studio.
     *     You asked for Kovalent Graphene on 18 July 2026.
     *
     * A visit is ONE thing that happened. Its steps still exist, on the
     * visit's own surface, which every line here opens.
     */
    expect(log().map(e => e.line)).toEqual(['Kovalent Graphene']);
  });

  it('and a visit that left a protection is said by the protection, once', () => {
    /* The coat says what was done AND what it left; the visit line would be
       the same event a second time, on the same day. */
    const coat = {
      id: 'p1', vehicleId: 'v1', kind: 'ceramic', provider: 'Kovalent',
      since: '2026-07-18', term: { kind: 'dated', expiresOn: '2029-07-18' },
      termsSource: 'captured', health: 'healthy', daysLeft: 900,
    } as unknown as Parameters<typeof conciergeLog>[0]['protections'][number];

    const lines = log({ protections: [coat] }).map(e => e.line);
    expect(lines).toEqual(['Kovalent ceramic coating']);
  });

  it('a line is short enough to be a line', () => {
    /* The owner's words: "gets in two line". Every entry is a record, not a
       paragraph - the date is drawn beside it rather than spelled inside it. */
    for (const e of log()) expect(e.line.length).toBeLessThanOrEqual(48);
  });

  /**
   * EVERY DATE IN THIS LOG IS A DATE SOMETHING HAPPENED.
   *
   * There was a fifth line - "The studio confirmed 18 July 2026 for the …" -
   * dated from `booking.updatedAt`, which is when the document was last
   * WRITTEN. Nine of the eleven bookings in production have been edited since
   * they were created, so for nine of them that date was the date of the last
   * edit: Home showed "The studio confirmed 23 July 2026 for the Kia Seltos."
   * stamped 8 August 2026, a fortnight after the visit it confirmed.
   *
   * `Booking.confirmedAt` does not exist. The line returns when the field does.
   */
  it('never dates an entry from when the record was last modified', () => {
    /* A booking edited long after everything about it finished. If any entry
       were anchored to `updatedAt` it would surface at the top, dated today. */
    const edited = visit({ updatedAt: ts(new Date('2026-07-20T17:59:00')) });
    for (const e of log({ visits: [edited] })) {
      expect(e.at.getTime()).toBeLessThan(new Date('2026-07-19').getTime());
    }
  });

  it('does not claim a confirmation the studio has not given', () => {
    /**
     * The rule is now structural rather than checked: there is no
     * confirmation line in the log at all, and a visit that has not happened
     * yet writes nothing. `Booking.confirmedAt` does not exist, so there was
     * never an honest date for one - and a booking still ahead of the car is
     * not "what has happened to it". Home says what is COMING in its own pane.
     */
    const entries = log({ visits: [visit({ status: 'pending' })], jobByBooking: new Map() });
    expect(entries).toEqual([]);
  });

  it('records a cancellation plainly and files nothing after it', () => {
    /* The one kind of entry a customer may need to ACT on, so it survived the
       cut - and it keeps its reason, because a refusal without one is the
       studio declining and not saying why. */
    const cancelled = visit({ status: 'cancelled', cancelledAt: ts(new Date('2026-07-17T11:00:00')) });
    const entries = log({ visits: [cancelled], jobByBooking: new Map() });
    expect(entries.some(e => /cancelled/i.test(e.line))).toBe(true);
    expect(entries.some(e => /finished and filed/.test(e.line))).toBe(false);
    expect(entries.find(e => /cancelled/i.test(e.line))?.at)
      .toEqual(new Date('2026-07-17T11:00:00'));

    const refused = visit({
      status: 'cancelled', rejectionReason: 'the bay was needed for a longer job',
      cancelledAt: ts(new Date('2026-07-17T11:00:00')),
    });
    expect(log({ visits: [refused], jobByBooking: new Map() })[0].line)
      .toBe('Visit not taken - the bay was needed for a longer job');
  });

  it('a cancellation nobody timestamped is not given a plausible day', () => {
    const undated = visit({ status: 'cancelled' });
    const entries = log({ visits: [undated], jobByBooking: new Map() });
    expect(entries.some(e => /cancelled/i.test(e.line))).toBe(false);
  });

  it('every entry opens the thing it is about', () => {
    /* What makes the record useful rather than merely informative: a line is
       a door to the visit behind it, not a sentence about one. A LIVE visit
       writes no line at all now - the ring, the pane and the acts at the top
       of Home are already that visit, three times over. */
    expect(log()[0].target).toEqual({ kind: 'chapter', bookingId: 'v1' });
    expect(log({ visits: [visit({ status: 'in_progress' })], jobByBooking: new Map() })).toEqual([]);
  });

  it('carries protection and membership only when they exist', () => {
    expect(log().some(e => /applied/.test(e.line))).toBe(false);
    const rich = log({
      protections: [liveProtection({
        id: 'p1', vehicleId: 'v1', kind: 'ceramic', since: '2026-07-12',
        term: { kind: 'dated', expiresOn: '2029-07-12' },
        termsSource: 'captured', createdAt: null as never, updatedAt: null as never,
      } as never, NOW) as unknown as Protection],
      membership: { id: 'm1', plan: 'Silver', status: 'active', startDate: '2026-07-05' } as unknown as Subscription,
    });
    /* Short, and the term is NOT repeated: it is stated under the ring, on the
       car's ledger and on the warranty card already (§4.4). What this line
       adds at a glance is the brand, so that is what it keeps. */
    expect(rich.some(e => e.line === 'Ceramic coating')).toBe(true);
    expect(rich.some(e => e.line === 'Joined the Club on Silver')).toBe(true);
  });

  it('never writes the future', () => {
    const entries = log({ visits: [visit({ status: 'confirmed', scheduledDate: '2026-08-01', createdAt: ts(new Date('2026-07-25T09:00:00')), updatedAt: ts(new Date('2026-07-25T09:00:00')) })], jobByBooking: new Map() });
    expect(entries).toEqual([]);
  });

  it('groups by day in plain words', () => {
    expect(logDay(new Date('2026-07-20T08:00:00'), LOG_NOW)).toBe('Today');
    expect(logDay(new Date('2026-07-19T08:00:00'), LOG_NOW)).toBe('Yesterday');
    expect(logDay(new Date('2026-07-12T08:00:00'), LOG_NOW)).toBe('12 July 2026');
  });
});
