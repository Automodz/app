import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import {
  requestApproval, respondToApproval, ApprovalError,
} from '@/lib/server/approvalService';
import { recordEvent } from '@/lib/server/events';
import { notifyAdmins } from '@/lib/server/notify';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * MID-VISIT APPROVAL - design screen 12, both sides of it.
 *
 * POST   the studio ASKS      (staff only)
 * PATCH  the customer ANSWERS (owner only)
 *
 * The split is the whole security model and it is deliberately two verbs on
 * one route rather than two routes: the pair has to be read together, because
 * the guarantee is that no caller can do both. Staff cannot answer - the
 * transition table refuses `approved` and `declined` to the studio - and a
 * customer cannot ask, because asking sets a price.
 */
/**
 * THE CALLER - a bearer token, or the session cookie the rooms already use.
 *
 * The two sessions lapse independently, so a customer can reach a room that
 * renders perfectly and find its one control claiming they are signed out.
 * The cookie fallback is same-origin only; see `lib/server/session.ts`.
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

/** THE STUDIO ASKS. Staff are recognised from their own profile, never a body. */
export async function POST(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await adminDb!.collection('users').doc(uid).get();
  const role = (profile.data()?.role as string) ?? '';
  if (!['admin', 'employee'].includes(role)) {
    return NextResponse.json({ error: 'staff-only' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  try {
    const approval = await requestApproval({
      jobId: s(body.jobId),
      reason: s(body.reason),
      detail: s(body.detail),
      photos: Array.isArray(body.photos)
        ? (body.photos as { url: string; caption: string }[]).slice(0, 6) : [],
      label: s(body.label),
      price: Number(body.price),
      minutes: Number(body.minutes ?? 0),
      /* Recorded for the studio's own audit. It never reaches a customer
         surface - §2.2, no individual is ever named. */
      byEmployeeId: s(body.byEmployeeId) || uid,
    });

    /* The customer is told, and this one BREAKS THROUGH QUIET MODE: a car is
       held on a bay until they answer, so silence costs them the day. */
    await recordEvent({
      type: 'approval_requested',
      customerId: approval.customerId,
      source: { kind: 'approval', id: approval.id },
      vehicleId: approval.vehicleId,
      subject: approval.vehicleName || 'your car',
      detail: approval.reason,
    });

    return NextResponse.json(approval);
  } catch (e) {
    if (e instanceof ApprovalError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'approval.request', userId: uid });
    return NextResponse.json({ error: 'request-failed' }, { status: 500 });
  }
}

/** THE CUSTOMER ANSWERS. Ownership is checked inside the transaction. */
export async function PATCH(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    { approvalId?: string; answer?: string } | null;
  const approvalId = typeof body?.approvalId === 'string' ? body.approvalId : '';
  const answer = body?.answer === 'approved' ? 'approved'
    : body?.answer === 'declined' ? 'declined' : null;
  if (!approvalId || !answer) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  try {
    const result = await respondToApproval(uid, approvalId, answer);

    /* Announced only on a genuine answer. A replay already announced itself,
       and telling the studio twice would put two rows on a board a human
       reads. */
    if (!result.replayed) {
      await notifyAdmins(
        `approval_${result.status}`,
        result.status === 'approved' ? 'Extra work approved' : 'Extra work declined',
        result.status === 'approved'
          ? 'The customer approved the extra stage. Carry on.'
          : 'The customer declined. Continue as planned.',
        { url: '/admin/jobs', dedupeKey: approvalId },
      );
      await recordEvent({
        type: result.status === 'approved' ? 'approval_approved' : 'approval_declined',
        customerId: uid,
        source: { kind: 'approval', id: approvalId },
        subject: 'the extra work',
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApprovalError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'approval.respond', userId: uid, extra: { approvalId } });
    return NextResponse.json({ error: 'respond-failed' }, { status: 500 });
  }
}
