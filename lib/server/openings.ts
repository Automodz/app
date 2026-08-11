import 'server-only';
/**
 * WHEN THE STUDIO CAN NEXT TAKE THIS WORK.
 *
 * Design screen 03 ("Next opening · Thu 9:00 am"), screen 08 (the day strip)
 * and screen 10 ("Next openings" chips) all ask one question, and until now
 * each answered it differently or not at all: Home stated a next opening that
 * nothing computed, the booking sheet fetched `/api/availability` from the
 * browser, and Manage offered no dates whatsoever.
 *
 * One answer, from the SAME occupancy the Booking Service accepts against
 * (`lib/server/occupancy`), so a day offered here cannot be a day the writer
 * then refuses.
 */
import { adminDb } from './firebaseAdmin';
import { loadOccupancy, occupancyRange, type Reader } from './occupancy';
import { computeAvailability, candidateSlots, addDaysISO } from '@/lib/availability';

/** Outside a transaction, the refs and queries read for themselves. */
const directReader = { get: (x: { get(): unknown }) => x.get() } as unknown as Reader;

export interface Opening {
  /** YYYY-MM-DD */
  date: string;
  /** The earliest start the studio can give that day. */
  time: string;
}

/**
 * The next open starts for a piece of work, soonest first.
 *
 * `excludeBookingId` lets the Manage screen offer the days a booking could move
 * to without its own reservation standing in the way of the move.
 *
 * Returns `[]` — never a guess — when the database is unreachable. An invented
 * opening is a customer told to come on a day the studio is full.
 */
export async function nextOpenings(args: {
  category: string;
  durationMinutes: number;
  /** How many open days to return. */
  limit?: number;
  /** How far ahead to look. */
  horizonDays?: number;
  from?: string;
  excludeBookingId?: string;
}): Promise<Opening[]> {
  if (!adminDb) return [];

  const limit = args.limit ?? 3;
  const horizon = args.horizonDays ?? 21;
  const start = args.from ?? new Date().toISOString().slice(0, 10);
  const dates = Array.from({ length: horizon }, (_, i) => addDaysISO(start, i));

  try {
    const { rangeStart, rangeEnd } = occupancyRange(dates, args.durationMinutes);
    const { occupants, cfg } = await loadOccupancy(directReader, rangeStart, rangeEnd, {
      excludeBookingIds: args.excludeBookingId ? [args.excludeBookingId] : undefined,
    });
    const { fullSlots } = computeAvailability(
      dates, args.category, args.durationMinutes, occupants, cfg,
    );

    const slots = candidateSlots(args.durationMinutes);
    const out: Opening[] = [];
    for (const date of dates) {
      const taken = new Set(fullSlots[date] ?? []);
      const first = slots.find(s => !taken.has(s));
      if (first) out.push({ date, time: first });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
