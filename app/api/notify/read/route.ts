import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * A NOTIFICATION THE CUSTOMER HAS NOW SEEN.
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────
 * §17.1 - "the car is the inbox". A notification the customer has not seen
 * surfaces as a MARK on the car it is about, and the mark is a doorway to the
 * object rather than a message in a list. `noticeOf` picks the newest unread
 * one, `Notice.id` is carried into the model with the comment "so consuming
 * the doorway can mark exactly it read" - and nothing ever did.
 *
 * `markNotificationRead` has existed in `lib/services/notifications` since the
 * beginning with no caller anywhere, so `read` was never written by anything
 * on the customer's side. The consequence is not subtle: once the studio sends
 * a notification, that car wears a dot for ever. It survives opening the
 * visit, reading the message and finishing the work. A mark that never clears
 * teaches a customer to ignore every mark, which is the whole signal gone.
 *
 * ── WHY A ROUTE, WHEN THE RULES ALLOW THE WRITE DIRECTLY ─────────────────
 * `firestore.rules` already lets a customer set `read` on their own
 * notification, and only that field. The client service that would use it is
 * the Firebase client SDK, and no customer room carries it - the rooms render
 * on the server and every customer write in this product goes through a route
 * (`/api/addresses`, `/api/booking/create`, `/api/protection`). This is that
 * route, and it enforces the same ownership the rule states, because with the
 * Admin SDK the rule is not consulted at all.
 */
const callerOf = (req: NextRequest) =>
  sessionCaller(req, t => adminAuth!.verifyIdToken(t));

export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'not-configured' }, { status: 503 });
  }

  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) return NextResponse.json({ error: 'id-required' }, { status: 400 });

  try {
    const ref = adminDb!.collection('notifications').doc(id);
    const snap = await ref.get();

    /**
     * A NOTIFICATION THAT IS NOT THEIRS IS NOT FOUND.
     *
     * Not "forbidden": the Admin SDK bypasses rules, so this check IS the
     * rule, and answering 403 would confirm to a caller that some other
     * customer holds a notification at that id. Absent and not-yours are the
     * same answer to somebody who may not have it.
     */
    if (!snap.exists || (snap.data() as { userId?: string })?.userId !== uid) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }

    /* ONE FIELD. The rule permits exactly `read` and nothing else, and this is
       the enforcement of it rather than a looser twin of it. */
    await ref.update({ read: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    reportError(err, { op: 'notification.read', userId: uid });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
