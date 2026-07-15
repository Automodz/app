'use client';
/**
 * Cinematic hero — a scroll-driven "car wash". The car starts dull and dusty;
 * as you scroll the first screen a band of foam sweeps across and reveals the
 * same car, glossy and clean. Text + the slide-to-book control ride in on the
 * same scroll. Pure CSS/transform driven off framer-motion's useScroll, so it
 * stays light and never blocks the paint. Respects reduced motion.
 */
import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { STOCK } from '@/lib/stockImages';
import SlideToAction from '@/components/ui/SlideToAction';

const EASE = [0.22, 1, 0.36, 1] as const;

export default function HeroWash({ onBook }: { onBook: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  // Foam sweeps left→right, then fades; the dirty layer wipes away with it.
  const foamX = useTransform(scrollYProgress, [0, 0.55], ['-30%', '130%']);
  const foamOpacity = useTransform(scrollYProgress, [0, 0.1, 0.5, 0.62], [0, 0.95, 0.95, 0]);
  const dirtyClip = useTransform(scrollYProgress, [0.05, 0.55], ['inset(0 0 0 0)', 'inset(0 0 0 100%)']);
  const cleanFilter = useTransform(scrollYProgress, [0, 0.6], ['saturate(1)', 'saturate(1.25) brightness(1.08)']);
  const carScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.16]);
  const contentY = useTransform(scrollYProgress, [0, 0.7], [0, -30]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6, 0.85], [1, 1, 0.7]);

  const still = !!reduce;

  return (
    <section ref={ref} className="relative" style={{ height: still ? '100svh' : '150svh' }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden flex flex-col items-center justify-center text-center px-6">
        {/* clean, glossy car underneath */}
        <motion.img
          src={STOCK.hero}
          alt="Freshly detailed car"
          aria-hidden
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ scale: still ? 1.1 : carScale, filter: still ? 'saturate(1.2) brightness(1.06)' : cleanFilter }}
        />
        {/* dusty/dull car on top — wiped away by the foam sweep */}
        {!still && (
          <motion.div className="absolute inset-0" style={{ clipPath: dirtyClip }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={STOCK.hero}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scale(1.1)', filter: 'saturate(0.35) brightness(0.72) contrast(0.92) sepia(0.25)' }}
            />
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-multiply"
              style={{
                background:
                  'radial-gradient(circle at 22% 34%, rgba(86,64,36,0.5) 0 8px, transparent 9px),' +
                  'radial-gradient(circle at 60% 26%, rgba(78,58,34,0.45) 0 6px, transparent 7px),' +
                  'radial-gradient(circle at 74% 66%, rgba(70,52,30,0.5) 0 12px, transparent 13px),' +
                  'radial-gradient(circle at 40% 74%, rgba(82,60,34,0.45) 0 9px, transparent 10px),' +
                  'linear-gradient(160deg, rgba(70,54,32,0.28), rgba(40,32,20,0.2))',
              }}
            />
          </motion.div>
        )}
        {/* the foam band */}
        {!still && (
          <motion.div
            aria-hidden
            className="absolute top-0 bottom-0"
            style={{
              left: 0,
              width: '46%',
              x: foamX,
              opacity: foamOpacity,
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.55) 30%, rgba(255,255,255,0.92) 50%, rgba(255,255,255,0.55) 70%, transparent)',
              filter: 'blur(2px)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.9) 0 5px, transparent 6px),' +
                  'radial-gradient(circle at 55% 60%, rgba(255,255,255,0.85) 0 7px, transparent 8px),' +
                  'radial-gradient(circle at 45% 85%, rgba(255,255,255,0.8) 0 4px, transparent 5px),' +
                  'radial-gradient(circle at 70% 35%, rgba(255,255,255,0.85) 0 6px, transparent 7px)',
              }}
            />
          </motion.div>
        )}
        {/* legibility veil — darker centre so the headline reads on any car */}
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,7,9,0.58) 0%, rgba(6,7,9,0.42) 45%, rgba(6,7,9,0.66) 100%)' }} />
        <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(60% 45% at 50% 50%, rgba(6,7,9,0.55) 0%, transparent 100%)' }} />

        {/* content */}
        <motion.div className="relative z-10 flex flex-col items-center" style={{ y: still ? 0 : contentY, opacity: still ? 1 : contentOpacity }}>
          <motion.p
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}
            className="font-mono mb-5" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.72)' }}>
            DETAILING STUDIO · MANINAGAR, AHMEDABAD
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.06 }}
            className="font-hero" style={{ fontSize: 'clamp(46px, 13vw, 108px)', fontWeight: 800, lineHeight: 0.94, letterSpacing: '-0.03em', color: '#fff', textShadow: '0 2px 40px rgba(0,0,0,0.6)' }}>
            The art of<br /><span className="text-ember">the finish.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.12 }}
            className="font-body mt-7 max-w-md mx-auto" style={{ fontSize: 17, lineHeight: 1.6, color: 'rgba(255,255,255,0.82)' }}>
            The studio in Maninagar that treats your car like it&rsquo;s the only one in the bay.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.18 }}
            className="mt-10 w-full max-w-sm">
            <SlideToAction label="Slide to book now" onComplete={onBook} />
          </motion.div>
          {!still && (
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 1 }}
              className="font-mono mt-10" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)' }}>
              SCROLL TO WASH ↓
            </motion.span>
          )}
        </motion.div>
      </div>
    </section>
  );
}
