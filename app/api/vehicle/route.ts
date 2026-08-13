import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import { addCar, correctCar, VehicleError, type CarIntent } from '@/lib/server/vehicleService';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * THE GARAGE.
 *
 * POST   add a car     (owner; the SERVER allocates the id)
 * PATCH  correct one   (owner; found under their own uid, or not at all)
 *
 * ── WHY THE ID MATTERS MORE THAN ANYTHING ELSE IN THIS FILE ──────────────
 * `ownsVehicle()` in `firestore.rules` is the ownership primitive for
 * protections, visits and declarations, and it asks one question: does a
 * document exist at `users/{me}/vehicles/{thatId}`. While a browser could
 * choose that id, squatting somebody else's was an ownership claim — and
 * vehicle ids travel in the customer's own addresses, so they are neither
 * secret nor hard to come by.
 *
 * The server allocates the id. There is no field in this body that names a
 * document, and therefore none that can name somebody else's.
 */
const callerOf = (req: NextRequest) =>
  sessionCaller(req, t => adminAuth!.verifyIdToken(t));

const guard = async (req: NextRequest) => {
  try {
    assertAdminConfigured();
  } catch {
    return { res: NextResponse.json({ error: 'Server not configured' }, { status: 503 }) };
  }
  const uid = await callerOf(req);
  if (!uid) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { uid };
};

const failed = async (e: unknown, op: string, uid: string) => {
  if (e instanceof VehicleError) {
    return NextResponse.json({ error: e.code }, { status: e.status });
  }
  await reportError(e, { op, userId: uid });
  return NextResponse.json({ error: 'vehicle-failed' }, { status: 500 });
};

export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (g.res) return g.res;
  const uid = g.uid as string;
  const body = await req.json().catch(() => null);
  try {
    return NextResponse.json(await addCar(uid, body));
  } catch (e) {
    return failed(e, 'vehicle.add', uid);
  }
}

export async function PATCH(req: NextRequest) {
  const g = await guard(req);
  if (g.res) return g.res;
  const uid = g.uid as string;
  const body = await req.json().catch(() => null) as (CarIntent & { vehicleId?: unknown }) | null;
  try {
    return NextResponse.json(await correctCar(uid, body?.vehicleId, body));
  } catch (e) {
    return failed(e, 'vehicle.correct', uid);
  }
}
