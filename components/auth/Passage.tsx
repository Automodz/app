'use client';
/**
 * THE PASSAGE — what the door says while it is opening.
 *
 * Signing in is not instant and never was: a popup opens on another origin, a
 * profile is read, a role is reconciled, and a session cookie is minted. For
 * all of that the screen used to show a spinner inside a button, which is the
 * smallest possible account of what is happening and says nothing about
 * whether it is going well.
 *
 * Two states, one surface. The surface is shared deliberately — the panel must
 * not resize underneath somebody mid-sign-in.
 *
 *   opening    the press was received and something is happening
 *   welcoming  the SESSION IS OPEN. Not a guess and not optimism: this state
 *              is only ever reached after the cookie exists, so the customer
 *              is being told a fact before they are carried inside.
 *
 * Its own component so both states can be rendered and asserted without
 * driving a popup on another origin — see __tests__/auth/passage.test.tsx.
 */
import { motion } from 'framer-motion';
import { Text } from '@/components/system';
import { color, space, radius, type as typeScale, duration, curve } from '@/design';

export type PassagePhase = 'opening' | 'welcoming';

export interface PassageProps {
  phase: PassagePhase;
  /** First name, when we have one. The welcome is warmer for it, never worse. */
  greeting?: string;
}

export function Passage({ phase, greeting }: PassageProps) {
  const arrived = phase === 'welcoming';

  return (
    <div style={{ paddingBlock: space.gap }} aria-live="polite">
      {/* The ring is the same breath the application boots with, so arriving
          and establishing read as one continuous thing rather than two
          unrelated loading treatments. */}
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 84 }}>
        <motion.span
          aria-hidden
          animate={
            arrived
              ? { scale: [0.9, 1], opacity: 1 }
              : { scale: [1, 1.08, 1], opacity: [0.55, 1, 0.55] }
          }
          transition={
            arrived
              ? { duration: duration.move / 1000, ease: curve.ease }
              : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            border: `2px solid ${arrived ? color.assent : color.ink3}`,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {arrived ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke={color.assent}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: duration.move / 1000, ease: curve.ease }}
              />
            </svg>
          ) : null}
        </motion.span>
      </div>

      <h1
        style={{
          fontFamily: typeScale.display.family,
          fontWeight: 700,
          fontSize: 'clamp(26px, 7vw, 34px)',
          lineHeight: 1.06,
          letterSpacing: '-0.02em',
          color: color.ink,
          margin: 0,
          marginTop: space.gap,
        }}
      >
        {arrived
          ? (greeting ? `Welcome, ${greeting}.` : 'Welcome back.')
          : 'Opening your studio'}
      </h1>
      <Text
        role="body"
        tone="ink2"
        style={{ marginTop: space.line, marginInline: 'auto', maxWidth: 300 }}
      >
        {arrived
          ? 'Taking you to your car.'
          : 'Confirming it’s you, then setting up your session.'}
      </Text>
    </div>
  );
}
