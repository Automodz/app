import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { deleteAccount } from '@/lib/server/deleteAccount';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * DELETE MY ACCOUNT.
 *
 * Server-only, and it could not be anything else: a client can delete neither
 * its own Auth user's data across collections nor the business records that
 * must be anonymised — `firestore.rules` refuses both, correctly.
 *
 * ONLY THE ACCOUNT'S OWNER. The uid comes from the verified token and nothing
 * else; there is no id in the body to tamper with. Staff cannot delete a
 * customer here either — an operator erasing a customer's account is a
 * different act with different consequences, and it does not get to reuse this.
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
    /* `checkRevoked` is on: a signed-out or disabled token must not be able to
       trigger something this final. */
    uid = (await adminAuth!.verifyIdToken(authHeader.slice(7), true)).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  /* Staff accounts are refused. An employee's record links to the roster and to
     payroll; erasing it through the customer path would leave the studio's
     books pointing at nothing. */
  try {
    const role = (await adminDb!.collection('users').doc(uid).get()).data()?.role;
    if (role === 'admin' || role === 'employee') {
      return NextResponse.json({ error: 'staff-account' }, { status: 403 });
    }
  } catch {
    /* No profile means nothing to protect — let the deletion proceed. */
  }

  try {
    const result = await deleteAccount(uid);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await reportError(e, { op: 'account.delete', userId: uid });
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
}
