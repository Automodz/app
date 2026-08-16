import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { loadOccupancy, occupancyRange, type Reader } from '@/lib/server/occupancy';
import { loadCatalogue } from '@/lib/server/catalogue';
import { computeAvailability } from '@/lib/availability';

export const dynamic = 'force-dynamic';

/**
 * Resource-aware booking availability.
 * POST { dates: string[], category: string, durationMinutes: number }
 *  → { fullSlots: Record<date, string[]>, fullDates: string[] }
 *
 * Server-side because Firestore rules (correctly) stop customers reading other
 * people's bookings and any jobs - but availability is derived from exactly
 * those.
 *
 * This route OFFERS a slot; the Booking Service ACCEPTS one. Both read the same
 * bays through `loadOccupancy`, because two copies of that query would
 * eventually disagree and the customer would be shown a time the writer then
 * refuses. The engine itself is pure (lib/availability); this route only feeds
 * it and hands back the answer.
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

  const { sorted, rangeStart, rangeEnd } = occupancyRange(dates, durationMinutes);
  // outside a transaction the collection handles read for themselves
  const reader = { get: (x: { get(): unknown }) => x.get() } as unknown as Reader;
  /* The booking sheet calls this on every change of service, day or duration,
     and it read the whole `services` collection each time for durations alone.
     Read-only path, so the cached price list serves it; the WRITER still reads
     inside its transaction (`lib/server/bookingService`). */
  const { occupants, cfg } = await loadOccupancy(reader, rangeStart, rangeEnd, {
    catalogue: await loadCatalogue(),
  });

  return NextResponse.json(
    computeAvailability(sorted, category, durationMinutes, occupants, cfg),
  );
}
