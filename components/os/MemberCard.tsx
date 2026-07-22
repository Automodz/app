'use client';
/**
 * The one literal card (design system §7.9): paper, hold shadow, hairline
 * edge, assent thread line. Active / pending / lapsed.
 */
import { Emphasis, Data, Whisper } from './text';

interface MemberCardProps {
  name: string;
  tier: string;           // "Club"
  since: string;          // "since March 2026" | "2026–2027" (lapsed)
  state?: 'active' | 'pending' | 'lapsed';
}

export default function MemberCard({ name, tier, since, state = 'active' }: MemberCardProps) {
  const dim = state === 'lapsed';
  return (
    <div style={{
      background: 'var(--st-paper)', borderRadius: 'var(--st-r-card)',
      border: '1px solid var(--st-hairline)', boxShadow: 'var(--st-hold)',
      overflow: 'hidden', opacity: state === 'pending' ? 0.62 : 1,
    }}>
      <div aria-hidden style={{ height: 3, background: dim ? 'var(--st-hairline)' : 'var(--st-assent)' }} />
      <div style={{ padding: 24 }}>
        <Emphasis tone={dim ? 'ink-3' : 'ink'} as="p">{name}</Emphasis>
        <Data tone={dim ? 'ink-3' : 'ink-2'} style={{ display: 'block', marginTop: 8 }}>
          {tier} · {since}
        </Data>
        {state === 'pending' && (
          <Whisper style={{ marginTop: 12 }}>
            The studio is confirming — your card goes live within hours.
          </Whisper>
        )}
      </div>
    </div>
  );
}
