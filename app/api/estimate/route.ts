import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { createEstimateAuthoritative, EstimateError } from '@/lib/server/estimateService';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * PRICE A CHOICE — design screen 07.
 *
 * Note what has no name here: `price`, `total`, `discount`, `workPrice`. A
 * caller cannot express them, so there is nothing to validate and nothing to
 * forget to validate. What a caller may say is WHICH coverage, WHICH panels
 * and WHICH extra stages — ids, each of which is looked up in the service
 * document and refused when it is not there.
 *
 * The estimate that comes back is a stored, immutable record. The screen shows
 * what the server wrote; the booking later spends it by id.
 *
 * `preview: true` runs the SAME calculation and stores nothing — screen 07
 * restates the figure on every tap, and a document per tap would leave the
 * studio holding a collection of quotes nobody asked for. It comes back with
 * an empty id, so a caller that tries to spend one fails on a missing estimate
 * rather than booking something nobody priced.
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
    uid = (await adminAuth!.verifyIdToken(authHeader.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const s = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
  /* Bounded. A thousand panel ids is not a quote, it is a denial of service
     wearing one — and the studio does not fit a thousand panels. */
  const ids = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200)
      .slice(0, 40);

  try {
    const estimate = await createEstimateAuthoritative(uid, {
      vehicleId: s(body.vehicleId) ?? '',
      serviceId: s(body.serviceId) ?? '',
      scopeId: s(body.scopeId),
      panelIds: ids(body.panelIds),
      addOnIds: ids(body.addOnIds),
      pickup: body.pickup === true,
      drop: body.drop === true,
      useMembershipWash: body.useMembershipWash === true,
    }, { preview: body.preview === true });
    return NextResponse.json(estimate);
  } catch (e) {
    if (e instanceof EstimateError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'estimate.create', userId: uid });
    return NextResponse.json({ error: 'estimate-failed' }, { status: 500 });
  }
}
