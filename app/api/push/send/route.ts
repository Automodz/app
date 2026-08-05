import { NextRequest, NextResponse } from 'next/server';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Fan out a web-push notification to all of a user's registered devices.
 * Caller must be the admin (kiosk / admin panel session).
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
  let callerUid: string;
  try {
    const decoded = await adminAuth!.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  const caller = await adminDb!.collection('users').doc(callerUid).get();
  if (caller.data()?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, title, body, url } = await req.json() as {
    userId?: string; title?: string; body?: string; url?: string;
  };
  if (!userId || !title || !body) {
    return NextResponse.json({ error: 'userId, title, body required' }, { status: 400 });
  }

  const tokensSnap = await adminDb!.collection('users').doc(userId).collection('fcmTokens').get();
  const tokens = tokensSnap.docs.map(d => d.id);
  if (tokens.length === 0) return NextResponse.json({ sent: 0 });

  const messaging = getMessaging(getApps()[0]);
  const res = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { url: url ?? '/' },
    webpush: {
      notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
      fcmOptions: { link: url ?? '/' },
    },
  });

  // Prune dead tokens so the list stays clean
  await Promise.all(res.responses.map((r, i) => {
    const code = (r.error as { code?: string } | undefined)?.code ?? '';
    if (!r.success && (code.includes('registration-token-not-registered') || code.includes('invalid-argument'))) {
      return adminDb!.collection('users').doc(userId).collection('fcmTokens').doc(tokens[i]).delete();
    }
    return Promise.resolve();
  }));

  return NextResponse.json({ sent: res.successCount, failed: res.failureCount });
}
