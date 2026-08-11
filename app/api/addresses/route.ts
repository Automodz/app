import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { callerOf as sessionCaller } from '@/lib/server/session';
import {
  listAddresses, saveAddress, deleteAddress, AddressError,
} from '@/lib/server/addressService';
import { reportError } from '@/lib/server/report';

export const dynamic = 'force-dynamic';

/**
 * SAVED PICKUP AND DROP ADDRESSES — design screens 08 and 19.
 *
 * Every write goes through here because two of the rules cannot be written as
 * Firestore rules: keeping exactly one default is a write to documents the
 * request never named, and refusing to delete an address a van is due at needs
 * a query. See lib/server/addressService.
 *
 * Ownership is the verified uid and nothing else — no body field names a user,
 * so there is no `userId` to forge.
 */
/**
 * THE CALLER — a bearer token, or the session cookie the rooms already use.
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

export async function GET(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ addresses: await listAddresses(uid) });
}

export async function POST(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  try {
    const saved = await saveAddress(uid, {
      label: s(body.label),
      line1: s(body.line1),
      line2: s(body.line2),
      area: s(body.area),
      city: s(body.city),
      pincode: s(body.pincode),
      contactName: s(body.contactName),
      contactPhone: s(body.contactPhone),
      isDefault: body.isDefault === true,
      /* An id in the body EDITS; its absence creates. It is only ever used to
         address a document under this caller's own subtree, so it cannot name
         somebody else's address however it is forged. */
    }, typeof body.id === 'string' && body.id ? body.id : undefined);
    return NextResponse.json(saved);
  } catch (e) {
    if (e instanceof AddressError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'address.save', userId: uid });
    return NextResponse.json({ error: 'save-failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!configured()) return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  const uid = await callerOf(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  try {
    return NextResponse.json(await deleteAddress(uid, id));
  } catch (e) {
    if (e instanceof AddressError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    await reportError(e, { op: 'address.delete', userId: uid });
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
}
