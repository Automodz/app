'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  motion, useScroll, useTransform, useSpring, useMotionValue, useReducedMotion,
} from 'framer-motion';
import {
  ShieldCheck, Droplets, Gem, Layers, MapPin, Phone, Clock,
  ChevronDown, ArrowRight, Gauge, CalendarCheck, CarFront, Radar, KeyRound, Star,
} from 'lucide-react';
import { getGalleryImages, getServices, getActiveCarListings, type GalleryImage } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import GradientButton from '@/components/ui/GradientButton';
import type { CarListing, Service } from '@/lib/types';

const CATEGORY_META: Record<Service['category'], {
  icon: typeof Gem; title: string; tagline: string; verse: string;
}> = {
  PPF: {
    icon: ShieldCheck, title: 'Paint Protection Film',
    tagline: 'Invisible armour',
    verse: 'Self-healing film wrapped edge to edge. Stone chips, swirls and scratches never reach the paint.',
  },
  Ceramic: {
    icon: Gem, title: 'Ceramic Protection',
    tagline: 'Liquid glass, cured',
    verse: '9H nano-ceramic bonded to the clearcoat. Years of wet-look gloss from a single application.',
  },
  Coating: {
    icon: Layers, title: 'Coating Rituals',
    tagline: 'The maintenance layer',
    verse: 'Teflon, glass and top-up coats that keep the protection stack fresh between major services.',
  },
  Washing: {
    icon: Droplets, title: 'Wash & Detail',
    tagline: 'The foundation',
    verse: 'pH-neutral snow foam, two-bucket method, steam detail. Zero swirls, ever.',
  },
};
const CATEGORY_ORDER: Service['category'][] = ['PPF', 'Ceramic', 'Coating', 'Washing'];

const EASE = [0.22, 1, 0.36, 1] as const;

/* Content-first: sections never gate visibility on JS — motion eases position only. */
const drift = {
  initial: false as const,
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease: EASE },
};

/* ── Chrome car silhouette — a single continuous line with a travelling
     specular sweep, tilting subtly toward the pointer. ── */
function ChromeCar({ tiltX, tiltY }: { tiltX: ReturnType<typeof useSpring>; tiltY: ReturnType<typeof useSpring> }) {
  return (
    <motion.div
      aria-hidden
      style={{ rotateX: tiltY, rotateY: tiltX, transformPerspective: 900 }}
      className="w-full max-w-[560px] mx-auto select-none pointer-events-none">
      <svg viewBox="0 0 560 200" fill="none" className="w-full h-auto">
        <defs>
          <linearGradient id="carSweep" x1="0" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--chrome)" stopOpacity="0.10" />
            <stop offset="0.45" stopColor="var(--chrome)" stopOpacity="0.10" />
            <stop offset="0.5" stopColor="var(--chrome)" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="var(--chrome)" stopOpacity="0.10" />
            <stop offset="1" stopColor="var(--chrome)" stopOpacity="0.10" />
            <animate attributeName="x1" values="-560;560" dur="5s" repeatCount="indefinite" />
            <animate attributeName="x2" values="0;1120" dur="5s" repeatCount="indefinite" />
          </linearGradient>
          <linearGradient id="carGround" x1="0" y1="0" x2="560" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--chrome)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--chrome)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--chrome)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* body line — low, wide GT stance */}
        <path
          d="M40 150 h60 c6 -26 28 -42 54 -42 c26 0 46 16 52 42 h100 c6 -26 28 -42 54 -42 c26 0 46 16 52 42 h58 c12 0 20 -8 18 -20 c-3 -18 -14 -30 -44 -36 l-70 -12 c-38 -28 -78 -44 -132 -44 c-44 0 -80 14 -110 40 l-84 16 c-24 5 -36 16 -38 34 c-1 12 6 22 18 22 h12"
          stroke="url(#carSweep)" strokeWidth="2.5" strokeLinecap="round" />
        {/* glasshouse */}
        <path d="M188 78 c26 -20 56 -30 92 -30 c40 0 72 12 102 34"
          stroke="var(--chrome)" strokeOpacity="0.28" strokeWidth="1.5" strokeLinecap="round" />
        {/* wheels */}
        <circle cx="154" cy="150" r="26" stroke="var(--chrome)" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="154" cy="150" r="9" stroke="var(--chrome)" strokeOpacity="0.30" strokeWidth="1.5" />
        <circle cx="360" cy="150" r="26" stroke="var(--chrome)" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="360" cy="150" r="9" stroke="var(--chrome)" strokeOpacity="0.30" strokeWidth="1.5" />
        {/* ground reflection */}
        <line x1="30" y1="184" x2="530" y2="184" stroke="url(#carGround)" strokeWidth="1" />
      </svg>
    </motion.div>
  );
}

/* ── Manifesto line that brightens as it crosses the viewport centre ── */
function ManifestoLine({ children, index }: { children: string; index: number }) {
  return (
    <motion.p
      initial={false}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-25% 0px -25% 0px' }}
      transition={{ duration: 0.9, delay: index * 0.12, ease: EASE }}
      className="font-hero"
      style={{
        fontSize: 'clamp(22px, 5.4vw, 44px)', fontWeight: 700, lineHeight: 1.25,
        letterSpacing: '-0.01em', color: 'var(--chrome)',
      }}>
      {children}
    </motion.p>
  );
}

export default function HomePage() {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [cars, setCars] = useState<CarListing[]>([]);
  const [openCat, setOpenCat] = useState<Service['category'] | null>(null);
  const reduced = useReducedMotion();

  /* Scroll choreography */
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const heroTextY = useTransform(scrollY, [0, 600], [0, -70]);
  const heroFade  = useTransform(scrollY, [0, 460], [1, 0]);
  const carY      = useTransform(scrollY, [0, 600], [0, 90]);
  const horizonW  = useTransform(scrollY, [0, 400], ['64%', '100%']);

  /* Pointer-reactive tilt on the hero car */
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltX = useSpring(mx, { stiffness: 60, damping: 16 });
  const tiltY = useSpring(my, { stiffness: 60, damping: 16 });
  const onHeroPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 10);
    my.set(((e.clientY - r.top) / r.height - 0.5) * -8);
  };

  /* Scroll-drawn process timeline */
  const railRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: railProgress } = useScroll({
    target: railRef, offset: ['start 75%', 'end 55%'],
  });
  const railScale = useSpring(railProgress, { stiffness: 100, damping: 28 });

  useEffect(() => {
    getGalleryImages().then(g => setGallery(g.slice(0, 10))).catch(() => {});
    getServices().then(s => setServices(s.filter(x => x.active !== false))).catch(() => {});
    getActiveCarListings().then(l => setCars(l.slice(0, 6))).catch(() => {});
  }, []);

  const byCategory = useMemo(() => {
    const map = new Map<Service['category'], Service[]>();
    for (const cat of CATEGORY_ORDER) {
      const list = services.filter(s => s.category === cat).sort((a, b) => a.order - b.order);
      if (list.length) map.set(cat, list);
    }
    return map;
  }, [services]);

  const chapters = CATEGORY_ORDER.filter(c => byCategory.has(c));

  return (
    <div className="relative min-h-screen flex flex-col bg-mesh" style={{ overflowX: 'clip' }}>

      {/* Journey progress hairline */}
      <motion.div
        aria-hidden
        className="fixed top-0 left-0 right-0 z-50 h-[2px] origin-left pointer-events-none"
        style={{ scaleX: progress, background: 'linear-gradient(90deg, var(--accent-2), var(--chrome))' }} />

      {/* Header */}
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 py-4">
        <span className="font-hero" style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--chrome)' }}>
          AUTO<span className="text-ember">MODZ</span>
        </span>
        <Link href="/auth/login">
          <motion.button
            whileTap={{ scale: 0.94 }}
            className="font-mono cursor-pointer"
            style={{
              fontSize: '11px', letterSpacing: '0.1em', color: 'var(--ember)',
              border: '1px solid var(--accent-glow)', borderRadius: '8px',
              padding: '8px 16px', background: 'var(--accent-mist)',
            }}>
            SIGN IN
          </motion.button>
        </Link>
      </header>

      {/* ══ ACT I — THE LIGHT TUNNEL ══ */}
      <main
        onPointerMove={onHeroPointer}
        onPointerLeave={() => { mx.set(0); my.set(0); }}
        className="relative z-10 flex flex-col items-center justify-center px-6 text-center min-h-[94dvh] overflow-hidden">

        {/* overhead studio light */}
        <div aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[480px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, var(--accent-haze) 0%, var(--accent-mist) 42%, transparent 70%)' }} />

        <motion.div style={{ y: heroTextY, opacity: heroFade }} className="relative flex flex-col items-center">
          <motion.div
            initial={false}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full"
            style={{ background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ember)' }} />
            <span className="font-mono" style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'var(--ember-hot)' }}>
              DETAILING ATELIER · MANINAGAR
            </span>
          </motion.div>

          <h1 className="font-hero" style={{
            fontSize: 'clamp(30px, 8.5vw, 72px)', fontWeight: 800, lineHeight: 1.02,
            letterSpacing: '-0.015em', color: 'var(--chrome)', marginBottom: '8px',
          }}>
            <motion.span
              className="block"
              initial={false}
              transition={{ duration: 0.9, delay: 0.25, ease: EASE }}>
              LIGHT. PAINT.
            </motion.span>
            <motion.span
              className="block text-ember hero-sheen"
              initial={false}
              transition={{ duration: 0.9, delay: 0.4, ease: EASE }}>
              PERFECTION.
            </motion.span>
          </h1>

          {/* the car under the light */}
          <motion.div style={{ y: carY }} className="w-full mt-2 mb-2">
            <ChromeCar tiltX={tiltX} tiltY={tiltY} />
          </motion.div>

          {/* horizon line that widens as you scroll */}
          <motion.div aria-hidden className="h-px mb-8 mx-auto"
            style={{ width: horizonW, maxWidth: 560, background: 'linear-gradient(90deg, transparent, var(--border-strong), transparent)' }} />

          <motion.p
            initial={false}
            transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
            className="font-body"
            style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--muted)', maxWidth: '400px', marginBottom: '36px' }}>
            PPF, ceramic and studio-grade detailing. Book in minutes,
            watch every stage live, drive out under a deeper shine.
          </motion.p>

          <motion.div
            initial={false}
            transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
            className="w-full max-w-xs">
            <Link href="/auth/login" className="block w-full">
              <GradientButton size="lg" fullWidth>
                BOOK A SERVICE <ArrowRight size={16} />
              </GradientButton>
            </Link>
          </motion.div>

          <div className="mt-14 animate-float-sm">
            <div className="w-5 h-9 rounded-full mx-auto flex justify-center pt-2"
              style={{ border: '1.5px solid var(--border-2)' }}>
              <div className="w-1 h-2 rounded-full" style={{ background: 'var(--ember)' }} />
            </div>
          </div>
        </motion.div>
      </main>

      {/* ══ ACT II — THE MANIFESTO ══ */}
      <section className="relative z-10 px-6 py-24">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="data-label mb-2" style={{ color: 'var(--ember)' }}>THE HOUSE RULE</p>
          <ManifestoLine index={0}>No car leaves the studio</ManifestoLine>
          <ManifestoLine index={1}>until it looks better than</ManifestoLine>
          <ManifestoLine index={2}>the day it was delivered.</ManifestoLine>
          <motion.div {...drift} className="pt-6 flex items-center gap-6">
            {[
              { num: '5min', label: 'BOOKING' },
              { num: '24/7', label: 'LIVE TRACKING' },
              { num: '100%', label: 'PHOTOGRAPHED' },
            ].map(({ num, label }) => (
              <div key={label}>
                <span className="font-display text-ember block" style={{ fontSize: '20px', fontWeight: 700 }}>{num}</span>
                <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--faint)' }}>{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══ ACT III — THE CRAFT, IN CHAPTERS ══ */}
      <section className="relative z-10 px-6 pb-16">
        <motion.p {...drift} className="data-label text-center mb-1" style={{ color: 'var(--ember)' }}>
          THE CRAFT
        </motion.p>
        <motion.h2 {...drift} className="font-display text-center mb-10"
          style={{ fontSize: '26px', fontWeight: 800, color: 'var(--chrome)' }}>
          Four Disciplines
        </motion.h2>

        <div className="max-w-2xl mx-auto space-y-5">
          {chapters.map((cat, i) => {
            const list = byCategory.get(cat)!;
            const from = Math.min(...list.map(s => s.price));
            const { icon: Icon, title, tagline, verse } = CATEGORY_META[cat];
            const open = openCat === cat;
            return (
              <motion.article
                key={cat}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.6, delay: (i % 2) * 0.06, ease: EASE }}
                onClick={() => setOpenCat(open ? null : cat)}
                className="card-ember holo-surface relative overflow-hidden cursor-pointer p-6">
                {/* ghost numeral */}
                <span aria-hidden className="numeral-ghost font-hero absolute -top-3 right-2 select-none pointer-events-none">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--accent-mist)', border: '1px solid var(--accent-haze)' }}>
                        <Icon size={18} style={{ color: 'var(--ember)' }} />
                      </div>
                      <span className="data-label" style={{ color: 'var(--ember)' }}>{tagline.toUpperCase()}</span>
                    </div>
                    <h3 className="font-display font-800 text-lg mb-1.5" style={{ color: 'var(--chrome)' }}>{title}</h3>
                    <p className="font-body text-[13px]" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{verse}</p>
                  </div>
                  <ChevronDown size={16} className="shrink-0 mt-1 transition-transform duration-300"
                    style={{ color: 'var(--steel)', transform: open ? 'rotate(180deg)' : 'none' }} />
                </div>

                <div className="relative flex items-center justify-between mt-5">
                  <span className="data-label">from</span>
                  <span className="font-display font-800 text-lg text-ember">{formatCurrency(from)}</span>
                </div>

                {open && (
                  <div className="relative mt-4 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                    {list.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-3">
                        <p className="font-body font-600 text-[13px] truncate min-w-0" style={{ color: 'var(--fg-dim)' }}>
                          {s.name}
                          {s.warranty && <span className="font-mono ml-2" style={{ fontSize: '9px', color: 'var(--faint)' }}>{s.warranty}</span>}
                        </p>
                        <span className="font-mono text-xs shrink-0" style={{ color: 'var(--ember)' }}>{formatCurrency(s.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* ══ ACT IV — THE RITUAL (scroll-drawn timeline) ══ */}
      <section ref={railRef} className="relative z-10 px-6 py-16">
        <motion.p {...drift} className="data-label text-center mb-1" style={{ color: 'var(--ember)' }}>THE RITUAL</motion.p>
        <motion.h2 {...drift} className="font-display text-center mb-12"
          style={{ fontSize: '26px', fontWeight: 800, color: 'var(--chrome)' }}>
          Four Steps to Flawless
        </motion.h2>

        <div className="relative max-w-md mx-auto pl-12">
          {/* static rail + scroll-drawn fill */}
          <div aria-hidden className="absolute left-[25px] top-2 bottom-2 w-px" style={{ background: 'var(--border)' }} />
          <motion.div aria-hidden className="absolute left-[25px] top-2 bottom-2 w-px origin-top"
            style={{ scaleY: railScale, background: 'linear-gradient(180deg, var(--chrome), var(--accent-2))' }} />

          {[
            { icon: CalendarCheck, step: '01', title: 'Book', text: 'Pick a service & slot in the app — under five minutes.' },
            { icon: CarFront,      step: '02', title: 'Drop Off', text: 'We check in your car with photos of every panel.' },
            { icon: Radar,         step: '03', title: 'Track Live', text: 'Watch each stage move in real time, wherever you are.' },
            { icon: KeyRound,      step: '04', title: 'Drive Out', text: 'Digital invoice, before/after proof, glowing paint.' },
          ].map(({ icon: Icon, step, title, text }, i) => (
            <motion.div key={step}
              initial={false}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
              className="relative pb-10 last:pb-0">
              <div className="absolute -left-12 w-[52px] h-[52px] rounded-2xl flex items-center justify-center holo-surface"
                style={{ background: 'var(--card)', border: '1px solid var(--border-2)', boxShadow: 'var(--shadow-sm)' }}>
                <Icon size={20} style={{ color: 'var(--ember)' }} />
              </div>
              <div className="pl-4">
                <span className="data-label" style={{ color: 'var(--faint)' }}>{step}</span>
                <p className="font-display font-700 text-[16px] mt-0.5 mb-1" style={{ color: 'var(--chrome)' }}>{title}</p>
                <p className="font-body text-[13px]" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>{text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ ACT V — CERTIFIED CARS ══ */}
      {cars.length > 0 && (
        <motion.section {...drift} className="relative z-10 pt-4 pb-12">
          <div className="flex items-end justify-between px-6 max-w-4xl mx-auto mb-5">
            <div>
              <p className="data-label mb-1" style={{ color: 'var(--ember)' }}>BUY & SELL</p>
              <h2 className="font-display" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--chrome)' }}>
                Studio-Certified Cars
              </h2>
            </div>
            <Link href="/cars" className="font-mono inline-flex items-center gap-1 pb-1.5"
              style={{ fontSize: '11px', letterSpacing: '0.08em', color: 'var(--ember)' }}>
              VIEW ALL <ArrowRight size={12} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 px-6 no-scrollbar">
            {cars.map(car => (
              <Link key={car.id} href={`/cars/${car.id}`}
                className="shrink-0 w-60 rounded-2xl overflow-hidden card cursor-pointer">
                <div className="aspect-[4/3] relative" style={{ background: 'var(--dark)' }}>
                  {car.photos[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={car.photos[0].url} alt={car.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gauge size={24} style={{ color: 'var(--steel)' }} />
                    </div>
                  )}
                  {car.featured && (
                    <span className="absolute top-2 left-2 data-label px-2 py-1 rounded-lg"
                      style={{ background: 'var(--accent-grad)', color: 'var(--on-accent)' }}>FEATURED</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-body font-600 text-[13px] truncate" style={{ color: 'var(--chrome)' }}>{car.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono" style={{ fontSize: '10px', color: 'var(--faint)' }}>
                      {(car.kmDriven / 1000).toFixed(0)}k km · {car.fuel}
                    </span>
                    <span className="font-display font-800 text-sm text-ember">{formatCurrency(car.price)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* ══ ACT VI — PROOF OF WORK (drifting marquee) ══ */}
      {gallery.length > 0 && (
        <motion.section {...drift} className="relative z-10 pt-4 pb-8 overflow-hidden">
          <p className="data-label text-center mb-1" style={{ color: 'var(--ember)' }}>PROOF OF WORK</p>
          <h2 className="font-display text-center mb-6"
            style={{ fontSize: '26px', fontWeight: 800, color: 'var(--chrome)' }}>
            Fresh Out The Studio
          </h2>
          <div className={reduced ? 'flex gap-3 overflow-x-auto px-6 no-scrollbar' : 'marquee'}>
            <div className={reduced ? 'flex gap-3' : 'marquee-track flex gap-3'}>
              {(reduced ? gallery : [...gallery, ...gallery]).map((img, idx) => (
                <div key={`${img.id}-${idx}`} className="shrink-0 w-44 h-44 rounded-2xl overflow-hidden relative"
                  style={{ background: 'var(--dark)', border: '1px solid var(--border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.caption ?? img.category} className="w-full h-full object-cover" loading="lazy" />
                  <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded font-mono"
                    style={{
                      fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase',
                      background: 'var(--glass-2)', color: 'var(--ember-hot)',
                    }}>
                    {img.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* ══ ACT VII — WORD ON THE STREET ══ */}
      <motion.section {...drift} className="relative z-10 px-6 py-14">
        <p className="data-label text-center mb-1" style={{ color: 'var(--ember)' }}>WORD ON THE STREET</p>
        <h2 className="font-display text-center mb-8" style={{ fontSize: '26px', fontWeight: 800, color: 'var(--chrome)' }}>
          Drivers Who Came Back
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { name: 'Harsh P.', car: 'Thar · PPF', quote: 'Full-body PPF and you genuinely cannot tell it’s filmed. Stone chips on the highway just wipe off now.' },
            { name: 'Kunal S.', car: 'City · Ceramic', quote: 'The live tracker is addictive — watched my car move from foam wash to coating from my office desk.' },
            { name: 'Riya M.', car: 'XUV700 · Detail', quote: 'Interior looked showroom-new at delivery. The before/after photos in the invoice sold my whole family on it.' },
          ].map(({ name, car, quote }, i) => (
            <motion.figure key={name} initial={false} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
              className="card p-5 flex flex-col">
              <div className="flex gap-0.5 mb-3" aria-label="5 out of 5 stars">
                {[...Array(5)].map((_, s) => (
                  <Star key={s} size={13} fill="var(--ember)" style={{ color: 'var(--ember)' }} />
                ))}
              </div>
              <blockquote className="font-body text-[13px] flex-1" style={{ color: 'var(--fg-dim)', lineHeight: 1.75 }}>
                &ldquo;{quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="font-body font-600 text-sm" style={{ color: 'var(--chrome)' }}>{name}</p>
                <p className="data-label mt-0.5" style={{ color: 'var(--faint)' }}>{car}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </motion.section>

      {/* ══ FINALE — THE INVITATION ══ */}
      <motion.section {...drift} className="relative z-10 px-6 pb-16">
        <div className="relative card-ember holo-surface max-w-md mx-auto p-10 text-center overflow-hidden">
          <div aria-hidden className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-40 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, var(--accent-haze), transparent 70%)' }} />
          <p className="data-label mb-2" style={{ color: 'var(--ember)' }}>READY WHEN YOU ARE</p>
          <h3 className="font-hero font-800 mb-6" style={{ fontSize: '22px', lineHeight: 1.3, color: 'var(--chrome)' }}>
            Your car deserves the studio treatment.
          </h3>
          <Link href="/auth/login" className="block">
            <GradientButton size="lg" fullWidth>
              BOOK A SERVICE <ArrowRight size={16} />
            </GradientButton>
          </Link>
        </div>
      </motion.section>

      {/* Location & contact */}
      <motion.footer {...drift} className="relative z-10 px-6 pb-12 text-center"
        style={{ borderTop: '1px solid var(--border)' }}>
        <p className="pt-8 data-label" style={{ color: 'var(--ember)' }}>VISIT THE STUDIO</p>
        <p className="mt-3 font-body mx-auto"
          style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--muted)', maxWidth: 340 }}>
          Bhairavnath Rd, Bhairavnath, Maninagar,<br />Ahmedabad, Gujarat 380028
        </p>
        <p className="mt-2 font-mono flex items-center justify-center gap-1.5"
          style={{ fontSize: '11px', color: 'var(--faint)' }}>
          <Clock size={11} /> OPEN DAILY · 9:00 AM – 9:00 PM
        </p>
        <div className="flex items-center justify-center gap-3 mt-5">
          <a href="tel:+919512605088"
            className="px-4 py-2.5 rounded-xl font-mono inline-flex items-center gap-1.5"
            style={{
              fontSize: '11px', letterSpacing: '0.08em', color: 'var(--silver)',
              border: '1px solid var(--border-2)', background: 'var(--fog)',
            }}>
            <Phone size={11} /> 95126 05088
          </a>
          <a href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl font-mono inline-flex items-center gap-1.5"
            style={{
              fontSize: '11px', letterSpacing: '0.08em', color: 'var(--ember-hot)',
              border: '1px solid var(--accent-glow)', background: 'var(--accent-mist)',
            }}>
            <MapPin size={11} /> GET DIRECTIONS
          </a>
        </div>
        <p className="mt-8 font-mono" style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--faint)' }}>
          © {new Date().getFullYear()} AUTOMODZ · CRAFTED IN AHMEDABAD
        </p>
      </motion.footer>

    </div>
  );
}
