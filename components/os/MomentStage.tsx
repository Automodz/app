'use client';
/**
 * The Stay's act renderer (design system §7.8): stage ground, evidence above,
 * act title + narration below, the five acts as words with an assent check on
 * the ones that are done. No bar, no percentage, no countdown — the act row is
 * the whole of the progress language.
 */
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { crossfade, studioEase, tick } from '@/lib/os/motion';
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
      minHeight: '100dvh', background: 'var(--st-stage)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'relative', flex: '0 0 55%', minHeight: '52vh' }}>
        {photo
          ? <Image src={photo} alt={photoAlt ?? `${ACT_TITLE[act]} — the studio’s photograph`} fill
              style={{ objectFit: 'cover' }} sizes="100vw" priority />
          : fallback}
        <div aria-hidden style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
          background: 'linear-gradient(transparent, var(--st-stage))',
        }} />
      </div>

      <div style={{
        padding: '0 var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-rest))',
        marginTop: -24, position: 'relative',
      }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={act} {...crossfade}>
            <Display tone="over">{ACT_TITLE[act]}</Display>
            <Body tone="over-2" style={{ fontSize: 19, marginTop: 'var(--st-line)' }}>{narration}</Body>
          </motion.div>
        </AnimatePresence>

        {meta && <div style={{ marginTop: 'var(--st-line)' }}>{meta}</div>}

        {children && <div style={{ marginTop: 'var(--st-rest)' }}>{children}</div>}

        <ol
          aria-label="The five acts of this visit"
          style={{
            display: 'flex', gap: 'var(--st-gap)', flexWrap: 'wrap',
            marginTop: 'var(--st-rest)', padding: 0, listStyle: 'none',
          }}
        >
          {acts.map(a => (
            <li
              key={a.act}
              aria-label={`${a.title} — ${STATE_WORD[a.state]}`}
              aria-current={a.state === 'current' ? 'step' : undefined}
              style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--st-hair)' }}
            >
              {a.state === 'done' && <Check />}
              <span aria-hidden style={{
                fontFamily: 'var(--st-text)', fontSize: 14, lineHeight: 1.45,
                color: a.state === 'coming' ? 'var(--st-over-2)' : 'var(--st-over)',
                fontWeight: a.state === 'current' ? 520 : 400,
              }}>
                {a.title}
              </span>
            </li>
          ))}
        </ol>

        {timing && <Whisper tone="over-2" style={{ marginTop: 'var(--st-gap)' }}>{timing}</Whisper>}
      </div>
    </div>
  );
}

/** The assent tick — drawn once; instant under reduced motion (MotionConfig). */
function Check() {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flex: '0 0 auto' }}>
      <motion.path
        d="M1.5 6.5 L4.5 9.5 L10.5 2.5"
        stroke="var(--st-assent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: tick, ease: studioEase }}
      />
    </svg>
  );
}
