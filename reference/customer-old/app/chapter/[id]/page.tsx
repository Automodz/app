'use client';
/**
 * The shared Chapter - `/chapter/[id]?t=` (P2D1 §C5, public reading).
 *
 * The same document, for someone the owner sent it to: the finished car, the
 * work and the evidence. The money, the phone number and anything internal
 * never reach this page - the server's `view=chapter` projection leaves them
 * behind. One layout, two readings; there is no second Chapter.
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import type { ChapterModel } from '@/lib/os/chapter';
import Chapter from '@/components/os/Chapter';
import { Body, Whisper } from '@/components/os/text';

interface PublicChapter {
  id: string;
  vehicleName: string;
  vehicleRegNo: string;
  work: string[];
  photos?: { url: string; kind: 'before' | 'during' | 'after' }[];
  createdAt: string | null;
}

const SHOT: Record<'before' | 'during' | 'after', { act: 'arrival' | 'work' | 'finished'; label: string }> = {
  before: { act: 'arrival', label: 'On arrival' },
  during: { act: 'work', label: 'In care' },
  after: { act: 'finished', label: 'Finished' },
};
const ORDER = ['arrival', 'work', 'finished'];

export default function PublicChapterPage() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get('t');
  const [data, setData] = useState<PublicChapter | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) { setFailed(true); return; }
    fetch(`/api/invoice/${id}?t=${encodeURIComponent(token)}&view=chapter`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('gone'))))
      .then(setData)
      .catch(() => setFailed(true));
  }, [id, token]);

  const frame = (children: React.ReactNode) => (
    <MotionConfig reducedMotion="user">
      <div className="studio" style={{ minHeight: '100vh', background: 'var(--st-paper)' }}>{children}</div>
    </MotionConfig>
  );

  if (failed) {
    return frame(
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--st-inset)' }}>
        <Body tone="ink-2">This chapter isn’t available.</Body>
      </main>,
    );
  }

  if (!data) {
    return frame(
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Whisper style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em' }}>AUTOMODZ</Whisper>
      </main>,
    );
  }

  const evidence = (data.photos ?? [])
    .map(p => ({ url: p.url, ...SHOT[p.kind] }))
    .sort((a, b) => ORDER.indexOf(a.act) - ORDER.indexOf(b.act));

  const chapter: ChapterModel = {
    title: data.work[0] ?? 'A visit',
    dateISO: (data.createdAt ?? new Date().toISOString()).slice(0, 10),
    vehicleName: data.vehicleName,
    registration: data.vehicleRegNo,
    hero: evidence.find(e => e.act === 'finished')?.url ?? evidence[0]?.url,
    work: data.work,
    evidence,
    minutesInCare: null,
    amount: 0,
    paid: false,
    paymentMethod: null,
    coveredByClub: false,
    documents: [],
  };

  return frame(
    <main>
      <Chapter chapter={chapter} protections={[]} owner={false} />
    </main>,
  );
}
