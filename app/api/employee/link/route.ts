import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Employee ↔ auth account linking.
 *
 * Called by the client after any sign-in where the profile role is 'customer'.
 * If an ACTIVE employee record carries this account's email, the user is
 * promoted to role 'employee' and the employee doc gets authUid back-linked.
 * If the employee was deactivated (or the email unlinked), an existing
 * 'employee' user is demoted back to 'customer'.
 *
 * Runs with the admin SDK so security rules can keep forbidding role
 * self-escalation on the client.
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

  let uid: string, email: string | undefined;
  try {
    const decoded = await adminAuth!.verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
    /* AN UNVERIFIED EMAIL IS A CLAIM, NOT AN IDENTITY.
       This route grants the `employee` role - the job board, every customer's
       name and phone, the kiosk, attendance - purely on the email in the
       token matching an active employee record. The app signs in with Google,
       which always verifies, but the Firebase project's public API key will
       mint a token for ANY provider enabled in the console: turn on
       email/password and a stranger can register a staff member's address,
       unverified, and be promoted. Requiring the verification flag makes this
       route safe regardless of what is switched on later. */
    email = decoded.email_verified ? decoded.email?.toLowerCase() : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const userRef = adminDb!.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const currentRole = userSnap.data()?.role as string | undefined;
  if (currentRole === 'admin') return NextResponse.json({ role: 'admin' });

  const match = email
    ? await adminDb!
        .collection('employees')
        .where('email', '==', email)
        .where('active', '==', true)
        .limit(1)
        .get()
    : null;

  if (match && !match.empty) {
    const emp = match.docs[0];
    await Promise.all([
      userRef.set(
        { role: 'employee', employeeId: emp.id, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      ),
      emp.ref.update({ authUid: uid, updatedAt: FieldValue.serverTimestamp() }),
    ]);
    return NextResponse.json({ role: 'employee', employeeId: emp.id, employeeName: emp.data().name });
  }

  // No active employee record → revoke a stale employee role if present
  if (currentRole === 'employee') {
    await userRef.set(
      { role: 'customer', employeeId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return NextResponse.json({ role: 'customer', revoked: true });
  }

  return NextResponse.json({ role: currentRole ?? 'customer' });
}
