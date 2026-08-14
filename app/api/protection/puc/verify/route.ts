import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import { decidePuc, PucError } from '@/lib/server/pucService';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * THE STUDIO'S DECISION - verify, or refuse.
 *
 * The single most valuable write in the protection machine: it is what makes
 * the product say "this car is certified until March" on the customer's own
 * screen. So it belongs to the studio in the same way `paid` does, and for the
 * same reason - only somebody holding the paper can say it is real.
 *
 * The caller's role is read from THEIR OWN PROFILE inside the service. There
 * is no field in this body that grants authority, and the car being certified
 * comes from the declaration rather than from the request, so no call shape
 * exists that verifies one customer's certificate against another's car.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const uid = await sessionCaller(req, t => adminAuth!.verifyIdToken(t));
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);

  try {
    const result = await decidePuc(uid, body);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PucError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'puc.verify', userId: uid });
    return NextResponse.json({ error: 'verify-failed' }, { status: 500 });
  }
}
