'use client';
/**
 * THE BOOT SURFACES - the customer shell's first frames before the garage
 * exists on screen (P1 · the loading lifecycle).
 *
 * Two calm states in the Studio's own language (paper, the wordmark, the text
 * primitives, one curve): `StudioLoading` while the garage is fetched, and
 * `StudioError` when it can't be reached. Neither is a spinner screen and
 * neither is a browser error - a failure keeps the customer's trust by saying,
 * plainly, that their car is safe and offering exactly two ways forward.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { COMPANY, waLink } from '@/lib/company';
import { studioEase, move, rise } from '@/lib/os/motion';
import Action from './Action';
import { Display, Body, Data, Whisper } from './text';

/** The paper frame both states share - the wordmark caption sits at the top. */
function BootFrame({
  children,
  justify = 'center',
}: {
  children: React.ReactNode;
  justify?: 'center' | 'space-between';
}) {
  return (
    <div
      className="studio"
      style={{
        minHeight: '100vh', background: 'var(--st-paper)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: justify, overflowX: 'clip',
        padding: 'calc(env(safe-area-inset-top) + var(--st-rest)) var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-inset))',
      }}
    >
      {children}
    </div>
  );
}

/**
 * The loading breath. The wordmark holds the centre and rests - a slow opacity
 * pulse, never a spinner. Under reduced motion it simply sits still.
 */
export function StudioLoading({ caption }: { caption?: string }) {
  const reduced = useReducedMotion();
  return (
    <BootFrame>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--st-gap)' }}>
        <motion.div
          role="status"
          aria-label="Loading"
          animate={reduced ? undefined : { opacity: [0.45, 1, 0.45] }}
          transition={reduced ? undefined : { duration: 2.2, ease: studioEase, repeat: Infinity }}
        >
          <Whisper style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em' }}>AUTOMODZ</Whisper>
        </motion.div>
        {caption && <Whisper tone="ink-3" aria-hidden>{caption}</Whisper>}
      </div>
    </BootFrame>
  );
}

/**
 * The trustworthy failure. Human copy, the car declared safe, and exactly two
 * ways forward: try again, or reach the studio directly. Offline and a studio
 * outage read differently, because they are different promises.
 */
export function StudioError({
  kind, onRetry,
}: {
  kind: 'offline' | 'server';
  onRetry: () => void;
}) {
  const copy = kind === 'offline'
    ? {
        title: 'You’re offline.',
        body: 'Your garage is safe — it just needs a connection. The moment you’re back online, everything is here waiting.',
      }
    : {
        title: 'We couldn’t reach the studio.',
        body: 'Your car and its history are safe with us. This one’s on our side, not yours — a moment, and it should pass.',
      };

  return (
    <BootFrame justify="space-between">
      <Whisper tone="ink-2" style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em' }}>
        AUTOMODZ
      </Whisper>

      <motion.main {...rise} style={{ width: '100%', maxWidth: 420, padding: 'var(--st-rest) 0' }}>
        <Display style={{ fontSize: 'clamp(26px, 7vw, 32px)' }}>{copy.title}</Display>
        <Body tone="ink-2" style={{ marginTop: 'var(--st-line)' }} aria-live="polite">
          {copy.body}
        </Body>

        <div style={{ marginTop: 'var(--st-rest)', display: 'grid', gap: 'var(--st-line)', justifyItems: 'start' }}>
          <Action variant="primary" onClick={onRetry}>Try again</Action>
          <Action
            variant="quiet"
            onClick={() => window.open(
              waLink('Hi — I’m trying to open my AutoModz garage.'), '_blank',
            )}
          >
            Message the studio
          </Action>
        </div>
      </motion.main>

      <footer style={{ textAlign: 'center' }}>
        <Data tone="ink-3" as="p">{COMPANY.address}</Data>
      </footer>
    </BootFrame>
  );
}

/** A hairline crossfade so the app doesn't snap in behind the boot frame. */
export const bootReveal = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: move, ease: studioEase },
} as const;
