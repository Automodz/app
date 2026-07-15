'use client';
import Link from 'next/link';
import { useState } from 'react';
import { motion, useScroll, useMotionValueEvent, useSpring, useReducedMotion } from 'framer-motion';
import Wordmark from '@/components/ui/Wordmark';
import Magnetic from './Magnetic';

/**
 * The command bar. A glass rail that hides as you drive down the page and
 * snaps back the instant you scroll up (premium reading pattern). Carries the
 * live-open status pill, a scroll-progress hairline, and the magnetic primary
 * CTA. Solidifies its backdrop only once you leave the hero.
 */
export default function HomeNav() {
  const reduced = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(y > 120 && y > prev);
    setSolid(y > 40);
  });

  return (
    <motion.header
      initial={false}
      animate={{ y: hidden && !reduced ? '-110%' : '0%' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <div
        className="transition-colors duration-500"
        style={{
          background: solid ? 'var(--glass)' : 'transparent',
          backdropFilter: solid ? 'blur(22px) saturate(150%)' : 'none',
          WebkitBackdropFilter: solid ? 'blur(22px) saturate(150%)' : 'none',
          borderBottom: `1px solid ${solid ? 'var(--border)' : 'transparent'}`,
        }}
      >
        <nav className="max-w-[1240px] mx-auto flex items-center justify-between px-5 sm:px-8 h-[68px]">
          <Link href="/" aria-label="AutoModz home" className="flex items-center">
            <Wordmark height={18} variant="ink" />
          </Link>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <span
              className="hidden sm:inline-flex items-center gap-2 font-mono"
              style={{ fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--muted)' }}
            >
              <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
              OPEN · 9–9
            </span>
            <Magnetic strength={0.35}>
              <Link
                href="/auth/login"
                className="inline-flex items-center font-mono transition-colors"
                style={{
                  fontSize: 11, letterSpacing: '0.12em', color: 'var(--on-accent)',
                  background: 'var(--accent)', borderRadius: 11, padding: '9px 18px',
                }}
              >
                BOOK
              </Link>
            </Magnetic>
          </div>
        </nav>
      </div>

      {/* scroll-progress hairline */}
      <motion.div
        aria-hidden
        className="h-[2px] origin-left"
        style={{ scaleX: progress, background: 'var(--accent)' }}
      />
    </motion.header>
  );
}
