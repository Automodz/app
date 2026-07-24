'use client';
/**
 * The concierge presence (design system §7.3). Glass pill, fixed above
 * safe-bottom; text crossfades; never moves, never badges.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { crossfade, press, studioEase, tick } from '@/lib/os/motion';
import Wordmark from '@/components/ui/Wordmark';

interface CapsuleProps {
  line: string;                       // state sentence ('' → wordmark rest state)
  actionWord?: string;                // trailing emphasis word ("Yes")
  onTap: () => void;
  onActionTap?: () => void;
  onLongPress?: () => void;
  onPhoto?: boolean;                  // rendered over photography
  ready?: boolean;                    // the one memorable state - the car is done
}

export default function Capsule({ line, actionWord, onTap, onActionTap, onLongPress, onPhoto, ready }: CapsuleProps) {
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  const resting = line === '';

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
      display: 'flex', justifyContent: 'center', zIndex: 50, pointerEvents: 'none',
      paddingLeft: 24, paddingRight: 24,
    }}>
      <motion.button
        onClick={onTap}
        onPointerDown={() => { if (onLongPress) pressTimer = setTimeout(onLongPress, 350); }}
        onPointerUp={() => clearTimeout(pressTimer)}
        onPointerLeave={() => clearTimeout(pressTimer)}
        {...press}
        // the narrator's one memorable beat: when the car is ready the pill
        // draws a single breath as it settles, then holds still (reduced motion
        // keeps it perfectly calm - MotionConfig drops the keyframes)
        animate={ready ? { scale: [1, 1.035, 1] } : { scale: 1 }}
        transition={ready ? { duration: 0.5, ease: studioEase, times: [0, 0.4, 1] } : { duration: tick, ease: studioEase }}
        aria-label={resting ? 'AutoModz concierge' : line}
        style={{
          pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', gap: 12,
          height: 52, maxWidth: 'min(560px, 100%)', minWidth: 180,
          padding: '0 22px', borderRadius: 'var(--st-r-pill)', border: 'none', cursor: 'pointer',
          background: onPhoto ? 'var(--st-glass-on-photo)' : 'var(--st-glass)',
          backdropFilter: 'var(--st-glass-blur)',
          WebkitBackdropFilter: 'var(--st-glass-blur)',
          boxShadow: ready ? 'var(--st-raise)' : 'var(--st-lift)',
        }}
      >
        {/* the ready mark - a steady assent light, the only status the narrator
            ever shows. Calm on purpose: a finished car, not a busy process. */}
        {ready && (
          <span aria-hidden style={{
            width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto',
            background: 'var(--st-assent)',
          }} />
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resting ? '·rest·' : line}
            {...crossfade}
            style={{
              fontFamily: resting ? 'var(--st-display)' : 'var(--st-text)',
              fontWeight: resting ? 560 : 400,
              fontSize: resting ? 13 : 16,
              letterSpacing: resting ? '0.08em' : undefined,
              color: onPhoto ? 'var(--st-over)' : 'var(--st-ink)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {resting ? <Wordmark height={13} variant={onPhoto ? 'white' : 'auto'} /> : line}
          </motion.span>
        </AnimatePresence>
        {actionWord && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onActionTap?.(); }}
            style={{
              fontFamily: 'var(--st-text)', fontWeight: 520, fontSize: 16,
              color: onPhoto ? 'var(--st-over)' : 'var(--st-ink)',
            }}
          >
            {actionWord}
          </span>
        )}
      </motion.button>
    </div>
  );
}
