'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { STOCK } from '@/lib/stockImages';
import { MaskLines } from './Kinetic';
import Magnetic from './Magnetic';
import { useRM } from './useRM';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * The hook. A full-bleed photographic surface that drifts and settles under a
 * masked-headline reveal. Entrance is CSS-transition based (bulletproof: content
 * can never be stranded hidden); the scroll parallax is a Framer enhancement
 * that degrades to a static image. Reduced motion → instant, motionless, visible.
 */
export default function Hero() {
  const router = useRouter();
  const reduced = useRM();
  const ref = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '16%']);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.16]);

  const toCraft = () => {
    document.getElementById('craft')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  // staggered CSS entrance: hidden until mounted, then eased in
  const enter = (delay: number, y = 16): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'none' : `translateY(${y}px)`,
    transition: reduced ? 'none' : `opacity 0.9s ${EASE} ${delay}s, transform 0.9s ${EASE} ${delay}s`,
  });

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[600px] flex flex-col justify-end overflow-hidden">
      {/* photographic surface */}
      <motion.div className="absolute inset-0" style={{ y: reduced ? 0 : imgY, scale: reduced ? 1.06 : imgScale }}>
        <Image
          src={STOCK.hero}
          alt="A luxury car under studio inspection light at AutoModz"
          fill priority sizes="100vw" className="object-cover"
        />
      </motion.div>

      {/* legibility scrim + top vignette */}
      <div aria-hidden className="absolute inset-0" style={{
        background:
          'linear-gradient(to top, var(--void) 3%, color-mix(in srgb, var(--void) 52%, transparent) 32%, transparent 66%),' +
          'linear-gradient(to bottom, color-mix(in srgb, var(--void) 30%, transparent) 0%, transparent 22%)',
      }} />
      {/* film grain */}
      <div aria-hidden className="absolute inset-0 noise-overlay" />
      {/* inspection reticle — a thin surveyor's crosshair, barely there */}
      <div
        aria-hidden
        className="absolute right-[8%] top-[26%] hidden md:block"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'scale(1)' : 'scale(0.9)', transition: reduced ? 'none' : `opacity 1.2s ${EASE} 1.1s, transform 1.2s ${EASE} 1.1s` }}
      >
        <div className="relative w-24 h-24">
          <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--border-strong)' }} />
          <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: 'var(--border-strong)' }} />
          <div className="absolute inset-0 rounded-full animate-breathe" style={{ border: '1px solid var(--border-strong)' }} />
        </div>
      </div>

      {/* copy */}
      <div className="relative z-10 max-w-[1240px] mx-auto w-full px-5 sm:px-8 pb-[max(4.5rem,10vh)]">
        <p className="font-mono mb-5 flex items-center gap-3" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--fg-dim)', ...enter(0.15, 14) }}>
          <span className="inline-block w-8 h-px" style={{ background: 'var(--border-strong)' }} />
          PAINT PROTECTION · CERAMIC · CORRECTION
        </p>

        <h1 className="font-hero" style={{ fontSize: 'clamp(44px, 10vw, 118px)', fontWeight: 800, lineHeight: 0.92, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          <MaskLines
            lines={[<>The surface</>, <span key="e" className="text-ember">is everything.</span>]}
            delay={0.25}
          />
        </h1>

        <p className="font-body mt-7 max-w-[440px]" style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--muted)', ...enter(0.7) }}>
          Studio-grade paint protection, ceramic and correction in Maninagar —
          booked in minutes, and photographed at every stage.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3.5" style={enter(0.85)}>
          <Magnetic strength={0.45}>
            <button
              onClick={() => router.push('/auth/login')}
              className="group inline-flex items-center gap-2.5 font-display"
              style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.02em', color: 'var(--on-accent)', background: 'var(--accent)', borderRadius: 16, padding: '17px 26px', boxShadow: 'var(--shadow)' }}
            >
              Book a service
              <ArrowUpRight size={17} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </Magnetic>

          <button
            onClick={toCraft}
            className="inline-flex items-center gap-2 font-display transition-colors"
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)', borderRadius: 16, padding: '17px 22px', border: '1px solid var(--border-strong)', background: 'color-mix(in srgb, var(--void) 24%, transparent)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          >
            Explore the craft
          </button>
        </div>
      </div>

      {/* scroll cue */}
      <button
        onClick={toCraft}
        aria-label="Scroll to explore"
        className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10"
        style={{ opacity: mounted ? 1 : 0, transition: `opacity 1s ease 1.4s` }}
      >
        <span
          className={`block w-5 h-9 rounded-full flex justify-center pt-2 ${reduced ? '' : 'animate-float'}`}
          style={{ border: '1.5px solid var(--border-strong)' }}
        >
          <span className="block w-1 h-2 rounded-full" style={{ background: 'var(--fg)' }} />
        </span>
      </button>
    </section>
  );
}
