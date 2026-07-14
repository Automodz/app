import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { notifyAdmins } from '@/lib/server/notify';

export const dynamic = 'force-dynamic';

/**
 * Client-fired ops events → owner notification (in-app + push).
 * The caller must OWN the referenced document - verified server-side, so a
 * hostile client can't spam the owner with fabricated events.
 *
 * Events:
 *  - booking_created  { bookingId }
 *  - membership_pending { subscriptionId }
 *  - quote_requested { quoteId }
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

  const { event, id } = await req.json() as { event?: string; id?: string };
  if (!event || !id) return NextResponse.json({ error: 'event, id required' }, { status: 400 });

  if (event === 'booking_created') {
    const snap = await adminDb!.collection('bookings').doc(id).get();
    const b = snap.data() as {
      userId?: string; userName?: string; serviceName?: string;
      vehicleName?: string; scheduledDate?: string; scheduledTime?: string; totalAmount?: number;
    } | undefined;
    if (!b || b.userId !== uid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await notifyAdmins('booking_created',
      `New booking · ${b.userName}`,
      `${b.serviceName} - ${b.vehicleName} · ${b.scheduledDate} ${b.scheduledTime} · ₹${(b.totalAmount ?? 0).toLocaleString('en-IN')}`,
      { url: '/admin/bookings', dedupeKey: id });
    return NextResponse.json({ ok: true });
  }

  if (event === 'quote_requested') {
    const snap = await adminDb!.collection('quotes').doc(id).get();
    const q = snap.data() as { customerId?: string; customerName?: string; serviceCategory?: string; vehicleName?: string } | undefined;
    if (!q || q.customerId !== uid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await notifyAdmins('quote_requested',
      `Quote request · ${q.customerName}`,
      `${q.serviceCategory} for ${q.vehicleName} - price it in Admin → Quotes.`,
      { url: '/admin/quotes', dedupeKey: id });
    return NextResponse.json({ ok: true });
  }

  if (event === 'membership_pending') {
    const snap = await adminDb!.collection('subscriptions').doc(id).get();
    const s = snap.data() as { userId?: string; userName?: string; plan?: string } | undefined;
    if (!s || s.userId !== uid) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await notifyAdmins('membership_pending',
      `Membership purchase · ${s.userName}`,
      `${s.plan} plan awaiting payment verification - activate in Admin → Memberships.`,
      { url: '/admin/subscriptions', dedupeKey: id });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
}
