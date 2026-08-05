import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { reportError } from '@/lib/server/report';
import { createSellRequestAuthoritative, MarketError } from '@/lib/server/marketService';

export const dynamic = 'force-dynamic';

/**
 * The ONE way a customer offers their car to the studio.
 *
 * Signed in, unlike an enquiry: an offer is the start of a relationship the
 * studio has to be able to come back to, and it appears in the customer's own
 * record afterwards. The uid comes from the verified token and nowhere else,
 * so a caller cannot file an offer in somebody else's name.
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
  let uid: string;
  try {
    uid = (await adminAuth!.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const s = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const n = (v: unknown) => (typeof v === 'number' ? v : Number(s(v) ?? NaN));

  try {
    const id = await createSellRequestAuthoritative({
      userId: uid,
      name: s(body.name) ?? '',
      phone: s(body.phone) ?? '',
      make: s(body.make) ?? '',
      model: s(body.model) ?? '',
      year: n(body.year),
      kmDriven: n(body.kmDriven),
      expectedPrice: n(body.expectedPrice),
      description: s(body.description),
      photos: body.photos,
    });
    return NextResponse.json({ id });
  } catch (e) {
    if (e instanceof MarketError) {
      return NextResponse.json({ error: e.code },
        { status: e.code === 'not-configured' ? 503 : 400 });
    }
    await reportError(e, { op: 'cars.sell', userId: uid });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
