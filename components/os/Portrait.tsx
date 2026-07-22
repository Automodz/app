'use client';
/**
 * The vehicle hero (design system §7.1 · M1 · The Overture).
 *
 * The first frame of the film. The car (or, more often, the marque rendered as
 * a designed portrait) holds the screen; on load it settles into focus like a
 * camera finding it. As the owner begins to scroll, the frame does not cut - it
 * *tilts down*: the car drifts slower than the page (parallax), the name eases
 * away, and the lower edge dissolves into the paper of the journal beneath.
 * Every motion is scroll-linked or a single mount settle - nothing loops, and
 * all of it is dropped under reduced motion.
 */
import Image from 'next/image';
import { useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { studioEase, scene } from '@/lib/os/motion';
import { DisplayLarge } from './text';
import IdentityPlate from './IdentityPlate';
import TruthLine from './TruthLine';

interface PortraitProps {
  name: string;              // "Mercedes-AMG C 43"
  truth: string;
  photo?: string;            // customer/studio portrait URL
  plate?: string;            // shown only in typographic state
  minHeight?: string;        // default 92vh
  children?: ReactNode;      // overlay extras (avatar, page dots)
}

export default function Portrait({ name, truth, photo, plate, minHeight = '92vh', children }: PortraitProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [loaded, setLoaded] = useState(false);

  // the tilt-down: progress 0 (car held) → 1 (hero left the frame)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '8%']);      // car drifts slower than page
  const imgScale = useTransform(scrollYProgress, [0, 1], [1, 1.05]);     // a breath of depth
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-6%']); // the words lead the exit
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0]);

  const motionStyle = reduced ? undefined : { y: contentY, opacity: contentOpacity };

  return (
    <div ref={ref} style={{
      position: 'relative', minHeight, width: '100%', overflow: 'hidden',
      // stage is for photography only; without a photo the portrait is its own
      // studio-lit field (rendered by IdentityPlate)
      background: photo ? 'var(--st-stage)' : undefined,
      display: 'flex', alignItems: 'flex-end',
      // overlays (page dots) read their ink from the portrait's own rendering
      ['--st-portrait-fg' as string]: photo ? 'var(--st-over)' : 'var(--st-ink)',
      ['--st-portrait-fg-2' as string]: photo ? 'var(--st-over-2)' : 'var(--st-ink-3)',
    }}>
      {photo ? (
        <>
          {/* overscan so the parallax drift never reveals an edge */}
          <motion.div
            style={{
              position: 'absolute', top: '-12%', bottom: '-12%', left: 0, right: 0,
              ...(reduced ? {} : { y: imgY, scale: imgScale }),
            }}
          >
            <Image
              src={photo} alt={`Your ${name}`} fill priority
              className={`st-img${loaded ? ' is-loaded' : ''}`}
              onLoad={() => setLoaded(true)}
              style={{ objectFit: 'cover' }}
              sizes="100vw"
            />
          </motion.div>
          {/* status-bar legibility */}
          <div aria-hidden style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 64,
            background: 'linear-gradient(var(--st-scrim-soft), transparent)',
          }} />
          {/* bottom scrim - max 55%, lower 30% */}
          <div aria-hidden style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
            background: 'linear-gradient(transparent, var(--st-scrim-strong))',
          }} />
        </>
      ) : (
        // the marque portrait settles into focus on load - the camera finding it
        <motion.div
          style={{ position: 'absolute', inset: 0 }}
          initial={reduced ? false : { opacity: 0, scale: 1.03 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: scene, ease: studioEase }}
        >
          <IdentityPlate name={name} registration={plate} variant="portrait" />
        </motion.div>
      )}

      {/* THE HANDOFF: the hero's lower edge dissolves into the journal's paper -
          scrolling reads as the camera tilting off the car onto the page, never
          a cut. Sits below the name (which lives at 128px), above everything. */}
      <div aria-hidden style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '14%',
        background: 'linear-gradient(transparent, var(--st-paper))', pointerEvents: 'none',
      }} />

      <motion.div
        style={{
          position: 'relative', zIndex: 1, width: '100%',
          padding: '0 24px calc(env(safe-area-inset-bottom) + 128px)',
          ...motionStyle,
        }}
      >
        {photo ? (
          // the name and its truth arrive together - one settle, no loop
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: scene, ease: studioEase, delay: 0.08 }}
          >
            <DisplayLarge tone="over">{name}</DisplayLarge>
            <div style={{ height: 12 }} />
            <TruthLine text={truth} onPhoto />
          </motion.div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <TruthLine text={truth} />
          </div>
        )}
      </motion.div>

      {children}
    </div>
  );
}
