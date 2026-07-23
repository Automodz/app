'use client';
/**
 * The one literal card (design system §7.9): paper, hold shadow, hairline
 * edge, assent thread line. Active / pending / lapsed.
 */
import { Emphasis, Data, Whisper } from './text';
import Chip from './Chip';

interface MemberCardProps {
  name: string;
  tier: string;           // "Club"
  since: string;          // "since March 2026" | "2026–2027" (lapsed)
  state?: 'active' | 'pending' | 'lapsed';
}

/** The membership as a possession you hold (UX-1) - real card elevation, an
 *  edge of light, a status chip. Pending keeps its dignity without dimming to
 *  the point of doubt. */
export default function MemberCard({ name, tier, since, state = 'active' }: MemberCardProps) {
  const dim = state === 'lapsed';
  const chip =
    state === 'active'  ? { tone: 'ok' as const, label: 'Member' }
    : state === 'pending' ? { tone: 'neutral' as const, label: 'Confirming' }
    : { tone: 'neutral' as const, label: 'Lapsed' };
  return (
    <div style={{
      background: 'var(--st-card-fill)', borderRadius: 'var(--st-r-sheet)',
      border: '1px solid var(--st-hairline)', boxShadow: 'var(--st-raise), var(--st-edge)',
      overflow: 'hidden',
    }}>
      <div aria-hidden style={{ height: 3, background: dim ? 'var(--st-hairline)' : 'var(--st-assent)' }} />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--st-gap)' }}>
          <Emphasis tone={dim ? 'ink-3' : 'ink'} as="p">{name}</Emphasis>
          <Chip tone={chip.tone}>{chip.label}</Chip>
        </div>
        <Data tone={dim ? 'ink-3' : 'ink-2'} style={{ display: 'block', marginTop: 8 }}>
          {tier} · {since}
        </Data>
        {state === 'pending' && (
          <Whisper style={{ marginTop: 12 }}>
            The studio is confirming - your card goes live within hours.
          </Whisper>
        )}
      </div>
    </div>
  );
}
