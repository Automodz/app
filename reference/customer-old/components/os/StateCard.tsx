'use client';
/**
 * THE STATE CARD - the one card (docs/AUTOMODZ-LIVING-STATES.md §4).
 *
 * Every warranty, policy, certificate and membership renders through this
 * component: physical, financial and legal alike, one design language, ten
 * kinds of data. If a new kind needs a new card, the kind is wrong.
 *
 * The law it exists to enforce: NEVER SHOW DOCUMENTS, SHOW LIVING STATES.
 * A customer does not browse files - they read whether the thing is healthy,
 * when it ends, and what to do about it. The original file lives one tap
 * behind *View original*, always last, always quiet, never primary.
 *
 * Two things it will not do, both deliberate:
 *   · a perpetual term never renders a countdown, a percentage or a ring -
 *     a ring implies depletion, and a lifetime warranty does not deplete
 *   · no individual is ever named on it (Constitution Art. 8)
 */
import { PROTECTION_TITLE } from '@/lib/types';
import type { LiveProtection } from '@/lib/os/protection';
import type { Health } from '@/lib/os/term';
import Chip, { type Tone } from './Chip';
import Action from './Action';
import { Emphasis, Body, Data, Whisper } from './text';

/** health → the colour language (Chip owns the palette; this is the mapping) */
const TONE: Record<Health, Tone> = {
  healthy: 'ok', attention: 'warn', urgent: 'urgent', lapsed: 'neutral',
};

/** A date the owner can hold: the year appears only when it isn't this one. */
const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-IN',
    sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * A countdown is only worth reading when it is nearly over. Beyond a season,
 * the number stops being information and starts being noise - nobody thinks
 * "1000 days remaining", they think "2029". (Design Language §7.6 - numbers
 * never carry false precision.)
 */
const COUNTDOWN_FROM_DAYS = 90;

/**
 * The one line that says where this promise stands. Each term shape speaks
 * in its own units - days for dated, money for balance, nothing for
 * perpetual - so the card never has to invent a number to fill a slot.
 */
function standing(p: LiveProtection): { label: string; value: string; note?: string } | null {
  switch (p.term.kind) {
    case 'perpetual':
      return { label: 'Cover', value: 'Lifetime' };

    case 'balance': {
      const v = `₹${p.term.value.toLocaleString('en-IN')}`;
      return {
        label: 'Balance',
        value: v,
        note: p.health === 'healthy' ? undefined : 'Running low - top up soon.',
      };
    }

    case 'dated': {
      const on = fmtDate(p.term.expiresOn);
      if (p.daysLeft == null) return { label: 'Expires', value: on };
      if (p.daysLeft < 0) {
        const gone = Math.abs(p.daysLeft);
        return { label: 'Expired', value: on, note: `${gone} day${gone === 1 ? '' : 's'} ago.` };
      }
      return {
        label: 'Expires',
        value: on,
        // silent while the end is still far off - the date says enough
        note: p.daysLeft <= COUNTDOWN_FROM_DAYS
          ? `${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} remaining`
          : undefined,
      };
    }
  }
}

/**
 * The status word, in the term's own units. A FASTag does not "expire soon" -
 * it runs low; a lifetime warranty is not "healthy until" anything. Speaking
 * in the wrong units is the same failure as printing a percentage on a term
 * that cannot deplete.
 */
function healthWord(p: LiveProtection): string {
  const balance = p.term.kind === 'balance';
  switch (p.health) {
    case 'healthy':   return balance ? 'Topped up' : 'Healthy';
    case 'attention': return balance ? 'Running low' : 'Expires soon';
    case 'urgent':    return balance ? 'Empty' : 'Act now';
    case 'lapsed':    return 'Lapsed';
  }
}

export interface StateCardProps {
  protection: LiveProtection;
  /** the visit that created it - opens its Chapter. Studio-applied only. */
  onOpenChapter?: () => void;
  /** offered only when this promise can genuinely be renewed here */
  onRenew?: () => void;
  /** the file. Always last, always quiet. */
  onViewOriginal?: () => void;
}

export default function StateCard({
  protection: p, onOpenChapter, onRenew, onViewOriginal,
}: StateCardProps) {
  const tone = TONE[p.health];
  const s = standing(p);
  const title = PROTECTION_TITLE[p.kind];
  const word = healthWord(p);

  return (
    <article
      aria-label={`${title} - ${word}`}
      style={{
        // the raised band: cards take their shadow from the band, never choose it
        position: 'relative', zIndex: 'var(--st-z-raised)' as unknown as number,
        background: 'var(--st-glass)',
        backdropFilter: 'var(--st-glass-blur)', WebkitBackdropFilter: 'var(--st-glass-blur)',
        border: '1px solid var(--st-hairline)',
        boxShadow: 'var(--st-raise), var(--st-edge)',
        borderRadius: 'var(--st-r-card)',
        padding: 'var(--st-gap)',
        display: 'grid', gap: 'var(--st-line)',
      }}
    >
      {/* the kind, and where it stands - the only two things read at a glance */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--st-line)',
      }}>
        <Emphasis as="h3" style={{ margin: 0, minWidth: 0 }}>{title}</Emphasis>
        <Chip tone={tone}>{word}</Chip>
      </header>

      {/* whose promise it is */}
      {(p.provider || p.plan) && (
        <div>
          {p.provider && <Body tone="ink-2" style={{ display: 'block' }}>{p.provider}</Body>}
          {p.plan && <Whisper as="span" tone="ink-2" style={{ display: 'block', marginTop: 'var(--st-hair)' }}>{p.plan}</Whisper>}
        </div>
      )}

      {/* where it stands - in its own units, never invented */}
      {s && (
        <div>
          <Whisper as="span" tone="ink-2" style={{ display: 'block' }}>{s.label}</Whisper>
          <Data
            tone="ink"
            style={{ display: 'block', marginTop: 2, fontSize: 20, letterSpacing: '0.01em' }}
          >
            {s.value}
          </Data>
          {s.note && (
            <Whisper as="span" tone="ink-2" style={{ display: 'block', marginTop: 'var(--st-hair)' }}>
              {s.note}
            </Whisper>
          )}
        </div>
      )}

      {/* what was actually bought - "Full body" vs "Front only" is material,
          so it reads at ink-2. Whisper is a size tier, not a licence to fail
          contrast (Design Language §7.5). */}
      {p.coverage && <Whisper as="span" tone="ink-2">{p.coverage}</Whisper>}

      {/* the actions, in tiers. The document is always last and always quiet. */}
      {(onRenew || onOpenChapter || onViewOriginal) && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 'var(--st-inset)',
          paddingTop: 'var(--st-hair)',
          borderTop: '1px solid var(--st-hairline)', marginTop: 'var(--st-hair)',
        }}>
          {onRenew && <Action variant="forward" onClick={onRenew}>Renew</Action>}
          {onOpenChapter && <Action variant="forward" onClick={onOpenChapter}>What we did</Action>}
          {onViewOriginal && <Action variant="quiet" onClick={onViewOriginal}>View original</Action>}
        </div>
      )}
    </article>
  );
}

/**
 * The Garage's chip row - the same states, read at a glance. Compliance
 * rendered as care: the useful thing, never a file list.
 */
export function StateChips({
  protections, onTap,
}: {
  protections: LiveProtection[];
  onTap?: (p: LiveProtection) => void;
}) {
  if (!protections.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--st-breath)' }}>
      {protections.map(p => {
        const s = standing(p);
        const label = `${PROTECTION_TITLE[p.kind]}${s ? ` · ${s.note ?? s.value}` : ''}`;
        return onTap ? (
          <button
            key={p.id}
            onClick={() => onTap(p)}
            className="st-tap"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              // the chip is small on purpose; its TARGET never is (44px law)
              display: 'inline-flex', alignItems: 'center',
              minHeight: 44, padding: '0 var(--st-hair)',
            }}
          >
            <Chip tone={TONE[p.health]}>{label}</Chip>
          </button>
        ) : (
          <Chip key={p.id} tone={TONE[p.health]}>{label}</Chip>
        );
      })}
    </div>
  );
}
