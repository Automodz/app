import { adminDb } from './firebaseAdmin';

/**
 * Per-user retention pass (admin SDK). Called by the authenticated
 * /api/retention/run route AND the daily cron sweep. Idempotent per
 * kind+day, and capped: max 2 retention notifications per user per day
 * so nudges never stack into spam.
 */

type SubscriptionRecord = {
  id: string; plan?: string; endDate?: string;
  washesTotal?: number; washesUsed?: number; status?: string;
};
type BookingRecord = {
  scheduledDate?: string; serviceId?: string; serviceName?: string;
  serviceCategory?: string; vehicleName?: string;
};

const isoDateOnly = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000);

const DAILY_CAP = 2;

export async function runRetentionForUser(uid: string): Promise<{ created: string[]; skipped: string[] }> {
  const result = { created: [] as string[], skipped: [] as string[] };
  const now = new Date();
  const today = isoDateOnly(now);
  let sentToday = 0;

  const createNotif = async (kind: string, title: string, body: string, type: string) => {
    if (sentToday >= DAILY_CAP) { result.skipped.push(kind); return; }
    const id = `ret_${uid}_${kind}_${today}`;
    const ref = adminDb!.collection('notifications').doc(id);
    if ((await ref.get()).exists) { result.skipped.push(kind); return; }
    await ref.set({ userId: uid, title, body, type, read: false, createdAt: new Date() });
    // Send log - CRM communication history + cap accounting
    await adminDb!.collection('notificationLog').add({
      userId: uid, kind, channel: 'in_app', title, date: today, at: new Date(),
    });
    sentToday++;
    result.created.push(kind);
  };

  // Cap accounting includes earlier runs today
  const logSnap = await adminDb!.collection('notificationLog')
    .where('userId', '==', uid).where('date', '==', today).get();
  sentToday = logSnap.size;

  const subSnap = await adminDb!.collection('subscriptions')
    .where('userId', '==', uid).orderBy('createdAt', 'desc').limit(1).get();
  const sub = subSnap.empty ? null
    : ({ id: subSnap.docs[0].id, ...(subSnap.docs[0].data() as Omit<SubscriptionRecord, 'id'>) }) as SubscriptionRecord;

  const lastCompletedSnap = await adminDb!.collection('bookings')
    .where('userId', '==', uid).where('status', '==', 'completed')
    .orderBy('scheduledDate', 'desc').limit(1).get();
  const lastCompleted = lastCompletedSnap.empty ? null : (lastCompletedSnap.docs[0].data() as BookingRecord);
  const lastVisitDate = lastCompleted?.scheduledDate ? new Date(lastCompleted.scheduledDate + 'T12:00:00') : null;

  // Membership expiry + wash allowance
  if (sub && sub.status === 'active' && typeof sub.endDate === 'string') {
    const end = new Date(sub.endDate + 'T23:59:59');
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 3) {
      await createNotif('expiry', 'Membership expiring soon',
        `Your ${sub.plan} membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep your wash benefits.`,
        'membership');
    }
    if (typeof sub.washesTotal === 'number' && typeof sub.washesUsed === 'number') {
      const remaining = Math.max(0, sub.washesTotal - sub.washesUsed);
      if (remaining > 0 && daysLeft > 3) {
        await createNotif('washes_left', 'Washes remaining this month',
          `You still have ${remaining} wash${remaining === 1 ? '' : 'es'} left on your ${sub.plan} plan.`,
          'membership');
      }
    }
  }

  // Protection-expiry nudge
  const PROTECTION_DEFAULT_DAYS: Record<string, number> = { PPF: 1825, Ceramic: 730, Coating: 180 };
  const parseWarrantyDays = (w?: unknown): number | null => {
    if (typeof w !== 'string') return null;
    const m = w.match(/(\d+)\s*(year|month)/i);
    if (!m) return null;
    return Number(m[1]) * (m[2].toLowerCase().startsWith('year') ? 365 : 30);
  };
  const completedSnap = await adminDb!.collection('bookings')
    .where('userId', '==', uid).where('status', '==', 'completed').get();
  const protectionBookings = completedSnap.docs
    .map(d => d.data() as BookingRecord)
    .filter(b => b.serviceCategory && b.serviceCategory in PROTECTION_DEFAULT_DAYS && b.scheduledDate);
  const newestByCategory = new Map<string, BookingRecord>();
  for (const b of protectionBookings) {
    const prev = newestByCategory.get(b.serviceCategory!);
    if (!prev || (b.scheduledDate! > prev.scheduledDate!)) newestByCategory.set(b.serviceCategory!, b);
  }
  for (const [category, b] of newestByCategory) {
    let warrantyDays: number | null = null;
    if (b.serviceId) {
      try {
        const svc = await adminDb!.collection('services').doc(b.serviceId).get();
        warrantyDays = parseWarrantyDays(svc.data()?.warranty);
      } catch { /* default below */ }
    }
    warrantyDays = warrantyDays ?? PROTECTION_DEFAULT_DAYS[category];
    const applied = new Date(b.scheduledDate! + 'T12:00:00');
    const expiry = new Date(applied.getTime() + warrantyDays * 86400000);
    const daysToExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
    if (daysToExpiry >= 0 && daysToExpiry <= 14) {
      await createNotif(`prot_${category.toLowerCase()}`, `${category} protection expiring`,
        `The ${b.serviceName ?? category} on your ${b.vehicleName ?? 'car'} expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}. Book a maintenance coat to stay protected.`,
        'reminder');
    }
  }

  // Re-engagement after 30 days quiet
  if (lastVisitDate) {
    const inactiveDays = daysBetween(now, lastVisitDate);
    if (inactiveDays >= 30) {
      await createNotif('reengage_30d', 'We miss you at AutoModz',
        `It’s been ${inactiveDays} days since your last visit. Book a quick wash or maintenance coat to keep your car protected.`,
        'reminder');
    }
  }

  return result;
}
