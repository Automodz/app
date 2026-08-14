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

export type ResourceKey = 'wash' | 'protection';

export interface ResourceConfig {
  /** Simultaneous wash vehicles (Studio Settings → Resources; the studio runs 1). */
  washCapacity: number;
}
export const RESOURCE_DEFAULTS: ResourceConfig = { washCapacity: 1 };

/** Turnover buffer between consecutive jobs on the same resource. */
export const BUFFER_MIN = 15;

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  wash: 'Wash Bay', protection: 'Protection Bay',
};

/** Which physical resource a service category occupies. */
export const categoryToResource = (category: string): ResourceKey =>
  category === 'Washing' ? 'wash' : 'protection';

export const resourceCapacity = (r: ResourceKey, cfg: ResourceConfig): number =>
  r === 'wash' ? Math.max(1, cfg.washCapacity) : 1;

/** One reservation the engine schedules around. */
export interface Occupant {
  resource: ResourceKey;
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

/** Expand a reservation into per-working-day [start,end) minute intervals. */
export const expandIntervals = (
  o: Pick<Occupant, 'date' | 'startMin' | 'durationMin'>,
): { date: string; startMin: number; endMin: number }[] => {
  const out: { date: string; startMin: number; endMin: number }[] = [];
  let remaining = Math.max(0, o.durationMin);
  let date = o.date;
  let start = Math.min(Math.max(o.startMin, DAY_OPEN_MIN), DAY_CLOSE_MIN);
  // hard cap at 14 working days - nothing the studio sells runs longer
  for (let day = 0; day < 14 && remaining > 0; day++) {
    const avail = DAY_CLOSE_MIN - start;
    const used = Math.min(avail, remaining);
    if (used > 0) out.push({ date, startMin: start, endMin: start + used });
    remaining -= used;
    date = addDaysISO(date, 1);
    start = DAY_OPEN_MIN;
  }
  return out;
};

/** How many working days a duration spans from a given start minute. */
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
    // hold the resource for the job + turnover buffer
    for (const iv of expandIntervals({ ...o, durationMin: o.durationMin + BUFFER_MIN })) {
      let row = map.get(iv.date);
      if (!row) { row = new Array(bucketsPerDay).fill(0); map.set(iv.date, row); }
      const from = Math.max(0, bucketOf(iv.startMin));
      const to = Math.min(bucketsPerDay - 1, bucketOf(iv.endMin - 1));
      for (let b = from; b <= to; b++) row[b] += 1;
    }
  }
  return map;
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

const slotBlocked = (
  occ: OccupancyMap, capacity: number,
  date: string, startMin: number, durationMin: number,
): boolean => {
  for (const iv of expandIntervals({ date, startMin, durationMin })) {
    const row = occ.get(iv.date);
    if (!row) continue;
    const from = Math.max(0, bucketOf(iv.startMin));
    const to = Math.min(bucketsPerDay - 1, bucketOf(iv.endMin - 1));
    for (let b = from; b <= to; b++) if (row[b] >= capacity) return true;
  }
  return false;
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
  const resource = categoryToResource(category);
  const capacity = resourceCapacity(resource, cfg);
  const occ = buildOccupancy(occupants, resource);
  const slots = candidateSlots(durationMin);

  const fullSlots: Record<string, string[]> = {};
  const fullDates: string[] = [];
  for (const date of dates) {
    const full = slots.filter(s => {
      const [h, m] = s.split(':').map(Number);
      return slotBlocked(occ, capacity, date, h * 60 + m, durationMin);
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
