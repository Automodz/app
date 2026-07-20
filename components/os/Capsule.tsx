'use client';
/**
 * The concierge presence (design system §7.3). Glass pill, fixed above
 * safe-bottom; text crossfades; never moves, never badges.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { crossfade } from '@/lib/os/motion';

interface CapsuleProps {
  line: string;                       // state sentence ('' → wordmark rest state)
  actionWord?: string;                // trailing emphasis word ("Yes")
  onTap: () => void;
  onActionTap?: () => void;
  onLongPress?: () => void;
  onPhoto?: boolean;                  // rendered over photography
}

export default function Capsule({ line, actionWord, onTap, onActionTap, onLongPress, onPhoto }: CapsuleProps) {
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
        whileTap={{ scale: 0.98 }}
        aria-label={resting ? 'AutoModz concierge' : line}
        style={{
          pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', gap: 12,
          height: 52, maxWidth: 'min(560px, 100%)', minWidth: 180,
          padding: '0 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: onPhoto ? 'rgba(12,13,14,0.64)' : 'rgba(251,251,249,0.72)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          boxShadow: 'var(--st-lift)',
        }}
      >
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
            {resting ? 'AUTOMODZ' : line}
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
