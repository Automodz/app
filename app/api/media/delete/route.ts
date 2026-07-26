import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import { cloudinaryConfigured, destroy, mayWrite } from '@/lib/server/cloudinary';

export const dynamic = 'force-dynamic';

/**
 * Delete an image, for real.
 *
 * `deleteImage()` used to be a no-op with a comment explaining why - unsigned
 * uploads cannot be destroyed from a browser. So "remove this photo" removed
 * nothing, which is a promise broken to the customer and, once the Studio
 * showcase carries their car, a DPDP Act 2023 problem: consent withdrawn has
 * to actually withdraw something.
 *
 * Ownership is checked against the asset's own path, not against a claim in the
 * body (`mayWrite` - the same rule that governs uploads, so a customer can only
 * ever remove what they could have put there).
 */
export async function POST(req: NextRequest) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }
  if (!cloudinaryConfigured()) {
    return NextResponse.json({ error: 'media-not-configured' }, { status: 503 });
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

  const body = await req.json().catch(() => null) as { path?: string } | null;
  // stored as `cloudinary:<public_id>`; older rows may carry the bare id
  const publicId = (body?.path ?? '').replace(/^cloudinary:/, '');
  if (!publicId) return NextResponse.json({ error: 'path-required' }, { status: 400 });

  const role = (await adminDb!.collection('users').doc(uid).get()).data()?.role;
  const isStaff = role === 'admin' || role === 'employee';
  if (!mayWrite(publicId, uid, isStaff)) {
    return NextResponse.json({ error: 'forbidden-path' }, { status: 403 });
  }

  const gone = await destroy(publicId);
  return gone
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'delete-failed' }, { status: 502 });
}
