'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  motion, useScroll, useTransform, useSpring, useReducedMotion,
} from 'framer-motion';
import { MapPin, Phone, Clock, ArrowRight } from 'lucide-react';
import { getServices } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import SlideToAction from '@/components/ui/SlideToAction';
import Wordmark from '@/components/ui/Wordmark';
import { STOCK, SERVICE_SHOWCASE } from '@/lib/stockImages';
import type { Service } from '@/lib/types';

const EASE = [0.22, 1, 0.36, 1] as const;

/* Section reveal — content-first (never gates visibility), eases position only. */
const rise = {
  initial: false as const,
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.8, ease: EASE },
};

/* ── Parallax photo: the image drifts slower than the page as it passes. ── */
function ParallaxImage({
  src, alt, priority = false, className = '', range = 12,
}: { src: string; alt: string; priority?: boolean; className?: string; range?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [`-${range}%`, `${range}%`]);
  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden ${className}`}>
      <motion.div className="absolute" style={{ inset: `-${range + 2}% 0`, y: reduced ? 0 : y }}>
        <Image src={src} alt={alt} fill priority={priority} sizes="100vw" className="object-cover" />
      </motion.div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [prices, setPrices] = useState<Record<string, number>>({});

  /* Journey progress hairline */
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  /* Hero parallax — image drifts, copy lifts + fades on scroll */
  const heroRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const heroImgY = useTransform(scrollY, [0, 700], ['0%', '18%']);
  const heroCopyY = useTransform(scrollY, [0, 600], [0, -60]);
  const heroFade = useTransform(scrollY, [0, 420], [1, 0]);

  useEffect(() => {
    getServices()
      .then(list => {
        const min: Record<string, number> = {};
        list.filter(s => s.active !== false).forEach((s: Service) => {
          if (!min[s.category] || s.price < min[s.category]) min[s.category] = s.price;
        });
        setPrices(min);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--void)', overflowX: 'clip' }}>

      {/* progress hairline */}
      <motion.div aria-hidden
        className="fixed top-0 left-0 right-0 z-50 h-[2px] origin-left pointer-events-none"
        style={{ scaleX: progress, background: 'var(--accent-grad)' }} />

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 glass-nav">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 py-4">
          <Wordmark height={19} />
          <Link href="/auth/login"
            className="font-mono"
            style={{
              fontSize: 11, letterSpacing: '0.1em', color: 'var(--fg)',
              border: '1px solid var(--border-strong)', borderRadius: 10,
              padding: '9px 18px', background: 'var(--accent-mist)',
            }}>
            SIGN IN
          </Link>
        </div>
      </header>

      {/* ══════════════ HERO ══════════════ */}
      <section ref={heroRef} className="relative h-[100svh] flex flex-col justify-end overflow-hidden">
        <motion.div style={{ y: reduced ? 0 : heroImgY }} className="absolute inset-0">
          <Image src={STOCK.hero} alt="Luxury car at the AutoModz detailing studio" fill priority
            sizes="100vw" className="object-cover" style={{ transform: 'scale(1.05)' }} />
        </motion.div>
        {/* readability scrim — dark bottom, clean top */}
        <div aria-hidden className="absolute inset-0" style={{
          background: 'linear-gradient(to top, var(--void) 4%, color-mix(in srgb, var(--void) 55%, transparent) 30%, transparent 62%)',
        }} />

        <motion.div style={{ y: reduced ? 0 : heroCopyY, opacity: heroFade }}
          className="relative z-10 max-w-6xl mx-auto w-full px-5 sm:px-8 pb-16 sm:pb-24">
          <motion.p {...rise} className="font-mono mb-4"
            style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--fg-dim)' }}>
            DETAILING ATELIER · MANINAGAR, AHMEDABAD
          </motion.p>
          <motion.h1 {...rise} className="font-hero"
            style={{ fontSize: 'clamp(38px, 9vw, 92px)', fontWeight: 800, lineHeight: 0.98, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
            The art of<br /><span className="text-ember">the finish.</span>
          </motion.h1>
          <motion.p {...rise} className="font-body mt-6 max-w-md"
            style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--muted)' }}>
            Paint protection, ceramic and studio-grade detailing for the cars you love — in Maninagar.
          </motion.p>
          <motion.div {...rise} className="mt-9 max-w-xs">
            <SlideToAction label="Slide to book" onComplete={() => router.push('/auth/login')} />
          </motion.div>
        </motion.div>

        {!reduced && (
          <motion.div aria-hidden className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10"
            animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
            <div className="w-5 h-9 rounded-full flex justify-center pt-2" style={{ border: '1.5px solid var(--border-strong)' }}>
              <div className="w-1 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
            </div>
          </motion.div>
        )}
      </section>

      {/* ══════════════ SERVICES ══════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 pt-24 sm:pt-32 pb-8">
        <motion.p {...rise} className="data-label mb-3" style={{ color: 'var(--muted)' }}>THE CRAFT</motion.p>
        <motion.h2 {...rise} className="font-display"
          style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.01em', color: 'var(--fg)', maxWidth: 620 }}>
          Four disciplines. One obsession with the surface.
        </motion.h2>
      </section>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-24 space-y-6">
        {SERVICE_SHOWCASE.map((s, i) => {
          const from = prices[s.cat] ?? s.from;
          return (
            <motion.article key={s.cat}
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, ease: EASE }}
              onClick={() => router.push('/auth/login')}
              className="group relative rounded-[28px] overflow-hidden cursor-pointer"
              style={{ height: 'clamp(340px, 52vw, 460px)', border: '1px solid var(--border)' }}>
              <ParallaxImage src={s.img} alt={`${s.name} on a luxury car`} priority={i === 0} />
              {/* readable scrim: solid caption band across the bottom (adapts light/dark) */}
              <div aria-hidden className="absolute inset-0" style={{
                background: 'linear-gradient(to top, var(--void) 0%, color-mix(in srgb, var(--void) 86%, transparent) 26%, color-mix(in srgb, var(--void) 40%, transparent) 52%, transparent 80%)',
              }} />
              <div className="relative z-10 h-full flex flex-col justify-end p-7 sm:p-10 max-w-lg">
                <span className="font-mono mb-3" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--fg-dim)' }}>
                  {String(i + 1).padStart(2, '0')} — {s.cat.toUpperCase()}
                </span>
                <h3 className="font-display" style={{ fontSize: 'clamp(24px, 4.4vw, 38px)', fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.01em', color: 'var(--fg)' }}>
                  {s.name}
                </h3>
                <p className="font-body mt-3" style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--fg-dim)', maxWidth: 380 }}>
                  {s.line}
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <span className="font-display font-800" style={{ fontSize: 18, color: 'var(--fg)' }}>
                    from {formatCurrency(from)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono transition-transform group-hover:translate-x-1"
                    style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--fg)' }}>
                    BOOK <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      {/* ══════════════ STUDIO STATEMENT ══════════════ */}
      <section className="relative overflow-hidden">
        <div className="relative h-[70svh] min-h-[440px] flex items-center">
          <ParallaxImage src={STOCK.studio} alt="Luxury car inside the AutoModz studio" range={14} />
          <div aria-hidden className="absolute inset-0" style={{
            background: 'linear-gradient(to top, var(--void) 6%, color-mix(in srgb, var(--void) 50%, transparent) 45%, color-mix(in srgb, var(--void) 30%, transparent) 100%)',
          }} />
          <div className="relative z-10 max-w-6xl mx-auto w-full px-5 sm:px-8">
            <motion.h2 {...rise} className="font-hero"
              style={{ fontSize: 'clamp(28px, 5.5vw, 56px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.015em', color: 'var(--fg)', maxWidth: 720 }}>
              No car leaves the studio until it looks better than the day it was delivered.
            </motion.h2>
            <motion.div {...rise} className="flex flex-wrap gap-x-12 gap-y-5 mt-10">
              {[
                { n: '5 min', l: 'TO BOOK' },
                { n: 'Live', l: 'STAGE TRACKING' },
                { n: '100%', l: 'PHOTOGRAPHED' },
              ].map(x => (
                <div key={x.l}>
                  <div className="font-display font-800 text-ember" style={{ fontSize: 26 }}>{x.n}</div>
                  <div className="font-mono mt-1" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)' }}>{x.l}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════ BOOK CTA ══════════════ */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32 text-center">
        <motion.h2 {...rise} className="font-hero"
          style={{ fontSize: 'clamp(30px, 6vw, 60px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
          Give your car the<br /><span className="text-ember">studio treatment.</span>
        </motion.h2>
        <motion.div {...rise} className="mt-10 max-w-xs mx-auto">
          <Link href="/auth/login" className="block w-full">
            <button className="btn-primary w-full !py-4 gap-2" style={{ fontSize: 14 }}>
              BOOK A SERVICE <ArrowRight size={16} />
            </button>
          </Link>
        </motion.div>
      </section>

      {/* ══════════════ FOOTER / LOCATION ══════════════ */}
      <footer className="relative z-10 px-5 sm:px-8 pb-12" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-6xl mx-auto pt-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
          <div>
            <Wordmark height={22} />
            <p className="font-body mt-4" style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--muted)', maxWidth: 320 }}>
              Bhairavnath Rd, Bhairavnath, Maninagar,<br />Ahmedabad, Gujarat 380028
            </p>
            <p className="font-mono flex items-center gap-1.5 mt-3" style={{ fontSize: 11, color: 'var(--faint)' }}>
              <Clock size={11} /> OPEN DAILY · 9:00 AM – 9:00 PM
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="tel:+919512605088" className="px-4 py-2.5 rounded-xl font-mono inline-flex items-center gap-1.5"
              style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--fg-dim)', border: '1px solid var(--border-2)', background: 'var(--fog)' }}>
              <Phone size={11} /> 95126 05088
            </a>
            <a href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl font-mono inline-flex items-center gap-1.5"
              style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--on-accent)', background: 'var(--accent-grad)' }}>
              <MapPin size={11} /> DIRECTIONS
            </a>
          </div>
        </div>
        <p className="max-w-6xl mx-auto font-mono mt-10" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--faint)' }}>
          © {new Date().getFullYear()} AUTOMODZ · CRAFTED IN AHMEDABAD
        </p>
      </footer>
    </div>
  );
}
