'use client';
/**
 * One timeline atom (design system §7.7): photo moment or text milestone.
 */
import PhotoBand from './PhotoBand';
import { Emphasis, Body, Data, Whisper } from './text';

interface MomentEntryProps {
  photo?: string;
  caption: string;        // "Full detail · 14 June 2026" or the customer's line
  whisper?: string;       // "12 photos · Deepak" / "by you · Ladakh, May 2026"
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
  // migrated / photo-less visit: dignified typographic entry
  const body = (
    <>
      <Body>{caption}</Body>
      {whisper && <Whisper style={{ marginTop: 4 }}>{whisper}</Whisper>}
    </>
  );
  if (!onTap) return <div>{body}</div>;
  return (
    <button onClick={onTap} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
    }}>
      {body}
    </button>
  );
}
