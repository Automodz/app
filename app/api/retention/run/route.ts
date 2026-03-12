import { NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';

type RetentionResult = {
  created: string[];
  skipped: string[];
};

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / 86400000);
}

export async function POST(req: Request) {
  try {
    assertAdminConfigured();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Admin not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });

  const decoded = await adminAuth!.verifyIdToken(token);
  const uid = decoded.uid;

  const userSnap = await adminDb!.collection('users').doc(uid).get();
  if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const result: RetentionResult = { created: [], skipped: [] };
  const now = new Date();
  const today = isoDateOnly(now);

  // Fetch latest subscription
  const subSnap = await adminDb!
    .collection('subscriptions')
    .where('userId', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  const sub = subSnap.empty ? null : ({ id: subSnap.docs[0].id, ...subSnap.docs[0].data() } as any);

  // Fetch last completed booking for re-engagement + lastVisitDate
  const lastCompletedSnap = await adminDb!
    .collection('bookings')
    .where('userId', '==', uid)
    .where('status', '==', 'completed')
    .orderBy('scheduledDate', 'desc')
    .limit(1)
    .get();
  const lastCompleted = lastCompletedSnap.empty ? null : (lastCompletedSnap.docs[0].data() as any);

  const lastVisitDate = lastCompleted?.scheduledDate ? new Date(lastCompleted.scheduledDate + 'T12:00:00') : null;

  // Helper to create an idempotent notification
  const createNotif = async (kind: string, title: string, body: string, type: string) => {
    const id = `ret_${uid}_${kind}_${today}`;
    const ref = adminDb!.collection('notifications').doc(id);
    const existing = await ref.get();
    if (existing.exists) {
      result.skipped.push(kind);
      return;
    }
    await ref.set({
      userId: uid,
      title,
      body,
      type,
      read: false,
      createdAt: new Date(),
    });
    result.created.push(kind);
  };

  // Membership expiry reminder
  if (sub && sub.status === 'active' && typeof sub.endDate === 'string') {
    const end = new Date(sub.endDate + 'T23:59:59');
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);

    if (daysLeft >= 0 && daysLeft <= 3) {
      await createNotif(
        'expiry',
        'Membership expiring soon',
        `Your ${sub.plan} membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep your wash benefits.`,
        'membership',
      );
    }

    // Wash allowance reminder (only when they still have washes and enough time left)
    if (typeof sub.washesTotal === 'number' && typeof sub.washesUsed === 'number') {
      const remaining = Math.max(0, sub.washesTotal - sub.washesUsed);
      if (remaining > 0 && daysLeft > 3) {
        await createNotif(
          'washes_left',
          'Washes remaining this month',
          `You still have ${remaining} wash${remaining === 1 ? '' : 'es'} left on your ${sub.plan} plan.`,
          'membership',
        );
      }
    }
  }

  // Re-engagement if no visit in 30 days
  if (lastVisitDate) {
    const inactiveDays = daysBetween(now, lastVisitDate);
    if (inactiveDays >= 30) {
      await createNotif(
        'reengage_30d',
        'We miss you at AutoModz',
        `It’s been ${inactiveDays} days since your last visit. Book a quick wash or maintenance coat to keep your car protected.`,
        'reminder',
      );
    }
  }

  return NextResponse.json({ ok: true, ...result });
}

