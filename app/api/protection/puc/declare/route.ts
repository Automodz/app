import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import { declarePuc, PucError } from '@/lib/server/pucService';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * DECLARE A POLLUTION CERTIFICATE.
 *
 * The customer's own half of the act, and the whole of what a browser may do:
 * it states a fact about a piece of paper. It creates no Protection, changes
 * nothing about the car, and cannot - `firestore.rules` refuses every client
 * write to `declarations` and to `protections`, so this route is not merely
 * the preferred door, it is the only one.
 *
 * Ownership is proven server-side by looking for the car UNDER the session's
 * own uid. Nothing in the body establishes who is asking.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  /* A bearer token, or the session cookie the rooms already use. The cookie
     path is same-origin only - see lib/server/session.ts for why a
     state-changing route may not accept a cookie from anywhere else. */
  const uid = await sessionCaller(req, t => adminAuth!.verifyIdToken(t));
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);

  try {
    const result = await declarePuc(uid, body);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PucError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'puc.declare', userId: uid });
    return NextResponse.json({ error: 'declare-failed' }, { status: 500 });
  }
}
