'use client';
/**
 * THE MEMBERSHIP - a physical brushed-metal card you hold, not a paper panel.
 * Landscape credit-card proportions, milled silver with a specular sheen and an
 * engraved name; the one literal object that says "you belong here". Active /
 * pending / lapsed change the metal's temperature, never the object.
 */
import Wordmark from '@/components/ui/Wordmark';

interface MemberCardProps {
  name: string;
  tier: string;           // "Club · since March 2026"
  since: string;          // the plan - "Silver" | "Gold"
  state?: 'active' | 'pending' | 'lapsed';
}

export default function MemberCard({ name, tier, since, state = 'active' }: MemberCardProps) {
  const lapsed = state === 'lapsed';
  const statusText = state === 'active' ? 'MEMBER' : state === 'pending' ? 'CONFIRMING' : 'LAPSED';

  // the metal: warm brushed silver, cooled and dimmed when lapsed
  const metal = lapsed
    ? 'linear-gradient(130deg, #9fa3a8 0%, #babec3 26%, #8f9398 52%, #adb1b6 76%, #969a9f 100%)'
    : 'linear-gradient(130deg, #cfd3d8 0%, #f4f6f8 24%, #b9bdc3 50%, #eceef1 74%, #c6cace 100%)';
  const engrave = lapsed ? '#3d4045' : '#26292e';

  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '1.586 / 1', borderRadius: 20,
      overflow: 'hidden', background: metal, color: engrave,
      boxShadow: 'var(--st-lift), inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -10px 24px rgba(20,22,25,0.18)',
      isolation: 'isolate',
    }}>
      {/* brushed grain */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, opacity: 0.5, mixBlendMode: 'overlay',
        background: 'repeating-linear-gradient(112deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 3px)',
      }} />
      {/* raking specular sheen */}
      <div aria-hidden style={{
        position: 'absolute', inset: '-40%', pointerEvents: 'none',
        background: 'linear-gradient(118deg, transparent 38%, rgba(255,255,255,0.55) 48%, transparent 58%)',
      }} />

      <div style={{
        position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: 22,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Wordmark height={13} variant="ink" />
          {/* the colour language on milled metal: membership reads blue, a
              lapsed card reads red, one still being confirmed reads amber */}
          <span style={{
            fontFamily: 'var(--st-data)', fontSize: 10, letterSpacing: '0.14em',
            padding: '4px 8px', borderRadius: 999,
            color: lapsed ? '#8E1F1F' : state === 'pending' ? '#7A4E22' : '#1F4E79',
            background: lapsed ? 'rgba(163,32,32,0.14)'
              : state === 'pending' ? 'rgba(138,90,46,0.14)' : 'rgba(31,78,121,0.14)',
            border: `1px solid ${lapsed ? 'rgba(163,32,32,0.30)'
              : state === 'pending' ? 'rgba(138,90,46,0.30)' : 'rgba(31,78,121,0.30)'}`,
          }}>
            {statusText}
          </span>
        </div>

        <div>
          <span style={{
            display: 'block', fontFamily: 'var(--st-display)', fontWeight: 640,
            fontSize: 'clamp(24px, 7vw, 32px)', letterSpacing: '-0.01em', lineHeight: 1,
            textShadow: '0 1px 0 rgba(255,255,255,0.45)',
          }}>
            {name}
          </span>
          <span style={{
            display: 'block', marginTop: 8, fontFamily: 'var(--st-data)', fontSize: 12,
            letterSpacing: '0.06em', opacity: 0.82,
          }}>
            {since.toUpperCase()} · {tier.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
