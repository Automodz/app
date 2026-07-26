import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';
import {
  cloudinaryConfigured, cloudinaryCloud, cloudinaryApiKey, sign, mayWrite,
} from '@/lib/server/cloudinary';

export const dynamic = 'force-dynamic';

/**
 * Permission to upload one image, for thirty seconds.
 *
 * Replaces the unsigned preset that shipped in the public bundle. The signature
 * is bound to the exact `public_id` the caller asked for, so it cannot be
 * replayed to write somewhere else, and it is only issued for a path the caller
 * is allowed to write (`mayWrite`).
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
  const path = typeof body?.path === 'string' ? body.path.replace(/\.[a-zA-Z0-9]+$/, '') : '';

  const role = (await adminDb!.collection('users').doc(uid).get()).data()?.role;
  const isStaff = role === 'admin' || role === 'employee';
  if (!mayWrite(path, uid, isStaff)) {
    return NextResponse.json({ error: 'forbidden-path' }, { status: 403 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: path, timestamp, overwrite: 'false' };
  return NextResponse.json({
    cloudName: cloudinaryCloud(),
    apiKey: cloudinaryApiKey(),
    publicId: path,
    timestamp,
    overwrite: 'false',
    signature: sign(params),
  });
}
