'use client';
/**
 * One timeline atom (design system §7.7): photo moment or text milestone.
 */
import PhotoBand from './PhotoBand';
import { Emphasis, Body, Data, Whisper } from './text';

interface MomentEntryProps {
  photo?: string;
  caption: string;        // "Full detail · 14 June 2026" or the customer's line
  whisper?: string;       // "12 photos" / "by you · Ladakh, May 2026" - never a
                          // person's name on a customer surface (Art. 8)
  milestone?: boolean;    // text-only milestone entry
  date?: string;          // Data date for milestones
  onTap?: () => void;
}

export default function MomentEntry({ photo, caption, whisper, milestone, date, onTap }: MomentEntryProps) {
  if (milestone) {
    return (
      <div style={{ padding: '0' }}>
        <Emphasis>{caption}</Emphasis>
        {date && <Data style={{ display: 'block', marginTop: 4 }}>{date}</Data>}
      </div>
    );
  }
  if (photo) {
    return <PhotoBand src={photo} alt={caption} ratio="memory" caption={caption} whisper={whisper} onTap={onTap} />;
  }
  // migrated / photo-less visit: a quiet, recessed moment in the story - history
  // reads lighter than the raised cards above it, so importance descends the page
  const body = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--st-gap)',
    }}>
      <span style={{ minWidth: 0 }}>
        <Body>{caption}</Body>
        {whisper && <Whisper style={{ marginTop: 4 }}>{whisper}</Whisper>}
      </span>
      {onTap && <span aria-hidden style={{ color: 'var(--st-ink-3)', fontSize: 17, lineHeight: 1, flex: '0 0 auto' }}>→</span>}
    </div>
  );
  const surface = {
    display: 'block', width: '100%', textAlign: 'left' as const,
    background: 'var(--st-gallery-fill)',
    borderRadius: 'var(--st-r-card)', padding: 'var(--st-gap)',
  };
  if (!onTap) return <div style={surface}>{body}</div>;
  return (
    <button onClick={onTap} className="st-tap" style={{ ...surface, border: 'none', cursor: 'pointer' }}>
      {body}
    </button>
  );
}
