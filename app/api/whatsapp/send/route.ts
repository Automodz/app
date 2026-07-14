import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * OPTIONAL WhatsApp Cloud API sender.
 * Off by default - activates only when WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID
 * env vars are set (Meta for Developers → WhatsApp → API Setup).
 * Without them the app keeps using free wa.me deep links; nothing breaks.
 *
 * NOTE: messages to customers who haven't messaged you in the last 24h must use
 * pre-approved templates (Meta approval + small per-message fee). Free-form text
 * like this works inside an open 24h customer-service window.
 */
export async function POST(req: NextRequest) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return NextResponse.json({ skipped: true, reason: 'WhatsApp API not configured' }, { status: 200 });
  }

  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const decoded = await adminAuth!.verifyIdToken(authHeader.slice(7));
    const caller = await adminDb!.collection('users').doc(decoded.uid).get();
    if (caller.data()?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { phone, message } = await req.json() as { phone?: string; message?: string };
  if (!phone || !message) return NextResponse.json({ error: 'phone, message required' }, { status: 400 });

  const to = `91${phone.replace(/\D/g, '').slice(-10)}`;
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('WhatsApp send failed', err);
    return NextResponse.json({ error: 'send failed' }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
