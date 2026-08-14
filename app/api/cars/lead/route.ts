import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { reportError } from '@/lib/server/report';
import { createLeadAuthoritative, MarketError } from '@/lib/server/marketService';

export const dynamic = 'force-dynamic';

/**
 * The ONE way an enquiry about a car is recorded.
 *
 * DELIBERATELY OPEN TO SIGNED-OUT CALLERS. `/cars` is public, and requiring an
 * account before someone may ask about a car is a sale thrown away. But open
 * is not unguarded: the write happens with the Admin SDK behind this route, so
 * the Firestore rule that used to allow anonymous creates on `carLeads` is now
 * closed, and every field the studio reads is derived from the listing rather
 * than taken from the body.
 *
 * A token is USED IF PRESENT and never required - a signed-in customer's lead
 * is stamped with their uid so the studio can see the two are the same person.
 * The uid is only ever taken from a verified token, never from the body.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  let userId: string | undefined;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      userId = (await adminAuth!.verifyIdToken(authHeader.slice(7))).uid;
    } catch {
      /* A bad token on an endpoint that does not need one is not an error -
         the enquiry proceeds as an anonymous one rather than being refused. */
      userId = undefined;
    }
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const s = (v: unknown) => (typeof v === 'string' ? v : undefined);

  try {
    const id = await createLeadAuthoritative({
      listingId: s(body.listingId) ?? '',
      type: body.type === 'viewing' ? 'viewing' : 'inquiry',
      name: s(body.name) ?? '',
      phone: s(body.phone) ?? '',
      message: s(body.message),
      preferredDate: s(body.preferredDate),
      preferredTime: s(body.preferredTime),
      userId,
    });
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof MarketError) {
      const status = e.code === 'listing-unavailable' ? 409
        : e.code === 'not-configured' ? 503 : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    await reportError(e, { op: 'cars.lead', userId });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
