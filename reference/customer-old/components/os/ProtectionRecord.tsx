'use client';
/**
 * One protection layer, told once (P2D1 §C6).
 *
 * Living protection is photographed - the panel it shields, from the visit
 * that applied it - and speaks with confidence ("Protected until March
 * 2029"). A protection that has run its course keeps its dignity in type,
 * with its dates intact. The same record serves the Glance layer and the
 * Desk's protection panel; there is no second layout.
 *
 * Everything here is read from the protection engine, the term engine and
 * the visit that created it. Nothing about wear is estimated and no renewal
 * is suggested unless the studio's own proposal engine cites this layer.
 */
import { PROTECTION_WORD, type Protection } from '@/lib/cx/protection';
import PhotoBand from './PhotoBand';
import Action from './Action';
import Chip from './Chip';
import { Emphasis, Body, Whisper } from './text';

/** The shield - protection as an emblem when there is no photograph. */
function ShieldGlyph({ active }: { active: boolean }) {
  const c = active ? 'var(--st-assent)' : 'var(--st-ink-3)';
  return (
    <span style={{
      width: 52, height: 52, borderRadius: 12, flex: '0 0 auto',
      display: 'grid', placeItems: 'center', background: 'var(--st-gallery)',
    }}>
      <svg aria-hidden width="24" height="26" viewBox="0 0 24 26" fill="none">
        <path d="M12 1.5 21 5v7c0 6-4 10-9 12.5C7 21 3 17 3 11V5l9-3.5z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
        {active && <path d="M8.5 12.5 11 15l4.5-5" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}

const fmtMonthYear = (d: Date) =>
  d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export interface ProtectionRecordProps {
  protection: Protection;
  vehicleName: string;
  /** days remaining, from the term engine - only used while it is the action */
  daysLeft?: number | null;
  /** the finished photograph from the visit that applied this layer */
  photo?: string;
  /** the visit that created it - its Chapter */
  onOpenChapter?: () => void;
  /** offered only when the studio's proposal engine truly cites this layer */
  onRenew?: () => void;
  /** Home reads protection as a *status* row (thumb + word + condition + chip);
   *  the full photographed record lives in the focus sheet and the chapter. */
  compact?: boolean;
}

export default function ProtectionRecord({
  protection: p, vehicleName, daysLeft, photo, onOpenChapter, onRenew, compact,
}: ProtectionRecordProps) {
  const word = PROTECTION_WORD[p.kind];
  const renewing = p.term === 'waning' || p.term === 'expiring';

  /* the one-glance status - protected, needs attention, or run its course */
  const status = !p.active
    ? { tone: 'urgent' as const, label: 'Expired' }
    : renewing
    ? { tone: 'warn' as const, label: typeof daysLeft === 'number' ? `${daysLeft}d left` : 'Renewal soon' }
    : { tone: 'ok' as const, label: 'Protected' };

  const condition = !p.active
    ? `Applied ${fmtLong(p.applied)}${p.until ? ` · ran its course ${fmtMonthYear(p.until)}` : ''}.`
    : renewing && typeof daysLeft === 'number'
    ? `Renewal window open - ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
    : p.until
    ? `Protected until ${fmtMonthYear(p.until)}`
    : `Applied ${fmtLong(p.applied)}`;

  const facts = (
    <>
      <Whisper style={{ marginTop: 'var(--st-breath)' }}>
        {p.service}
        {p.warranty ? ` · ${p.warranty} warranty` : ''}
      </Whisper>
      {(onOpenChapter || onRenew) && (
        <div style={{ marginTop: 'var(--st-line)', display: 'flex', gap: 'var(--st-inset)', flexWrap: 'wrap' }}>
          {onOpenChapter && <Action variant="forward" onClick={onOpenChapter}>Read its chapter</Action>}
          {onRenew && <Action variant="forward" onClick={onRenew}>Renew</Action>}
        </div>
      )}
    </>
  );

  /* Home: PROTECTION AS A STATUS PANEL - the shield/evidence, the word, the
     condition, a chip, and a warranty term bar showing how much life is left.
     The full photographed record is one tap away in its chapter. */
  if (compact) {
    const appliedMs = new Date(`${p.applied}T12:00:00`).getTime();
    const untilMs = p.until?.getTime();
    const remaining = p.active && untilMs && untilMs > appliedMs
      ? Math.max(0, Math.min(1, (untilMs - Date.now()) / (untilMs - appliedMs)))
      : null;
    const barColor = status.tone === 'warn' ? 'var(--st-caution)' : 'var(--st-assent)';
    return (
      <button
        onClick={onOpenChapter}
        className="st-tap st-card"
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: 'var(--st-card-fill)', border: '1px solid var(--st-hairline)',
          boxShadow: 'var(--st-hold), var(--st-edge)', borderRadius: 'var(--st-r-sheet)',
          padding: 'var(--st-inset)', cursor: onOpenChapter ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--st-gap)' }}>
          {p.active && photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={photo} alt="" style={{
              width: 52, height: 52, borderRadius: 12, objectFit: 'cover',
              flex: '0 0 auto', background: 'var(--st-gallery)',
            }} />
          ) : (
            <ShieldGlyph active={p.active} />
          )}
          <span style={{ flex: 1, minWidth: 0 }}>
            <Emphasis as="span" style={{ display: 'block' }}>{word}</Emphasis>
            <Whisper as="span" style={{ display: 'block', marginTop: 2 }}>{condition}</Whisper>
          </span>
          <Chip tone={status.tone}>{status.label}</Chip>
        </div>
        {remaining != null && (
          <div aria-hidden style={{
            height: 4, borderRadius: 999, background: 'var(--st-hairline)',
            overflow: 'hidden', marginTop: 'var(--st-gap)',
          }}>
            <div style={{ width: `${Math.round(remaining * 100)}%`, height: '100%', borderRadius: 999, background: barColor }} />
          </div>
        )}
      </button>
    );
  }

  /* photography belongs to living protection only (design law) - the status
     chip rides the top-right corner over the scrim */
  if (p.active && photo) {
    return (
      <div>
        <PhotoBand
          src={photo}
          alt={`${word} - the ${vehicleName}`}
          ratio="band"
          overTitle={word}
          overCaption={condition}
          overBadge={<Chip tone={status.tone}>{status.label}</Chip>}
        />
        {facts}
      </div>
    );
  }

  /* a material record-card: the word as the object, the status read at a glance,
     the condition told once beneath (UX-1) */
  return (
    <div style={{
      background: 'var(--st-card-fill)', border: '1px solid var(--st-hairline)',
      borderRadius: 'var(--st-r-card)', boxShadow: 'var(--st-hold), var(--st-edge)',
      padding: 'var(--st-inset)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--st-gap)',
      }}>
        <Emphasis as="p">{word}</Emphasis>
        <Chip tone={status.tone}>{status.label}</Chip>
      </div>
      <Body tone="ink-2" style={{ marginTop: 'var(--st-breath)' }}>
        {p.active ? condition : condition}
      </Body>
      {facts}
    </div>
  );
}
