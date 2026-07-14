import { NextRequest, NextResponse } from 'next/server';
import { adminDb, assertAdminConfigured } from '@/lib/server/firebaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Public, token-gated invoice fetch. Firestore rules keep invoices closed;
 * sharing goes through this route which validates the publicToken.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertAdminConfigured();
  } catch {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { id } = await params;
  const token = req.nextUrl.searchParams.get('t');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

  const snap = await adminDb!.collection('invoices').doc(id).get();
  if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = snap.data()!;
  if (data.publicToken !== token) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { publicToken: _publicToken, ...invoice } = data;
  return NextResponse.json({
    id: snap.id,
    ...invoice,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
  });
}
