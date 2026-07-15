'use client';
/**
 * A chapter in the one-page scroll story. Content fades + rises in on scroll and
 * eases back out, so the persistent 3D car stage behind it is never fully hidden.
 * Under prefers-reduced-motion it renders static and fully visible.
 */
import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

export default function ScrollChapter({
  index,
  kicker,
  align = 'center',
  className = '',
  id,
  children,
}: {
  index?: string;
  kicker?: string;
  align?: 'center' | 'left';
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // fade/rise in, hold, fade out
  const opacity = useTransform(scrollYProgress, [0, 0.22, 0.78, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.22, 0.78, 1], [46, 0, 0, -46]);

  const style = reduce ? undefined : { opacity, y };

  return (
    <section
      ref={ref}
      id={id}
      className={`relative z-10 min-h-[100svh] flex flex-col justify-center px-6 py-20 ${align === 'center' ? 'items-center text-center' : 'items-start'} ${className}`}
    >
      <motion.div style={style} className={`w-full ${align === 'center' ? 'flex flex-col items-center' : ''}`}>
        {(index || kicker) && (
          <div className={`mb-6 flex items-center gap-3 ${align === 'center' ? 'justify-center' : ''}`}>
            {index && <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.24em', color: 'var(--fg-dim)' }}>{index}</span>}
            {index && kicker && <span aria-hidden style={{ width: 26, height: 1, background: 'var(--border-strong)' }} />}
            {kicker && <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.24em', color: 'var(--fg-dim)' }}>{kicker}</span>}
          </div>
        )}
        {children}
      </motion.div>
    </section>
  );
}
