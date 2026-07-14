'use client';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

/**
 * Scroll parallax wrapper. Content-first: children render fully visible with
 * no opacity gate; only translateY shifts on scroll (none under reduced
 * motion). Root uses overflow-x clip so shifted layers never cause
 * horizontal scroll.
 */
export default function ParallaxSection({
  children,
  background,
  speed = 0.15,
  className = '',
}: {
  children: ReactNode;
  /** Optional decorative layer rendered behind children with stronger drift. */
  background?: ReactNode;
  /** 0 = static, 0.3 = pronounced. */
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  // MotionValue transforms only after mount - SSR HTML carries no transform,
  // so hydration matches and content never depends on JS to be visible.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 80, speed * -80]);
  const yBg = useTransform(scrollYProgress, [0, 1], [speed * 200, speed * -200]);
  const active = mounted && !reduced;

  return (
    <section ref={ref} className={`relative ${className}`} style={{ overflowX: 'clip' }}>
      {background && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={active ? { y: yBg } : undefined}
          aria-hidden
        >
          {background}
        </motion.div>
      )}
      <motion.div className="relative" style={active ? { y } : undefined}>
        {children}
      </motion.div>
    </section>
  );
}
