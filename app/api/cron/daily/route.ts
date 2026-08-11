import { NextRequest, NextResponse } from 'next/server';
import { adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { runRetentionForUser } from '@/lib/server/retention';
import { notifyAdmins as notifyAdminsShared } from '@/lib/server/notify';
import { isLapsed } from '@/lib/os/club';
import { expireBookingAuthoritative } from '@/lib/server/bookingService';
import { announceBookingClosed } from '@/lib/server/bookingNotify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily automation sweep - the backbone that makes reminders reach people
 * who DON'T open the app. Triggered by Vercel Cron (vercel.json); protected
 * by CRON_SECRET (Vercel sends it as the Authorization bearer automatically).
 *
 * Runs:
 *  1. Retention pass for every customer (expiry, protection, win-back - capped)
 *  2. Low-stock check → admin notification
 *  3. Receivables aging (>3 days unpaid) → admin notification
 *  4. Pending memberships waiting on verification → admin notification
 *  5. Stale bookings aged out of `pending`/`confirmed` into `expired`
 *  6. Daily aggregate doc (dailyStats/YYYY-MM-DD) for fast reports
 */
export async function GET(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  /* FAIL CLOSED. This was `if (secret && ...)`, so an unset CRON_SECRET left a
     public GET that fans out push notifications and in-app messages to every
     customer on the books - a spam cannon anyone could fire, repeatedly. An
     unconfigured cron must not run at all rather than run for the world. */
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const summary: Record<string, number> = {};

  // Admin notifications (in-app + push + log), idempotent per kind+day
  const notifyAdmins = (kind: string, title: string, body: string) =>
    notifyAdminsShared(kind, title, body, { dedupeKey: today });

  // 1. Retention for all customers (bounded; ~sequential to stay in quota)
  const users = await adminDb!.collection('users').where('role', '==', 'customer').get();
  let retentionCreated = 0;
  for (const u of users.docs) {
    try {
      const r = await runRetentionForUser(u.id);
      retentionCreated += r.created.length;
    } catch { /* one bad user never kills the sweep */ }
  }
  summary.retentionCreated = retentionCreated;

  // 2. Low stock
  const items = await adminDb!.collection('inventoryItems').where('active', '==', true).get();
  const low = items.docs
    .map(d => d.data() as { name: string; stockQty: number; lowStockThreshold: number })
    .filter(i => (i.stockQty ?? 0) <= (i.lowStockThreshold ?? 0));
  if (low.length > 0) {
    await notifyAdmins('low_stock', `${low.length} item${low.length === 1 ? '' : 's'} low on stock`,
      low.slice(0, 5).map(i => `${i.name} (${i.stockQty})`).join(', ') + ' - reorder soon.');
  }
  summary.lowStock = low.length;

  // 3. Receivables aging - completed jobs unpaid for 3+ days
  const unpaid = await adminDb!.collection('jobs')
    .where('status', '==', 'completed').where('paymentStatus', '==', 'pending').get();
  const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  const aged = unpaid.docs
    .map(d => d.data() as { customerName: string; totalAmount: number; amountPaid?: number; date: string })
    .filter(j => j.date <= cutoff);
  if (aged.length > 0) {
    const owed = aged.reduce((s, j) => s + j.totalAmount - (j.amountPaid ?? 0), 0);
    await notifyAdmins('receivables', `₹${owed.toLocaleString('en-IN')} outstanding 3+ days`,
      `${aged.length} delivered job${aged.length === 1 ? '' : 's'} still unpaid - see Invoices → Outstanding.`);
  }
  summary.agedReceivables = aged.length;

  // 4. Memberships waiting on verification
  const pendingSubs = await adminDb!.collection('subscriptions')
    .where('status', '==', 'pending').get();
  if (pendingSubs.size > 0) {
    await notifyAdmins('pending_memberships', `${pendingSubs.size} membership${pendingSubs.size === 1 ? '' : 's'} awaiting verification`,
      'Verify the payment and activate them in Admin → Memberships.');
  }
  summary.pendingMemberships = pendingSubs.size;

  /* 4b. EXPIRE MEMBERSHIPS THAT HAVE RUN OUT.
     `expireLapsedSubscriptions` existed but ran ONLY when an admin happened to
     open Admin → Memberships. Until someone did, a lapsed membership stayed
     `active` in the database — the customer saw the truth (both the club engine
     and the read path compute expiry), but every QUERY that filters on status
     counted them as members. Nightly is where this belongs.

     The rule is `os/club.isLapsed`, shared with the client service, so the two
     cannot disagree about what "run out" means. */
  const activeSubs = await adminDb!.collection('subscriptions')
    .where('status', '==', 'active').get();
  const lapsed = activeSubs.docs.filter(d => isLapsed(d.data() as { status?: string; endDate?: string }));
  await Promise.all(lapsed.map(d =>
    d.ref.update({ status: 'expired', updatedAt: new Date() }),
  ));
  summary.expiredMemberships = lapsed.length;

  /* 4c. AGE OUT REQUESTS THE STUDIO NEVER ANSWERED.
     Three bookings sat `pending` thirteen to seventeen days past the day they
     asked for. They were correctly excluded from "upcoming", which meant the
     customer could not see them, could not cancel them, and were never told
     the studio was not going to answer. A record with no terminal state does
     not resolve; it just stops being looked at.

     `expired` is not `cancelled` (lib/os/lifecycle) — nobody decided this. The
     service is idempotent and re-checks the clock inside its own transaction,
     so a second sweep on the same day writes nothing. */
  const stale = await adminDb!.collection('bookings')
    .where('status', 'in', ['pending', 'confirmed'])
    .where('scheduledDate', '<=', new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10))
    .get();
  let expiredBookings = 0;
  for (const d of stale.docs) {
    try {
      const r = await expireBookingAuthoritative(d.id);
      if (r.expired) {
        expiredBookings++;
        const b = d.data() as {
          userId: string; vehicleId: string; vehicleName: string; serviceName: string;
        };
        /* Told, in the studio's own words. An unanswered request that simply
           vanishes is the studio deciding not to explain itself. */
        await announceBookingClosed({ id: d.id, ...b }, 'booking_expired');
      }
    } catch { /* one stale booking never kills the sweep */ }
  }
  summary.expiredBookings = expiredBookings;

  // 5. Daily aggregate for fast reports (yesterday's numbers are final)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const [dayJobs, dayBookings, dayExpenses] = await Promise.all([
    adminDb!.collection('jobs').where('date', '==', yesterday).get(),
    adminDb!.collection('bookings').where('scheduledDate', '==', yesterday).get(),
    adminDb!.collection('expenses').where('date', '==', yesterday).get(),
  ]);
  const jobDocs = dayJobs.docs.map(d => d.data() as {
    status: string; totalAmount: number; payments?: { method: string; amount: number; date: string }[];
  });
  const completedJobs = jobDocs.filter(j => j.status === 'completed');
  let cash = 0, upi = 0;
  for (const j of jobDocs) for (const p of j.payments ?? []) {
    if (p.date !== yesterday) continue;
    if (p.method === 'cash') cash += p.amount; else upi += p.amount;
  }
  const bookingDocs = dayBookings.docs.map(d => d.data() as { status: string; totalAmount: number });
  const completedBookings = bookingDocs.filter(b => b.status === 'completed');
  await adminDb!.collection('dailyStats').doc(yesterday).set({
    date: yesterday,
    jobRevenue: completedJobs.reduce((s, j) => s + j.totalAmount, 0),
    bookingRevenue: completedBookings.reduce((s, b) => s + b.totalAmount, 0),
    jobsCompleted: completedJobs.length,
    bookingsCompleted: completedBookings.length,
    cashReceived: cash, upiReceived: upi,
    expenses: dayExpenses.docs.reduce((s, d) => s + ((d.data() as { amount?: number }).amount ?? 0), 0),
    computedAt: new Date(),
  }, { merge: true });

  return NextResponse.json({ ok: true, date: today, ...summary });
}
