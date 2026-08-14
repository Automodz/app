/**
 * Resource-aware availability engine - PURE functions, no Firestore.
 *
 * The studio has exactly TWO physical resources:
 *   wash bay        capacity 1   (all washes - no parallel washes)
 *   protection bay  capacity 1   (PPF / ceramic / graphene / coating /
 *                                 correction - ONE active protection job;
 *                                 a 3-day PPF makes ceramic wait)
 *
 * Occupancy is computed from bookings + active jobs, expanded across WORKING
 * days (09:00–19:00): a 3-day PPF starting Monday 9AM blocks the PPF bay
 * through Wednesday close. Consumed by the /api/availability route (server,
 * Admin SDK - customers cannot read other bookings) and by staff surfaces
 * directly (BayStrip).
 */

export const DAY_OPEN_MIN = 9 * 60;    // 09:00
export const DAY_CLOSE_MIN = 19 * 60;  // 19:00
export const WORK_DAY_MIN = DAY_CLOSE_MIN - DAY_OPEN_MIN; // 600
const BUCKET = 30; // occupancy resolution, minutes
const MINUTES_PER_DAY = 24 * 60;

export type ResourceKey = 'wash' | 'protection';

export interface ResourceConfig {
  /** Simultaneous wash vehicles. The studio runs two wash bays. */
  washCapacity: number;
  /**
   * Simultaneous PROTECTION vehicles - PPF, ceramic, detailing and coating all
   * share this pool. The studio runs three.
   *
   * This did not exist. `resourceCapacity` returned a hard-coded `1`, so no
   * setting could express a second bay at all.
   */
  protectionCapacity: number;
  /**
   * Bays taken out of service - a lift down, a booth being resurfaced.
   *
   * Named rather than counted, because "one fewer bay" and "THIS bay is gone"
   * are different facts: a booking already assigned to a disabled bay has to be
   * visible as a collision, and a count cannot tell you which one to move.
   */
  disabledBays?: readonly string[];
}
export const RESOURCE_DEFAULTS: ResourceConfig = {
  washCapacity: 2,
  protectionCapacity: 3,
};

/* ── THE FIVE BAYS ───────────────────────────────────────────────────────── */

/**
 * A BAY IS A PLACE, NOT A NUMBER.
 *
 * The engine counted: it held a per-30-minute tally per GROUP and refused a
 * slot once the tally reached capacity. That is sound arithmetic and it is
 * enough to stop over-booking, but it can never answer the question the studio
 * actually asks - WHICH bay is this car going in? So nothing was assigned,
 * nothing could be taken out of service by name, and an admin override could
 * put two cars in one bay with no record that it had happened.
 *
 * Bays are now named and a booking is ASSIGNED to one. The capacity numbers
 * still generate them, so the existing Studio Settings control still works and
 * raising the count adds a bay rather than changing the model.
 */
export interface Bay {
  id: string;
  group: ResourceKey;
  label: string;
}

export const baysOf = (cfg: ResourceConfig): Bay[] => {
  const disabled = new Set(cfg.disabledBays ?? []);
  const make = (group: ResourceKey, n: number, label: string): Bay[] =>
    Array.from({ length: Math.max(1, n) }, (_, i) => ({
      id: `${group}-${i + 1}`, group, label: `${label} ${i + 1}`,
    })).filter(b => !disabled.has(b.id));
  return [
    ...make('protection', cfg.protectionCapacity, 'Protection Bay'),
    ...make('wash', cfg.washCapacity, 'Wash Bay'),
  ];
};

/** The bays a category may occupy. Washing never touches a protection bay. */
export const baysFor = (category: string, cfg: ResourceConfig): Bay[] => {
  const group = categoryToResource(category);
  return baysOf(cfg).filter(b => b.group === group);
};

/** Turnover buffer between consecutive jobs on the same resource. */
export const BUFFER_MIN = 15;

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  wash: 'Wash Bay', protection: 'Protection Bay',
};

/** Which physical resource a service category occupies. */
export const categoryToResource = (category: string): ResourceKey =>
  category === 'Washing' ? 'wash' : 'protection';

export const resourceCapacity = (r: ResourceKey, cfg: ResourceConfig): number =>
  Math.max(0, baysOf(cfg).filter(b => b.group === r).length);

/** One reservation the engine schedules around. */
export interface Occupant {
  resource: ResourceKey;
  /**
   * The bay it holds, when it has one.
   *
   * ABSENT MEANS LEGACY. Every booking taken under the counting model has no
   * bay, and rejecting those would empty the studio's diary. An unassigned
   * occupant is treated as holding SOME bay in its group - it consumes
   * capacity exactly as it always did - so old bookings keep working and new
   * ones are placed properly alongside them.
   */
  bayId?: string;
  /** yyyy-MM-dd the work starts */
  date: string;
  /** minutes from midnight the work starts (clamped into the working day) */
  startMin: number;
  /** total service minutes (working-time; spills across days) */
  durationMin: number;
  /** display only */
  label?: string;
}

const addDaysISO = (date: string, n: number): string => {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Expand a reservation into the per-day [start,end) windows it holds its bay for.
 *
 * ── DURATION IS ELAPSED TIME, NOT HOURS WORKED ───────────────────────────
 * This CONSUMED working minutes: it took 600 out of each day and carried the
 * rest to the next, so a 2880-minute film became five working days. The
 * studio's own figures are elapsed clock minutes - 2880 is two days, 3600 two
 * and a half, 4320 three - and the difference is not academic: under the old
 * reading every PPF held a bay for more than twice as long as it should, and
 * the studio would have been shown as full for a week.
 *
 * ── AND THE BAY IS HELD OVERNIGHT ────────────────────────────────────────
 * A car mid-wrap is in pieces; it is not rolled out at closing time and back in
 * at nine. So the reservation runs continuously from its start to its end, and
 * every day in between is held in full. The windows returned are clipped to
 * working hours only because that is the resolution bookings are made at -
 * nothing can be booked at 02:00 anyway, so clipping loses nothing and keeps
 * the occupancy map the size it always was.
 */
export const expandIntervals = (
  o: Pick<Occupant, 'date' | 'startMin' | 'durationMin'>,
): { date: string; startMin: number; endMin: number }[] => {
  const out: { date: string; startMin: number; endMin: number }[] = [];
  const duration = Math.max(0, o.durationMin);
  if (duration === 0) return out;

  const start = Math.min(Math.max(o.startMin, DAY_OPEN_MIN), DAY_CLOSE_MIN);
  /* Minutes from midnight on the first day - elapsed, so it runs through the
     night rather than pausing at close. */
  const endAbsolute = start + duration;

  /* Hard cap at 14 calendar days: nothing the studio sells runs longer, and an
     unbounded loop here would be a denial of service on a malformed duration. */
  for (let day = 0; day < 14; day++) {
    const dayStartAbs = day * MINUTES_PER_DAY;
    if (dayStartAbs >= endAbsolute) break;
    const from = Math.max(start, dayStartAbs + DAY_OPEN_MIN);
    const to = Math.min(endAbsolute, dayStartAbs + DAY_CLOSE_MIN);
    if (to > from) {
      out.push({
        date: addDaysISO(o.date, day),
        startMin: from - dayStartAbs,
        endMin: to - dayStartAbs,
      });
    }
  }
  return out;
};

/**
 * THE SAME DURATION, SPREAD ACROSS HOURS SOMEBODY IS ACTUALLY WORKING.
 *
 * `expandIntervals` answers "when is the bay occupied", and the bay is occupied
 * overnight because the car is sitting in it. This answers a different
 * question - "when will the work be finished" - and nobody is polishing at
 * 02:49. An 8-hour ceramic taken in at 18:49 finishes late morning the next
 * day, not before midnight.
 *
 * Both readings are correct and they are not interchangeable; they were one
 * function, which is why the customer-facing promise broke the moment the bay
 * model became elapsed. Two questions, two functions, each named for its own.
 */
export const workingIntervals = (
  o: Pick<Occupant, 'date' | 'startMin' | 'durationMin'>,
): { date: string; startMin: number; endMin: number }[] => {
  const out: { date: string; startMin: number; endMin: number }[] = [];
  let remaining = Math.max(0, o.durationMin);
  let date = o.date;
  let start = Math.min(Math.max(o.startMin, DAY_OPEN_MIN), DAY_CLOSE_MIN);
  for (let day = 0; day < 14 && remaining > 0; day++) {
    const used = Math.min(DAY_CLOSE_MIN - start, remaining);
    if (used > 0) out.push({ date, startMin: start, endMin: start + used });
    remaining -= used;
    date = addDaysISO(date, 1);
    start = DAY_OPEN_MIN;
  }
  return out;
};

/** How many DAYS a reservation touches from a given start minute. */
export const spanDays = (startMin: number, durationMin: number): number =>
  expandIntervals({ date: '2000-01-01', startMin, durationMin }).length;

/**
 * THE LAST DAY THE BAY IS HELD - design screen 08, "Wed 12 – Thu 13 Feb".
 *
 * Derived from the work's own duration rather than stored as a separate
 * customer choice: a two-day PPF is two days because it takes two days, and a
 * bookable `endDate` a customer could pick independently of the work would be a
 * second, contradictable answer to the same question. The engine already
 * expands a reservation across working days for capacity; this reads the last
 * day out of that same expansion, so what the customer is told and what the
 * bay is actually held for cannot drift.
 */
export const spanEndDate = (date: string, startMin: number, durationMin: number): string =>
  expandIntervals({ date, startMin, durationMin }).slice(-1)[0]?.date ?? date;

/** The dates a reservation touches, first to last. */
export const spanDates = (date: string, startMin: number, durationMin: number): string[] =>
  expandIntervals({ date, startMin, durationMin }).map(i => i.date);

/** date → bucketIndex → occupied count, one map per resource. */
export type OccupancyMap = Map<string, number[]>;

const bucketsPerDay = Math.ceil((DAY_CLOSE_MIN - DAY_OPEN_MIN) / BUCKET);
const bucketOf = (min: number) => Math.floor((min - DAY_OPEN_MIN) / BUCKET);

export const buildOccupancy = (occupants: Occupant[], resource: ResourceKey): OccupancyMap => {
  const map: OccupancyMap = new Map();
  for (const o of occupants) {
    if (o.resource !== resource) continue;
    /**
     * THE TURNOVER BUFFER DOES NOT CROSS MIDNIGHT.
     *
     * This added `BUFFER_MIN` to the DURATION and then expanded, so the buffer
     * was carried over the overnight boundary: a 600-minute ceramic became 615,
     * which is one full day plus a quarter of an hour, and that quarter-hour
     * landed at 09:00 the next morning. A whole-day job can only start at 09:00
     * (`candidateSlots`), so a fifteen-minute crumb closed the ENTIRE next day.
     * The owner's rule is that a ceramic blocks one day and a PPF two; with the
     * buffer spilling they blocked two and three.
     *
     * The buffer exists so two jobs do not run into each other on the same bay
     * on the same day. A car collected at close and another started the next
     * morning has had the whole night to turn over. So it extends the LAST
     * interval only, and never past the end of that day.
     */
    const intervals = expandIntervals(o);
    intervals.forEach((iv, i) => {
      const endMin = i === intervals.length - 1
        ? Math.min(iv.endMin + BUFFER_MIN, DAY_CLOSE_MIN)
        : iv.endMin;
      let row = map.get(iv.date);
      if (!row) { row = new Array(bucketsPerDay).fill(0); map.set(iv.date, row); }
      const from = Math.max(0, bucketOf(iv.startMin));
      const to = Math.min(bucketsPerDay - 1, bucketOf(endMin - 1));
      for (let b = from; b <= to; b++) row[b] += 1;
    });
  }
  return map;
};

/**
 * HOW LONG THE CAR IS AWAY, IN WORDS A CUSTOMER USES.
 *
 * ONE implementation, because this sentence appears on the catalogue, in the
 * booking sheet and on the quote, and three copies of it drifted before: the
 * studio page divided by 480 while the floor's day is 600, so a two-day job
 * was advertised as three.
 *
 * Under a working day it is minutes or hours - "60 min", "2h 30m". At a day or
 * more nobody wants a minute count, so it is days, taken from `spanDays` - the
 * same function that decides how many days the bay is actually held for. The
 * promise and the reservation cannot disagree.
 */
export const durationWords = (durationMin: number): string => {
  if (!durationMin || durationMin <= 0) return '';
  if (durationMin < 60) return `${durationMin} min`;
  if (durationMin < WORK_DAY_MIN) {
    const h = Math.floor(durationMin / 60);
    const m = durationMin % 60;
    return m ? `${h}h ${m}m` : `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = spanDays(DAY_OPEN_MIN, durationMin);
  return `${d} day${d === 1 ? '' : 's'}`;
};

/** "Ready in 2 days" / "Estimated time: 60 min" - the customer-facing form. */
export const readyWords = (durationMin: number): string => {
  if (!durationMin || durationMin <= 0) return '';
  return durationMin >= WORK_DAY_MIN
    ? `Ready in ${durationWords(durationMin)}`
    : `Estimated time: ${durationWords(durationMin)}`;
};

/** Candidate start times for a service of this duration (multi-day → opening only). */
export const candidateSlots = (durationMin: number): string[] => {
  if (durationMin >= WORK_DAY_MIN) return ['09:00'];
  const slots: string[] = [];
  // 30-min start granularity regardless of duration - an 8h ceramic can still
  // start 09:30 after a buffered handover instead of losing the whole day
  const step = 30;
  for (let t = DAY_OPEN_MIN; t + durationMin <= DAY_CLOSE_MIN; t += step) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return slots;
};

/**
 * WHICH BAY THIS WORK CAN GO IN, or `null` when none can take it.
 *
 * The whole booking model in one function. A booking holds ONE bay for its
 * entire production duration - across days if the work runs across days - and
 * two bookings may never overlap on the same bay. Groups never block each
 * other: a wash cannot consume a protection bay, and three ceramics do not
 * stop a wash.
 *
 * UNASSIGNED OCCUPANTS ARE PESSIMISTIC. A legacy booking with no `bayId` could
 * be in any bay of its group, so it is counted against ALL of them: if two
 * legacy jobs overlap a candidate window in a three-bay group, one bay remains
 * offerable rather than three. That errs toward refusing a slot, which is the
 * safe direction - the studio can always place the car by hand.
 *
 * Returns the LOWEST-numbered free bay so assignment is deterministic: two
 * servers deciding the same booking reach the same bay, and a test can assert
 * one.
 */
export const assignBay = (
  category: string,
  date: string,
  startMin: number,
  durationMin: number,
  occupants: Occupant[],
  cfg: ResourceConfig,
): Bay | null => {
  const group = categoryToResource(category);
  const bays = baysFor(category, cfg);
  if (bays.length === 0) return null;

  const wanted = expandIntervals({ date, startMin, durationMin });
  const overlaps = (o: Occupant): boolean => {
    if (o.resource !== group) return false;
    /* The held window includes the turnover buffer, which never crosses a
       day - see `buildOccupancy` for why. */
    const held = expandIntervals(o);
    return held.some((h, i) => {
      const end = i === held.length - 1
        ? Math.min(h.endMin + BUFFER_MIN, DAY_CLOSE_MIN)
        : h.endMin;
      return wanted.some(w => w.date === h.date && w.startMin < end && h.startMin < w.endMin);
    });
  };

  const clashing = occupants.filter(overlaps);
  const takenBays = new Set(clashing.filter(o => o.bayId).map(o => o.bayId as string));
  const unassigned = clashing.filter(o => !o.bayId).length;

  const free = bays.filter(b => !takenBays.has(b.id));
  /* Each legacy occupant eats one of whatever is left. */
  return free.length > unassigned ? free[unassigned] ?? null : null;
};

/**
 * Core query: for each requested date, which start slots are FULL for this
 * category+duration, and which whole dates have no room at all.
 */
export const computeAvailability = (
  dates: string[],
  category: string,
  durationMin: number,
  occupants: Occupant[],
  cfg: ResourceConfig,
): { fullSlots: Record<string, string[]>; fullDates: string[] } => {
  const slots = candidateSlots(durationMin);

  const fullSlots: Record<string, string[]> = {};
  const fullDates: string[] = [];
  for (const date of dates) {
    /* FULL MEANS "NO BAY WILL TAKE IT", and it is decided by the same function
       that does the placing. This used to be a separate bucket-tally, so the
       question the customer was answered with ("is this slot free?") and the
       question the server answered on submit ("which bay does it go in?") were
       computed two different ways and could disagree - a slot offered and then
       refused. One function now answers both. */
    const full = slots.filter(s => {
      const [h, m] = s.split(':').map(Number);
      return assignBay(category, date, h * 60 + m, durationMin, occupants, cfg) === null;
    });
    fullSlots[date] = full;
    if (full.length === slots.length) fullDates.push(date);
  }
  return { fullSlots, fullDates };
};

/* ── mapping raw records → occupants (shared by API route + staff UI) ── */

interface BookingLike {
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  serviceCategory: string;
  serviceDurationMinutes?: number;
  vehicleName?: string;
  jobId?: string;
}
interface JobLike {
  status: string;
  source: string;
  date: string;
  createdAt?: { toDate?: () => Date };
  serviceItems: { serviceName: string; category: string }[];
  vehicleName?: string;
}

const ACTIVE_BOOKING = ['pending', 'confirmed', 'vehicle_received', 'in_progress', 'quality_check', 'ready_for_delivery'];
const ACTIVE_JOB = ['checked_in', 'in_progress', 'quality_check', 'ready_for_delivery'];

export const bookingToOccupant = (
  b: BookingLike,
  durationOf: (category: string, serviceName?: string) => number,
): Occupant | null => {
  if (!ACTIVE_BOOKING.includes(b.status)) return null;
  const [h, m] = (b.scheduledTime || '09:00').split(':').map(Number);
  return {
    resource: categoryToResource(b.serviceCategory),
    date: b.scheduledDate,
    startMin: h * 60 + m,
    durationMin: b.serviceDurationMinutes ?? durationOf(b.serviceCategory),
    label: b.vehicleName,
  };
};

/** Walk-in jobs only - booking-linked jobs are already counted via their booking. */
export const walkInJobToOccupant = (
  j: JobLike,
  durationOf: (category: string, serviceName?: string) => number,
): Occupant | null => {
  if (j.source !== 'walk_in' || !ACTIVE_JOB.includes(j.status)) return null;
  const primary = j.serviceItems[0];
  if (!primary) return null;
  const created = j.createdAt?.toDate?.();
  const startMin = created
    ? Math.max(DAY_OPEN_MIN, created.getHours() * 60 + created.getMinutes())
    : DAY_OPEN_MIN;
  const durationMin = j.serviceItems.reduce(
    (s, it) => s + durationOf(it.category, it.serviceName), 0);
  return {
    resource: categoryToResource(primary.category),
    date: j.date,
    startMin,
    durationMin,
    label: j.vehicleName,
  };
};

/** How many days of history can still occupy today (longest service ≈ 3 days + margin). */
export const LOOKBACK_DAYS = 6;
export const lookbackDates = (fromDate: string): string[] =>
  Array.from({ length: LOOKBACK_DAYS }, (_, i) => addDaysISO(fromDate, -(i + 1)));
export { addDaysISO };
