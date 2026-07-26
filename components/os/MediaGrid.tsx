'use client';
/**
 * THE MEDIA GRID - many photographs, read at a glance.
 * (Design Language §6 · §15)
 *
 * A NEW PATTERN, deliberately extracted rather than written inside a screen.
 * The product already had two photo components and neither covers this:
 *   · `PhotoBand`     one photograph at a chosen ratio, with captions
 *   · `VehiclePhotos` the OWNER'S EDITOR - upload, drag to reorder, set cover
 * This is the third case: a read-only field of many frames that the eye scans.
 *
 * It holds the image laws so no screen has to remember them: a square frame
 * reserved before the image arrives (no layout shift, ever), a fade rather
 * than a pop, lazy below the fold, and never a filter - the photograph is the
 * evidence and we do not edit evidence.
 */
import Image from 'next/image';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { studioEase, tick } from '@/lib/os/motion';
import { Whisper } from './text';

export interface MediaFrame {
  id: string;
  url: string;
  /** what this photograph was taken for - "On arrival", "Finished" */
  caption?: string;
}

export interface MediaGridProps {
  frames: MediaFrame[];
  onOpen?: (index: number) => void;
  /** the smallest a frame may get before the grid drops a column */
  min?: number;
  /** a label read by assistive tech - the grid is a list of images */
  label?: string;
}

export default function MediaGrid({ frames, onOpen, min = 104, label = 'Photographs' }: MediaGridProps) {
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  if (!frames.length) return null;

  return (
    <ul
      aria-label={label}
      style={{
        listStyle: 'none', margin: 0, padding: 0,
        display: 'grid',
        // the grid decides its own column count from the space it is given -
        // one rule instead of a breakpoint ladder
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
        gap: 'var(--st-breath)',
      }}
    >
      {frames.map((f, i) => (
        <li key={f.id}>
          <motion.button
            onClick={onOpen ? () => onOpen(i) : undefined}
            aria-label={f.caption ? `${f.caption} — open` : 'Open photograph'}
            whileTap={onOpen && !reduced ? { scale: 0.97 } : undefined}
            transition={{ duration: tick, ease: studioEase }}
            style={{
              position: 'relative', display: 'block', width: '100%',
              // the frame is reserved BEFORE the image lands - no layout shift
              aspectRatio: '1 / 1',
              padding: 0, border: 'none', overflow: 'hidden',
              borderRadius: 'var(--st-r-chip)',
              background: 'var(--st-gallery)',
              cursor: onOpen ? 'pointer' : 'default',
            }}
          >
            <Image
              src={f.url}
              alt={f.caption ?? ''}
              fill
              sizes="(max-width: 720px) 33vw, 200px"
              loading="lazy"
              onLoad={() => setLoaded(m => ({ ...m, [f.id]: true }))}
              style={{
                objectFit: 'cover',
                // a fade, never a pop; opacity only, so nothing is gated on it
                opacity: loaded[f.id] || reduced ? 1 : 0,
                transition: `opacity var(--st-move) var(--st-ease)`,
              }}
            />
          </motion.button>
        </li>
      ))}
    </ul>
  );
}

/** A month's worth of frames, under the month it happened in. */
export function MediaMonth({
  label, frames, onOpen,
}: {
  label: string;
  frames: MediaFrame[];
  onOpen?: (index: number) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
      <Whisper
        as="h3"
        tone="ink-2"
        style={{
          fontFamily: 'var(--st-data)', fontSize: 11,
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}
      >
        {label}
      </Whisper>
      <MediaGrid frames={frames} onOpen={onOpen} label={label} />
    </div>
  );
}
