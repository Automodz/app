'use client';
/**
 * The Stay's act renderer (design system §7.8): stage ground, evidence above,
 * act title + narration below, the five acts as words with an assent check on
 * the ones that are done. No bar, no percentage, no countdown - the act row is
 * the whole of the progress language.
 */
import { AnimatePresence, motion } from 'framer-motion';
import HeroMedia from './HeroMedia';
import { glass } from '@/lib/os/surfaces';
import type { ReactNode } from 'react';
import { crossfade, studioEase, tick } from '@/lib/os/motion';
import { vtName } from '@/lib/os/navigate';
import type { StayAct } from '@/lib/os/stay';
import { ACT_TITLE, type CareAct } from '@/lib/os/visit';
import { Display, Body, Whisper } from './text';

const STATE_WORD: Record<StayAct['state'], string> = {
  done: 'done', current: 'happening now', coming: 'still to come',
};

interface MomentStageProps {
  act: CareAct;
  acts: StayAct[];
  narration: string;
  /** latest evidence photograph */
  photo?: string;
  photoAlt?: string;
  /** what stands in for the photograph when the floor hasn't shot one yet */
  fallback?: ReactNode;
  /** one honest line about time, or nothing */
  timing?: string | null;
  /** the quiet facts under the narration (arrival, who has the car) */
  meta?: ReactNode;
  /** inline content above the act row (a studio suggestion, the collection line) */
  children?: ReactNode;
}

export default function MomentStage({
  act, acts, narration, photo, photoAlt, fallback, timing, meta, children,
}: MomentStageProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
    }}>
      {/* the hero image - the same component, crop and scrim as the Glance
          (components/os/HeroMedia), so the two surfaces read as one product */}
      <div style={{
        position: 'relative', height: '52vh', minHeight: 340, overflow: 'hidden',
        background: 'var(--st-stage)', ...vtName('hero-vehicle'),
      }}>
        <HeroMedia
          photo={photo}
          fallback={fallback}
          alt={photoAlt ?? `${ACT_TITLE[act]} - the studio’s photograph`}
          priority
          scrimTo="var(--st-stage)"
        />
      </div>

      {/* the moment, on the shared card surface (lib/os/surfaces) - the Stay's
          content given the same material, radius and spacing as the Glance's
          cards, so it reads as Home continued rather than a different page */}
      <div style={{
        padding: '0 var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-rest))',
        marginTop: 'calc(-1 * var(--st-inset))', position: 'relative',
      }}>
        <div style={{ ...glass, borderRadius: 'var(--st-r-sheet)', padding: 'var(--st-inset)' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={act} {...crossfade}>
              <Display tone="over">{ACT_TITLE[act]}</Display>
              <Body tone="over-2" style={{ marginTop: 'var(--st-line)' }}>{narration}</Body>
            </motion.div>
          </AnimatePresence>

          {meta && <div style={{ marginTop: 'var(--st-line)' }}>{meta}</div>}

          {children && <div style={{ marginTop: 'var(--st-rest)' }}>{children}</div>}

          <ActRail acts={acts} />

          {timing && <Whisper tone="over-2" style={{ marginTop: 'var(--st-gap)' }}>{timing}</Whisper>}
        </div>
      </div>
    </div>
  );
}

/**
 * THE ACT RAIL - the five acts as an engineered timeline on the stage: a rail
 * filled to the work's position, done acts checked, the current act a live
 * heartbeat. No bar, no percentage - the rail *is* the progress language.
 */
function ActRail({ acts }: { acts: StayAct[] }) {
  const n = acts.length;
  const curIdx = acts.findIndex(a => a.state === 'current');
  const doneCount = acts.filter(a => a.state === 'done').length;
  // the fill reaches the current node (or the last done node when none is current)
  const reached = curIdx >= 0 ? curIdx : Math.max(0, doneCount - 1);
  const fillPct = n > 1 ? (reached / (n - 1)) * 100 : 0;

  return (
    <ol
      aria-label="The five acts of this visit"
      style={{
        position: 'relative', display: 'flex', justifyContent: 'space-between',
        marginTop: 'var(--st-rest)', padding: 0, listStyle: 'none',
      }}
    >
      {/* the rail: a dim track with a bright fill to the work's position */}
      <div aria-hidden style={{
        position: 'absolute', top: 6, left: '7px', right: '7px', height: 2, borderRadius: 999,
        background: 'color-mix(in srgb, var(--st-over) 16%, transparent)',
      }} />
      <div aria-hidden style={{
        position: 'absolute', top: 6, left: '7px', width: `calc(${fillPct}% - 14px * ${fillPct / 100} + 0px)`,
        maxWidth: `calc(100% - 14px)`, height: 2, borderRadius: 999,
        background: 'linear-gradient(90deg, var(--st-over-2), var(--st-over))',
        transition: 'width 480ms var(--st-ease)',
      }} />
      {acts.map(a => (
        <li
          key={a.act}
          aria-label={`${a.title} - ${STATE_WORD[a.state]}`}
          aria-current={a.state === 'current' ? 'step' : undefined}
          style={{
            position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, flex: '1 1 0', minWidth: 0,
          }}
        >
          {/* the node */}
          <span aria-hidden style={{ position: 'relative', width: 14, height: 14, display: 'grid', placeItems: 'center' }}>
            <span
              className={a.state === 'current' ? 'st-node-live' : undefined}
              style={{
                width: a.state === 'coming' ? 10 : 14, height: a.state === 'coming' ? 10 : 14,
                borderRadius: '50%',
                background: a.state === 'coming' ? 'var(--st-stage)' : 'var(--st-over)',
                border: a.state === 'coming' ? '2px solid color-mix(in srgb, var(--st-over) 28%, transparent)' : 'none',
                display: 'grid', placeItems: 'center',
              }}
            >
              {a.state === 'done' && <Check onStage />}
            </span>
          </span>
          {/* the label - the current act named in full, the rest recede */}
          <span aria-hidden style={{
            fontFamily: 'var(--st-text)', fontSize: 11, lineHeight: 1.25, textAlign: 'center',
            color: a.state === 'coming' ? 'var(--st-over-2)' : 'var(--st-over)',
            fontWeight: a.state === 'current' ? 520 : 400,
            opacity: a.state === 'current' ? 1 : 0.82,
          }}>
            {a.title}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The assent tick - drawn once; instant under reduced motion (MotionConfig). */
function Check({ onStage }: { onStage?: boolean } = {}) {
  return (
    <svg aria-hidden width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ flex: '0 0 auto' }}>
      <motion.path
        d="M1.5 6.5 L4.5 9.5 L10.5 2.5"
        stroke={onStage ? 'var(--st-stage)' : 'var(--st-assent)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: tick, ease: studioEase }}
      />
    </svg>
  );
}
