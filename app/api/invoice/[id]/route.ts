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

  const createdAt = data.createdAt?.toDate?.()?.toISOString() ?? null;

  /* The shared Chapter is the beauty without the money: a projection that
     never puts amounts, the customer's phone or internal references on the
     wire, so a forwarded link cannot leak them. (P2D1 §C5) */
  if (req.nextUrl.searchParams.get('view') === 'chapter') {
    return NextResponse.json({
      id: snap.id,
      vehicleName: data.vehicleName ?? '',
      vehicleRegNo: data.vehicleRegNo ?? '',
      work: (data.lineItems ?? []).map((i: { name: string }) => i.name),
      photos: data.photos ?? [],
      createdAt,
    });
  }

  const { publicToken: _publicToken, ...invoice } = data;
  return NextResponse.json({ id: snap.id, ...invoice, createdAt });
}
