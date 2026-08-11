/**
 * ADD TO CALENDAR — design screen 09.
 *
 * A calendar event GENERATED FROM THE BOOKING, never a template with the
 * booking's words dropped into it. The distinction is the whole feature: a
 * static `.ics` with a fixed hour is a file that lies the moment somebody moves
 * their visit, and moving a visit is screen 10's entire purpose.
 *
 * Pure, like every engine here — it is handed the facts and returns text. It
 * reads no clock it is not given, holds no address, and touches no database.
 *
 * ── WHAT MAKES THIS CORRECT RATHER THAN MERELY VALID ─────────────────────
 * · The times are studio-local wall clock (`lib/os/lifecycle`), converted to
 *   UTC exactly once, here. A booking at 09:00 in Ahmedabad must land at 09:00
 *   in the owner's calendar, and it will not if the string is parsed in the
 *   server's zone.
 * · `UID` is derived from the booking id, so importing the same visit twice
 *   UPDATES the event rather than making a second one — and a rescheduled
 *   visit re-imported replaces the old time instead of leaving both.
 * · `SEQUENCE` rises with every change, which is what tells a calendar client
 *   that this version supersedes the one it already has.
 * · Nothing private travels in it. No price, no phone number, no invoice — a
 *   calendar file is forwarded, synced to third-party servers and read on
 *   shared screens (§22.1).
 */

/** RFC 5545 wants CRLF, and clients that tolerate LF are not the only clients. */
const CRLF = '\r\n';

/**
 * Escape a value for a text field: backslash, semicolon, comma and newline all
 * carry meaning in the grammar and would otherwise split a field in two.
 */
const esc = (s: string): string =>
  s.replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Lines fold at 75 octets. Long descriptions are common and an unfolded one is
 * the single most frequent reason a file is rejected.
 */
const fold = (line: string): string => {
  if (line.length <= 73) return line;
  const parts: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join(CRLF);
};

/** `20260812T033000Z` — UTC, which is the only form every client agrees on. */
export const icsStamp = (ms: number): string => {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`
    + `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
};

export interface CalendarEvent {
  /** Stable across every export of this booking. */
  uid: string;
  startMs: number;
  endMs: number;
  summary: string;
  description?: string;
  location?: string;
  /** Rises on every change; a calendar uses it to supersede what it holds. */
  sequence?: number;
  /** A cancelled visit exports as a cancellation, so the event disappears. */
  cancelled?: boolean;
  /** Injected, so a snapshot test is not a clock test. */
  stampMs?: number;
}

/**
 * One event, as a complete `.ics` document.
 *
 * `METHOD:PUBLISH` rather than `REQUEST`: this is the studio telling an owner
 * when their car is expected, not an invitation that wants an RSVP back.
 */
export function toICS(e: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AutoModz//Studio//EN',
    'CALSCALE:GREGORIAN',
    e.cancelled ? 'METHOD:CANCEL' : 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${esc(e.uid)}`,
    `DTSTAMP:${icsStamp(e.stampMs ?? e.startMs)}`,
    `DTSTART:${icsStamp(e.startMs)}`,
    `DTEND:${icsStamp(e.endMs)}`,
    `SEQUENCE:${Math.max(0, Math.floor(e.sequence ?? 0))}`,
    `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    `SUMMARY:${esc(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join(CRLF) + CRLF;
}

/**
 * A booking's calendar event, derived.
 *
 * `endMs` comes from the work's own duration, so a two-day PPF blocks two days
 * in the owner's calendar and a wash blocks an hour. A fixed length would be
 * the template this function exists to avoid.
 */
export function eventForBooking(b: {
  id: string;
  serviceName: string;
  vehicleName: string;
  startMs: number;
  durationMinutes: number;
  address: string;
  cancelled?: boolean;
  /** How many times it has been moved. */
  sequence?: number;
  /** Named only when the studio is collecting the car. */
  pickup?: boolean;
  stampMs?: number;
}): CalendarEvent {
  const minutes = Number.isFinite(b.durationMinutes) && b.durationMinutes > 0
    ? b.durationMinutes : 60;
  return {
    uid: `booking-${b.id}@automodz`,
    startMs: b.startMs,
    endMs: b.startMs + minutes * 60_000,
    summary: `${b.serviceName} — ${b.vehicleName}`,
    description: b.pickup
      ? 'AutoModz will collect the car. Nothing is charged now; you approve the final figure at handover.'
      : 'Nothing is charged now. You approve the final figure at handover.',
    location: b.address,
    sequence: b.sequence,
    cancelled: b.cancelled,
    stampMs: b.stampMs,
  };
}
