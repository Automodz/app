import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import {
  computeAvailability, bookingToOccupant, walkInJobToOccupant,
  lookbackDates, spanDays, addDaysISO, RESOURCE_DEFAULTS,
  DAY_OPEN_MIN, type Occupant, type ResourceConfig,
} from '@/lib/availability';

export const dynamic = 'force-dynamic';

/**
 * Resource-aware booking availability.
 * POST { dates: string[], category: string, durationMinutes: number }
 *  → { fullSlots: Record<date, string[]>, fullDates: string[] }
 *
 * Server-side because Firestore rules (correctly) stop customers reading other
 * people's bookings and any jobs — but availability is derived from exactly
 * those. The engine itself is pure (lib/availability); this route only feeds it.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await adminAuth!.verifyIdToken(authHeader.slice(7));
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as
    { dates?: string[]; category?: string; durationMinutes?: number } | null;
  const dates = (body?.dates ?? []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 21);
  const category = body?.category;
  const durationMinutes = Math.max(15, Math.min(14 * 600, body?.durationMinutes ?? 60));
  if (!dates.length || !category) {
    return NextResponse.json({ error: 'dates and category required' }, { status: 400 });
  }

  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Range that can overlap the requested dates: lookback (running multi-day
  // work) … last date + the requested service's own span.
  const span = spanDays(DAY_OPEN_MIN, durationMinutes);
  const rangeStart = lookbackDates(first).slice(-1)[0] ?? first;
  const rangeEnd = addDaysISO(last, span);

  const [bookingsSnap, jobsSnap, servicesSnap, cfgSnap] = await Promise.all([
    adminDb!.collection('bookings')
      .where('scheduledDate', '>=', rangeStart)
      .where('scheduledDate', '<=', rangeEnd).get(),
    adminDb!.collection('jobs')
      .where('date', '>=', rangeStart)
      .where('date', '<=', rangeEnd).get(),
    adminDb!.collection('services').get(),
    adminDb!.collection('studioConfig').doc('resources').get(),
  ]);

  const cfg: ResourceConfig = {
    ...RESOURCE_DEFAULTS,
    ...(cfgSnap.exists ? cfgSnap.data() : {}),
  } as ResourceConfig;

  // duration lookup: exact service name first, then category default
  const byName = new Map<string, number>();
  const byCategory = new Map<string, number>();
  servicesSnap.docs.forEach(d => {
    const s = d.data() as { name?: string; category?: string; duration?: number };
    if (s.name && s.duration) byName.set(s.name, s.duration);
    if (s.category && s.duration) {
      byCategory.set(s.category, Math.max(byCategory.get(s.category) ?? 0, s.duration));
    }
  });
  const durationOf = (cat: string, serviceName?: string) =>
    (serviceName && byName.get(serviceName)) || byCategory.get(cat) || 60;

  const occupants: Occupant[] = [];
  bookingsSnap.docs.forEach(d => {
    const o = bookingToOccupant(d.data() as Parameters<typeof bookingToOccupant>[0], durationOf);
    if (o) occupants.push(o);
  });
  jobsSnap.docs.forEach(d => {
    const o = walkInJobToOccupant(d.data() as Parameters<typeof walkInJobToOccupant>[0], durationOf);
    if (o) occupants.push(o);
  });

  const result = computeAvailability(sorted, category, durationMinutes, occupants, cfg);
  return NextResponse.json(result);
}
