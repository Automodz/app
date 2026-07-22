'use client';
/**
 * The studio, before the first visit (audit #2 - trust is assumed, not built).
 *
 * A customer weighing a ₹1.45L protection has no story of their own yet, so
 * this is the only place the app speaks about itself: where the studio is,
 * when it is open, what leaves with a warranty, and an honest link to what
 * other owners have already said. Every line is real data the product owns
 * (COMPANY · the availability engine · the service catalog) - no metrics, no
 * claims, no marketing. It is removed for good by the first completed visit,
 * because from then on the car's own story is the proof.
 */
import { COMPANY } from '@/lib/company';
import { SERVICES } from '@/lib/catalog';
import { Body, Data, Whisper } from './text';
import Action from './Action';

const WARRANTED = Object.values(SERVICES).filter(s => s.warranty);

export default function StudioIntro() {
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div style={{ display: 'grid', gap: 'var(--st-rest)' }}>
      <div>
        <Body>{COMPANY.address}</Body>
        <Whisper style={{ marginTop: 'var(--st-hair)' }}>
          Open {COMPANY.hours.open} to {COMPANY.hours.close}.
        </Whisper>
      </div>

      <div>
        <Body tone="ink-2">Protection leaves the studio with a written warranty.</Body>
        {/* a spec table - hairline-ruled rows, name left, term right (UX-1) */}
        <div style={{ marginTop: 'var(--st-gap)' }}>
          {WARRANTED.map((s, i) => (
            <div key={s.cat} style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--st-gap)',
              padding: 'var(--st-line) 0',
              borderTop: i === 0 ? '1px solid var(--st-hairline)' : undefined,
              borderBottom: '1px solid var(--st-hairline)',
            }}>
              <Body>{s.name}</Body>
              <Data style={{ whiteSpace: 'nowrap' }}>{s.warranty}</Data>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--st-breath)', justifyItems: 'start' }}>
        <Action variant="external" onClick={() => open(COMPANY.googleReviewUrl)}>Read the studio’s Google reviews</Action>
        <Action variant="external" onClick={() => open(COMPANY.mapsUrl)}>Find the studio</Action>
      </div>
    </div>
  );
}
