'use client';
/**
 * THE STAGE RAIL - where the work has got to, as a rail of named steps.
 * (docs/JOURNEY-STAGES.md · Design Language §5)
 *
 * EXTRACTED, not written for one screen. It lived inside `MomentStage` and
 * only the live Visit could use it - but the same rail belongs on a sealed
 * Chapter and in the Journey, so it moves here and every surface reads the
 * work the same way.
 *
 * No bar, no percentage, no countdown: a track filled to the work's position,
 * done steps checked, the current one alive. The rail IS the progress
 * language - a percentage would imply a precision the floor never recorded.
 *
 * THE LAYOUT FIX IT CARRIES. At 375px the five acts wrapped - "Looked over"
 * and "Final checks" broke to two lines while their neighbours stayed on one,
 * so the row's baseline sheared and the labels collided. Labels now reserve a
 * uniform two-line box and shrink with the viewport, so the rail holds its
 * shape from 320px up.
 */
import { motion } from 'framer-motion';
import { studioEase, tick } from '@/lib/os/motion';

export type StageState = 'done' | 'current' | 'coming';

export interface RailStep {
  key: string;
  title: string;
  state: StageState;
}

const STATE_WORD: Record<StageState, string> = {
  done: 'done', current: 'happening now', coming: 'still to come',
};

export interface StageRailProps {
  steps: RailStep[];
  /** the rail sits over photography by default; `ink` puts it on paper */
  tone?: 'over' | 'ink';
  label?: string;
}

export default function StageRail({
  steps, tone = 'over', label = 'The acts of this visit',
}: StageRailProps) {
  const n = steps.length;
  if (!n) return null;

  const curIdx = steps.findIndex(s => s.state === 'current');
  const doneCount = steps.filter(s => s.state === 'done').length;
  const reached = curIdx >= 0 ? curIdx : Math.max(0, doneCount - 1);
  const fillPct = n > 1 ? (reached / (n - 1)) * 100 : 0;

  const ink = tone === 'over' ? 'var(--st-over)' : 'var(--st-ink)';
  const dim = tone === 'over' ? 'var(--st-over-2)' : 'var(--st-ink-2)';
  const ground = tone === 'over' ? 'var(--st-stage)' : 'var(--st-paper)';

  return (
    <ol
      aria-label={label}
      style={{
        position: 'relative', display: 'flex', justifyContent: 'space-between',
        margin: 0, padding: 0, listStyle: 'none',
      }}
    >
      {/* the track, and the fill to where the work actually is */}
      <div aria-hidden style={{
        position: 'absolute', top: 6, left: 7, right: 7, height: 2, borderRadius: 999,
        background: `color-mix(in srgb, ${ink} 16%, transparent)`,
      }} />
      <div aria-hidden style={{
        position: 'absolute', top: 6, left: 7, height: 2, borderRadius: 999,
        width: `calc((100% - 14px) * ${fillPct / 100})`,
        background: `linear-gradient(90deg, ${dim}, ${ink})`,
        transition: 'width var(--st-scene) var(--st-ease)',
      }} />

      {steps.map(s => (
        <li
          key={s.key}
          aria-label={`${s.title} - ${STATE_WORD[s.state]}`}
          aria-current={s.state === 'current' ? 'step' : undefined}
          style={{
            position: 'relative', zIndex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 'var(--st-breath)', flex: '1 1 0', minWidth: 0,
          }}
        >
          <span aria-hidden style={{
            position: 'relative', width: 14, height: 14, display: 'grid', placeItems: 'center',
          }}>
            <span
              className={s.state === 'current' ? 'st-node-live' : undefined}
              style={{
                width: s.state === 'coming' ? 10 : 14,
                height: s.state === 'coming' ? 10 : 14,
                borderRadius: '50%',
                background: s.state === 'coming' ? ground : ink,
                border: s.state === 'coming'
                  ? `2px solid color-mix(in srgb, ${ink} 28%, transparent)` : 'none',
                display: 'grid', placeItems: 'center',
              }}
            >
              {s.state === 'done' && <Check ground={ground} />}
            </span>
          </span>

          {/* every label reserves the same two lines, so one wrapping word
              cannot shear the row's baseline (the 375px defect) */}
          <span aria-hidden style={{
            fontFamily: 'var(--st-text)',
            fontSize: 'clamp(9.5px, 2.9vw, 11px)',
            lineHeight: 1.2,
            minHeight: '2.4em',
            textAlign: 'center',
            hyphens: 'auto',
            color: s.state === 'coming' ? dim : ink,
            fontWeight: s.state === 'current' ? 560 : 400,
            opacity: s.state === 'current' ? 1 : 0.82,
          }}>
            {s.title}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The assent tick - drawn once; instant under reduced motion (MotionConfig). */
function Check({ ground }: { ground: string }) {
  return (
    <svg aria-hidden width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ flex: '0 0 auto' }}>
      <motion.path
        d="M1.5 6.5 L4.5 9.5 L10.5 2.5"
        stroke={ground} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: tick, ease: studioEase }}
      />
    </svg>
  );
}
