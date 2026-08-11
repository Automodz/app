import { NextResponse, type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * LINKING A LISTING TO A CAR — the admin operation behind design screen 17.
 *
 * ── THE OWNER IS VALIDATED, NEVER TRUSTED ────────────────────────────────
 * A listing carries `vehicleId` and `vehicleOwnerId`, and the second is what
 * makes the car's record findable. It is not taken on faith: vehicles live
 * UNDER their owner, so the pair is proven by reading
 * `users/{ownerId}/vehicles/{vehicleId}`. A mistyped or forged pair is refused
 * here, and never becomes a link that publishes the wrong customer's history.
 *
 * ── AND LINKING IS NOT CONSENT ───────────────────────────────────────────
 * Nothing here grants permission to publish anything. Consent belongs to the
 * car and only its owner may give it (lib/os/consent.ts); an admin who could
 * grant it on a customer's behalf would defeat the point of asking. Linking
 * says WHICH car; the owner says whether its record may be shown.
 *
 * ── AND IT IS ADMIN-ONLY ─────────────────────────────────────────────────
 * `carListings` is admin-write in rules, and this route holds to the same
 * line. There is no customer path to it, and none is wanted: a customer who
 * could link a listing to a car could publish somebody else's record by
 * pointing a listing at it.
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await adminAuth!.verifyIdToken(header.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const profile = await adminDb!.collection('users').doc(uid).get();
  if ((profile.data()?.role as string) !== 'admin') {
    return NextResponse.json({ error: 'admin-only' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as
    { listingId?: string; vehicleId?: string; vehicleOwnerId?: string } | null;
  const listingId = typeof body?.listingId === 'string' ? body.listingId : '';
  if (!listingId) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const vehicleId = typeof body?.vehicleId === 'string' ? body.vehicleId.trim() : '';
  const vehicleOwnerId = typeof body?.vehicleOwnerId === 'string' ? body.vehicleOwnerId.trim() : '';

  try {
    const listingRef = adminDb!.collection('carListings').doc(listingId);
    if (!(await listingRef.get()).exists) {
      return NextResponse.json({ error: 'listing-not-found' }, { status: 404 });
    }

    /* UNLINKING is both halves cleared, and it must actually remove the fields:
       a listing left holding a stale `vehicleId` would keep publishing a
       record the studio has decided is no longer this car's. */
    if (!vehicleId && !vehicleOwnerId) {
      await listingRef.update({
        vehicleId: FieldValue.delete(),
        vehicleOwnerId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true, linked: false });
    }

    if (!vehicleId || !vehicleOwnerId) {
      /* Half a link is worse than none: it names a car with no garage to look
         in, and the loader would silently return nothing for ever. */
      return NextResponse.json({ error: 'both-required' }, { status: 400 });
    }

    const vehicleSnap = await adminDb!.doc(`users/${vehicleOwnerId}/vehicles/${vehicleId}`).get();
    if (!vehicleSnap.exists) {
      return NextResponse.json({ error: 'vehicle-not-in-that-garage' }, { status: 409 });
    }

    await listingRef.update({
      vehicleId,
      vehicleOwnerId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const vehicle = vehicleSnap.data() as { publicHistoryConsent?: { granted?: boolean } };
    return NextResponse.json({
      ok: true,
      linked: true,
      /* Told plainly, because linking a car whose owner has not consented
         publishes nothing and the studio should know that rather than wonder
         why the record is missing. */
      ownerConsented: vehicle.publicHistoryConsent?.granted === true,
    });
  } catch (e) {
    await reportError(e, { op: 'cars.link', userId: uid, extra: { listingId } });
    return NextResponse.json({ error: 'link-failed' }, { status: 500 });
  }
}
