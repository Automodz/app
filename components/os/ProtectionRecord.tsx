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
  /** who applied it, when the floor recorded it */
  installer?: string | null;
  /** the visit that created it - its Chapter */
  onOpenChapter?: () => void;
  /** offered only when the studio's proposal engine truly cites this layer */
  onRenew?: () => void;
  /** Home reads protection as a *status* row (thumb + word + condition + chip);
   *  the full photographed record lives in the focus sheet and the chapter. */
  compact?: boolean;
}

export default function ProtectionRecord({
  protection: p, vehicleName, daysLeft, photo, installer, onOpenChapter, onRenew, compact,
}: ProtectionRecordProps) {
  const word = PROTECTION_WORD[p.kind];
  const renewing = p.term === 'waning' || p.term === 'expiring';

  /* the one-glance status - protected, needs attention, or run its course */
  const status = !p.active
    ? { tone: 'neutral' as const, label: 'Lapsed' }
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
        {installer ? ` · applied by ${installer}` : ''}
      </Whisper>
      {(onOpenChapter || onRenew) && (
        <div style={{ marginTop: 'var(--st-line)', display: 'flex', gap: 'var(--st-inset)', flexWrap: 'wrap' }}>
          {onOpenChapter && <Action variant="forward" onClick={onOpenChapter}>Read its chapter</Action>}
          {onRenew && <Action variant="forward" onClick={onRenew}>Renew</Action>}
        </div>
      )}
    </>
  );

  /* Home: one glanceable status row - word, condition, a chip, a small frame of
     the evidence; the full record is one tap away in its chapter. */
  if (compact) {
    return (
      <button
        onClick={onOpenChapter}
        className="st-tap"
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--st-gap)', width: '100%',
          padding: 'var(--st-line) 0', background: 'transparent', border: 'none',
          cursor: onOpenChapter ? 'pointer' : 'default', textAlign: 'left',
        }}
      >
        {p.active && photo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photo} alt="" style={{
            width: 44, height: 44, borderRadius: 10, objectFit: 'cover',
            flex: '0 0 auto', background: 'var(--st-gallery)',
          }} />
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <Body as="span" style={{ display: 'block' }}>{word}</Body>
          <Whisper as="span" style={{ display: 'block', marginTop: 2 }}>{condition}</Whisper>
        </span>
        <Chip tone={status.tone}>{status.label}</Chip>
        {onOpenChapter && <span aria-hidden style={{ color: 'var(--st-ink-3)', flex: '0 0 auto' }}>→</span>}
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
