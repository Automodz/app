import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import {
  joinMembership, claimMembershipPayment, cancelMembership, decideMembership,
  startMembershipForCustomer, MembershipError,
} from '@/lib/server/membershipService';
import { notifyAdmins } from '@/lib/server/notify';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * THE CLUB - design §15.
 *
 * POST    the customer asks to join, renew or upgrade  (owner; the SERVER
 *                                                       decides plan price,
 *                                                       dates and washes)
 * PATCH   the customer gives a payment reference,      (owner; a CLAIM, and it
 *         or leaves                                     grants nothing)
 * PUT     the studio activates or refuses              (staff; the only write
 *                                                       that grants the Club)
 *
 * Three verbs, and the separation is the security model. Note what has no name
 * anywhere in this file: `amount`, `startDate`, `endDate`, `washesTotal`,
 * `status`. There is no field a caller can set that changes what they are
 * granted, so there is nothing to validate and nothing to forget to validate.
 *
 * This is `/api/payment`'s shape on purpose. Membership and settlement are the
 * same problem - a customer says they have paid, the studio says whether they
 * have - and the product should not have two answers to one question.
 */
const callerOf = (req: NextRequest) =>
  sessionCaller(req, t => adminAuth!.verifyIdToken(t));

const configured = () => {
  try {
    assertAdminConfigured();
    return true;
  } catch {
    return false;
  }
};

const guard = async (req: NextRequest) => {
  if (!configured()) {
    return { res: NextResponse.json({ error: 'Server not configured' }, { status: 503 }) };
  }
  const uid = await callerOf(req);
  if (!uid) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { uid };
};

const failed = async (e: unknown, op: string, uid: string) => {
  if (e instanceof MembershipError) {
    return NextResponse.json({ error: e.code }, { status: e.status });
  }
  await reportError(e, { op, userId: uid });
  return NextResponse.json({ error: 'membership-failed' }, { status: 500 });
};

/** THE CUSTOMER ASKS. Everything but the plan name is the studio's to decide. */
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (g.res) return g.res;
  const uid = g.uid as string;

  const body = await req.json().catch(() => null) as
    { userId?: unknown; plan?: unknown; paymentMethod?: unknown } | null;
  try {
    /* THE STUDIO STARTING ONE AT THE COUNTER names the customer it is for.
       That naming is the whole reason this branch exists - and it is why the
       service checks the caller's own role before it looks at `userId` at all.
       A customer sending `userId` is refused by that check, not by this one. */
    if (body?.userId != null) {
      return NextResponse.json(await startMembershipForCustomer(uid, body));
    }
    const result = await joinMembership(uid, body);
    /**
     * TELL THE STUDIO - from the server, now that there is a server moment.
     *
     * This used to be fired by the browser after its own Firestore write,
     * because there was no other place to hook it. `notifyAdmins` is
     * idempotent per subscription id, so a replayed request cannot produce a
     * second notice.
     */
    if (!result.replay) {
      void notifyAdmins(
        'membership_pending',
        'Membership awaiting payment',
        `A ${result.act} - ₹${result.amountDue} to verify in Admin → Memberships.`,
        { url: '/admin/subscriptions', dedupeKey: result.subscriptionId },
      ).catch(() => {});
    }
    return NextResponse.json(result);
  } catch (e) {
    return failed(e, 'membership.join', uid);
  }
}

/** THE CUSTOMER'S WORD, or their departure. Neither grants anything. */
export async function PATCH(req: NextRequest) {
  const g = await guard(req);
  if (g.res) return g.res;
  const uid = g.uid as string;

  const body = await req.json().catch(() => null) as
    { action?: unknown; subscriptionId?: unknown; reference?: unknown } | null;

  try {
    if (body?.action === 'leave') {
      return NextResponse.json(await cancelMembership(uid, body));
    }
    return NextResponse.json(await claimMembershipPayment(uid, body));
  } catch (e) {
    return failed(e, 'membership.claim', uid);
  }
}

/**
 * THE STUDIO DECIDES. The caller's role is read from THEIR OWN PROFILE inside
 * the service; there is no field in this body that grants authority.
 */
export async function PUT(req: NextRequest) {
  const g = await guard(req);
  if (g.res) return g.res;
  const uid = g.uid as string;

  const body = await req.json().catch(() => null);
  try {
    return NextResponse.json(await decideMembership(uid, body));
  } catch (e) {
    return failed(e, 'membership.decide', uid);
  }
}
