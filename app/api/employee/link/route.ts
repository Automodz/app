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
    email = decoded.email?.toLowerCase();
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
