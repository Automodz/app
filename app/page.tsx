'use client';
/**
 * AutoModz homepage - luxury automotive brand page, image-first and short.
 * Flow (~6 viewports): Hero (slide-to-book) → Services → Membership
 * → Before/After (visual proof, no labels) → Find us + reviews → Footer.
 *
 * Hero: close-up photorealistic paint/reflection shot (single swappable URL),
 * copy left, car right, liquid-glass cards on a warm blurred light stage.
 * Primary conversion is the Apple-style slide control. Reviews stay honest -
 * real Google profile only, no fabricated cards.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { MapPin, Phone, Navigation, Droplets } from 'lucide-react';
import { getServices } from '@/lib/firebaseService';
import { formatCurrency, getDurationLabel } from '@/lib/utils';
import SlideToAction from '@/components/ui/SlideToAction';
import Wordmark from '@/components/ui/Wordmark';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import WhatsAppFloat from '@/components/ui/WhatsAppFloat';
import SmoothScroll from '@/components/home/SmoothScroll';
import { MEDIA } from '@/lib/media';
import { SERVICES, SERVICE_ORDER } from '@/lib/catalog';
import { COMPANY, waLink, telLink } from '@/lib/company';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import type { Service } from '@/lib/types';

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-70px' },
  transition: { duration: 0.7, ease: EASE },
};

/** Vision-Pro-grade glass: layered fill, inner top highlight, saturated blur.
 *  `tint` scales the fill; pass warm=true for the champagne membership tier. */
const glass = (tint = 0.05, warm = false): React.CSSProperties => ({
  background: warm
    ? 'linear-gradient(170deg, rgba(255,178,122,0.14) 0%, rgba(255,255,255,0.05) 45%, rgba(255,178,122,0.05) 100%)'
    : `linear-gradient(180deg, rgba(255,255,255,${tint + 0.045}) 0%, rgba(255,255,255,${tint}) 55%, rgba(255,255,255,${Math.max(tint - 0.015, 0.015)}) 100%)`,
  backdropFilter: 'blur(24px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
  border: `1px solid ${warm ? 'rgba(255,178,122,0.32)' : 'rgba(255,255,255,0.10)'}`,
  boxShadow: `inset 0 1px 0 rgba(255,255,255,${warm ? 0.18 : 0.12}), inset 0 -1px 0 rgba(0,0,0,0.2), 0 24px 60px rgba(0,0,0,0.35)`,
});

// photorealistic hero - close-up paint & reflections. Swap this ONE url for the
// real studio shoot (BMW / Mercedes close-up) when licensed.


const NAV = [
  { label: 'Services', href: '#services' },
  { label: 'Membership', href: '#membership' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Contact', href: '#contact' },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  // brand intro: wordmark + light sweep, ~750ms, once per session
  const [intro, setIntro] = useState(false);
  // sticky slide CTA once the hero has scrolled away
  const [heroGone, setHeroGone] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 700], [0, 54]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && !sessionStorage.getItem('am-intro')) {
      sessionStorage.setItem('am-intro', '1');
      setIntro(true);
      const t = setTimeout(() => setIntro(false), 750);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!heroRef.current) return;
    const io = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting), { threshold: 0.1 });
    io.observe(heroRef.current);
    return () => io.disconnect();
  }, []);

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
    const h = new Date().getHours();
    setOpenNow(h >= 9 && h < 21);
  }, []);

  const book = () => router.push('/auth/login');

  return (
    <div className="relative" style={{ overflowX: 'clip', background: '#08090b' }}>
      <SmoothScroll />

      {/* ── brand intro: wordmark under a light sweep, then fade ── */}
      <AnimatePresence>
        {intro && (
          <motion.div key="intro" className="fixed inset-0 z-[60] grid place-items-center"
            style={{ background: '#08090b' }}
            exit={{ opacity: 0, transition: { duration: 0.35, ease: EASE } }}>
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: EASE }} className="relative overflow-hidden px-6 py-3">
              <Wordmark height="clamp(26px, 7vw, 40px)" variant="white" />
              <motion.div aria-hidden className="absolute inset-y-0 w-24"
                style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent)', filter: 'blur(6px)' }}
                initial={{ left: '-30%' }} animate={{ left: '110%' }}
                transition={{ duration: 0.55, ease: 'easeInOut', delay: 0.15 }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── sticky slide-to-book once the hero is gone ── */}
      <AnimatePresence>
        {heroGone && (
          <motion.div key="sticky-cta" className="fixed inset-x-0 z-40 flex justify-center pointer-events-none"
            style={{ bottom: 'calc(var(--sab) + 16px)' }}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.4, ease: EASE }}>
            <div className="pointer-events-auto w-[min(320px,80vw)]" style={{ filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.6))' }}>
              <SlideToAction label="Slide to book" onComplete={book} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ambient stage: blurred warm light + cool counter-glow, fixed ── */}
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute" style={{ top: '-12%', right: '-8%', width: '55vw', height: '55vw', maxWidth: 900, maxHeight: 900, background: 'radial-gradient(circle, rgba(255,120,40,0.16) 0%, transparent 62%)', filter: 'blur(60px)' }} />
        <div className="absolute" style={{ bottom: '-18%', left: '-10%', width: '50vw', height: '50vw', maxWidth: 800, maxHeight: 800, background: 'radial-gradient(circle, rgba(90,130,255,0.10) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div className="absolute inset-0 noise-overlay" style={{ opacity: 0.5 }} />
      </div>

      {/* ── header ── */}
      <header className="fixed top-0 inset-x-0 z-40" style={{ paddingTop: 'var(--sat)' }}>
        <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl px-4 py-2.5"
          style={{ background: 'rgba(14,15,18,0.55)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Wordmark height="clamp(16px, 4.6vw, 20px)" variant="white" />
          <nav className="hidden md:flex items-center gap-7">
            {NAV.map(n => (
              <a key={n.href} href={n.href} className="font-mono transition-colors hover:text-white"
                style={{ fontSize: 10, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)' }}>
                {n.label.toUpperCase()}
              </a>
            ))}
          </nav>
          <button onClick={book} className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: '#0b0c0e', background: '#fff', borderRadius: 10, padding: '10px 16px', minHeight: 40 }}>
            BOOK →
          </button>
        </div>
      </header>

      {/* ═══ HERO - split: copy left, close-up paint right ═══ */}
      <section ref={heroRef} className="relative z-10 md:min-h-[100svh] flex items-center px-6 pt-[calc(var(--sat)+84px)] pb-10 md:pt-24 md:pb-16">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-5 lg:gap-6 items-center">
          {/* copy stack */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
              className="font-mono mb-3" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)' }}>
              DETAILING STUDIO · MANINAGAR, AHMEDABAD
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: EASE, delay: 0.05 }}
              className="font-hero" style={{ fontSize: 'clamp(40px, 8.5vw, 72px)', fontWeight: 800, lineHeight: 0.96, letterSpacing: '-0.03em', color: '#fff' }}>
              The art of<br /><span style={{ background: 'linear-gradient(100deg, #fff 20%, #ffb27a 55%, #8ea2ff 90%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>the finish.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: EASE, delay: 0.12 }}
              className="font-body mt-3 lg:mt-6 max-w-md mx-auto lg:mx-0" style={{ fontSize: 16.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.62)' }}>
              PPF, ceramic and correction - photographed panel by panel, tracked live from your phone.
            </motion.p>

            {/* primary conversion: slide to book */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: EASE, delay: 0.18 }}
              className="mt-6 lg:mt-9 max-w-sm mx-auto lg:mx-0">
              <SlideToAction label="Slide to book" onComplete={book} />
              <a href="#services" className="font-mono inline-flex items-center mt-2 tap-target" style={{ fontSize: 10.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.45)' }}>
                EXPLORE SERVICES ↓
              </a>
            </motion.div>

          </div>

          {/* photoreal paint close-up - floating on the light stage */}
          <motion.div initial={{ opacity: 0, scale: 0.96, x: 24 }} animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.1 }}
            style={{ y: heroParallax }}
            className="relative order-1 lg:order-2">
            {/* bloom behind the car */}
            <div aria-hidden className="absolute -inset-8 pointer-events-none" style={{ background: 'radial-gradient(60% 55% at 60% 45%, rgba(255,140,60,0.10), transparent 70%)', filter: 'blur(30px)' }} />
            <div className="relative rounded-[28px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 12px 28px rgba(0,0,0,0.4), 0 48px 130px rgba(0,0,0,0.6), 0 0 110px rgba(255,120,40,0.1)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MEDIA.hero.homepage} alt="Close-up of freshly detailed paintwork" className="w-full object-cover max-h-[52vw] lg:max-h-none" style={{ aspectRatio: '4/3' }} />
              <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,9,11,0.35) 0%, transparent 30%), linear-gradient(200deg, transparent 40%, rgba(8,9,11,0.6) 100%)' }} />
              {/* glass rim highlight along the top edge */}
              <div aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35) 50%, transparent)' }} />
              {/* liquid-glass rating card */}
              <div className="absolute bottom-4 left-4 right-4 sm:right-auto flex items-center gap-3 rounded-2xl px-4 py-3"
                style={glass(0.04)}>
                <GoogleG />
                <div>
                  <p className="font-display" style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Rated on Google</p>
                  <a href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer"
                    className="font-body underline-offset-2 hover:underline" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>
                    Read reviews from real owners →
                  </a>
                </div>
              </div>
            </div>
            {/* floating reflection */}
            <div aria-hidden className="hidden lg:block absolute -bottom-10 left-8 right-8 h-10 rounded-[50%]" style={{ background: 'radial-gradient(ellipse, rgba(255,140,60,0.18), transparent 70%)', filter: 'blur(14px)' }} />
          </motion.div>
        </div>
      </section>

      {/* ── trust strip - proof five seconds in ── */}
      <section aria-label="Why owners trust AutoModz" className="relative z-10 px-6">
        <motion.div {...reveal} className="max-w-5xl mx-auto rounded-2xl px-5 py-4 flex items-center justify-center gap-x-7 gap-y-2 flex-wrap"
          style={glass(0.03)}>
          {[
            <a key="g" href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 inline-flex items-center" style={{ color: '#ffb27a', minHeight: 44 }}>★★★★★ <span style={{ color: 'rgba(255,255,255,0.55)' }}>ON GOOGLE</span></a>,
            <span key="p" style={{ color: 'rgba(255,255,255,0.55)' }}>PPF EXPERTS</span>,
            <span key="c" style={{ color: 'rgba(255,255,255,0.55)' }}>CERAMIC SPECIALISTS</span>,
            <span key="v" style={{ color: 'rgba(255,255,255,0.55)' }}>500+ VEHICLES PROTECTED</span>,
            <span key="s" style={{ color: 'rgba(255,255,255,0.55)' }}>SINCE 2025</span>,
          ].map((item, i, arr) => (
            <span key={i} className="font-mono inline-flex items-center gap-7" style={{ fontSize: 9.5, letterSpacing: '0.16em' }}>
              {item}
              {i < arr.length - 1 && <span aria-hidden style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ═══ SERVICES - image cards with glass overlay + price/warranty/duration ═══ */}
      <section id="services" className="relative z-10 px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <ChapterSeam />
        <SectionHead index={1} kicker="THE CRAFT" title="Four disciplines. One standard." />
        <div className="grid sm:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {SERVICE_ORDER.map((cat, i) => {
            const s = SERVICES[cat];
            const from = prices[s.cat] ?? s.from;
            const featured = s.cat === 'PPF';
            return (
              <motion.article key={cat} {...reveal} transition={{ ...reveal.transition, delay: (i % 2) * 0.07 }}
                onClick={book}
                whileHover={{ y: -4 }}
                className={`group relative rounded-[26px] overflow-hidden cursor-pointer ${featured ? 'sm:col-span-2' : ''}`}
                style={{ minHeight: featured ? 400 : 340, border: `1px solid ${featured ? 'rgba(255,178,122,0.25)' : 'rgba(255,255,255,0.08)'}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 60px rgba(0,0,0,0.4)' }}>
                {featured && (
                  <span className="absolute top-4 right-4 z-10 font-mono rounded-full px-3 py-1.5"
                    style={{ fontSize: 9, letterSpacing: '0.16em', color: '#ffb27a', background: 'rgba(10,10,12,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,178,122,0.4)' }}>
                    MOST POPULAR
                  </span>
                )}
                <Image src={s.img} alt={s.name} fill sizes="(max-width:640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]" />
                {/* editorial overlay: type sits on the photograph, no inner card */}
                <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,7,9,0.15) 0%, transparent 30%, transparent 45%, rgba(6,7,9,0.92) 100%)' }} />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                  <h3 className="font-display" style={{ fontSize: featured ? 24 : 20, fontWeight: 800, letterSpacing: '-0.015em', color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>{s.name}</h3>
                  <p className="font-body mt-1 max-w-md" style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)' }}>{s.detail}</p>
                  <p className="font-mono mt-3" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)' }}>
                    FROM {formatCurrency(from)}
                    {s.warranty ? ` · ${s.warranty.toUpperCase()} WARRANTY` : ''}
                    {` · ${getDurationLabel(s.durationMin).toUpperCase()}`}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* ═══ BUY / SELL - the marketplace, two doors ═══ */}
      <section id="cars" className="relative z-10 px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <ChapterSeam />
        <SectionHead index={2} kicker="MARKETPLACE" title="Cars, kept honest." />
        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {[
            { title: 'Buy a car', line: 'Studio-inspected listings with full service history.', cta: 'Browse cars', href: '/cars', img: MEDIA.fallbacks.car },
            { title: 'Sell your car', line: 'List it in minutes - we photograph and vet every car.', cta: 'Start selling', href: '/dashboard/sell-car', img: MEDIA.fallbacks.vehicle },
          ].map((t, i) => (
            <motion.div key={t.href} {...reveal} transition={{ ...reveal.transition, delay: i * 0.07 }}>
              <Link href={t.href}
                className="group relative flex flex-col justify-end rounded-[26px] overflow-hidden"
                style={{ minHeight: 220, border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 60px rgba(0,0,0,0.4)' }}>
                <Image src={t.img} alt={t.title} fill sizes="(max-width:640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]" />
                <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,7,9,0.2) 0%, transparent 35%, rgba(6,7,9,0.92) 100%)' }} />
                <div className="relative p-5 md:p-6">
                  <h3 className="font-display" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.015em', color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>{t.title}</h3>
                  <p className="font-body mt-1 max-w-xs" style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)' }}>{t.line}</p>
                  <p className="font-mono mt-3 inline-flex items-center gap-1.5" style={{ fontSize: 9.5, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.55)' }}>
                    {t.cta.toUpperCase()} <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ MEMBERSHIP - benefit first, plans second ═══ */}
      <section id="membership" className="relative z-10 px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <ChapterSeam />
        <SectionHead index={3} kicker="MEMBERSHIP" title="Protect your car, all year." />
        <motion.div {...reveal} className="flex items-center justify-center gap-x-6 gap-y-2 flex-wrap max-w-2xl mx-auto -mt-4 mb-10">
          {['MONTHLY PREMIUM WASHES', 'PRIORITY BOOKING', 'MEMBER PRICING'].map((b, i, arr) => (
            <span key={b} className="font-mono inline-flex items-center gap-6" style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.5)' }}>
              {b}
              {i < arr.length - 1 && <span aria-hidden style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>}
            </span>
          ))}
        </motion.div>
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {MEMBERSHIP_PLANS.map((p, i) => (
            <motion.button key={p.id} {...reveal} transition={{ ...reveal.transition, delay: i * 0.07 }} onClick={book}
              whileHover={{ y: -4 }} whileTap={{ scale: 0.98, y: 0 }}
              className="group relative overflow-hidden rounded-[22px] p-6 text-left flex flex-col justify-between"
              style={{
                aspectRatio: '1.586',
                // black-card face: near-black metal, soft top light, hairline edge
                background: i === 1
                  ? 'radial-gradient(120% 120% at 20% 0%, #221c16 0%, #121011 55%, #0a0a0c 100%)'
                  : 'radial-gradient(120% 120% at 20% 0%, #1c1e22 0%, #101114 55%, #0a0b0d 100%)',
                border: `1px solid ${i === 1 ? 'rgba(255,178,122,0.35)' : 'rgba(255,255,255,0.12)'}`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -12px 30px rgba(0,0,0,0.5), 0 24px 60px rgba(0,0,0,0.55)',
              }}>
              {/* brushed-metal sheen - travels across the face on hover */}
              <div aria-hidden className="absolute inset-0 pointer-events-none transition-transform duration-[1200ms] ease-out -translate-x-1/3 group-hover:translate-x-1/3"
                style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.08) 45%, transparent 60%)' }} />
              <div aria-hidden className="absolute inset-0 noise-overlay pointer-events-none" style={{ opacity: 0.35 }} />
              <div className="flex items-start justify-between">
                <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.4)' }}>AUTOMODZ MEMBER</span>
                {i === 1 && <span className="font-mono px-2 py-0.5 rounded-full" style={{ fontSize: 8.5, letterSpacing: '0.1em', color: '#ffb27a', border: '1px solid rgba(255,178,122,0.35)' }}>POPULAR</span>}
              </div>
              <div>
                <span className="font-display block" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>{p.label}</span>
                <div className="flex items-end justify-between gap-3 mt-1.5">
                  <p className="font-display whitespace-nowrap" style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
                    {formatCurrency(p.price)}<span className="font-body" style={{ fontSize: 11.5, fontWeight: 400, color: 'rgba(255,255,255,0.45)' }}> /mo</span>
                  </p>
                  <p className="font-body inline-flex items-center gap-1.5 pb-1 whitespace-nowrap" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    <Droplets size={12} /> {p.washesPerMonth} washes
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ═══ BEFORE / AFTER - visual proof, no labels needed ═══ */}
      <section id="gallery" className="relative z-10 px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <ChapterSeam />
        <SectionHead index={4} kicker="THE DIFFERENCE" title="Drag. See for yourself." />
        <motion.div {...reveal} className="relative max-w-3xl mx-auto">
          {/* cinematic frame: bloom under, glass rim around */}
          <div aria-hidden className="absolute -inset-6 pointer-events-none" style={{ background: 'radial-gradient(55% 50% at 50% 60%, rgba(255,140,60,0.08), transparent 70%)', filter: 'blur(24px)' }} />
          <div className="relative rounded-[26px] p-2" style={glass(0.03)}>
            <BeforeAfterSlider
              before={MEDIA.beforeAfter.ceramic.before}
              after={MEDIA.beforeAfter.ceramic.after}
              dirtBefore
              showLabels={false}
              beforeFilter="saturate(0.5) brightness(0.82) contrast(0.94) sepia(0.18) blur(0.4px)"
              afterFilter="saturate(1.18) contrast(1.1) brightness(1.04)"
              alt="The same car - dirty before, detailed after" />
          </div>
        </motion.div>
      </section>

      {/* ═══ CONTACT - closing ═══ */}
      <section id="contact" className="relative z-10 px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <ChapterSeam />
        <SectionHead index={5} kicker="CONTACT" title="Bring it by. We’ll take it from here." />
        <div className="max-w-2xl mx-auto">
          <motion.div {...reveal} className="rounded-[26px] overflow-hidden" style={glass(0.035)}>
            <div className="relative h-44">
              <iframe
                title="AutoModz on Google Maps"
                src="https://www.google.com/maps?q=AutoModz+Maninagar+Ahmedabad+Bhairavnath+Rd&output=embed"
                loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full" style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg) grayscale(0.35) contrast(0.92) brightness(0.9)' }} />
            </div>
            <div className="p-5 md:p-6">
              {/* studio identity row: name + live hours */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-display" style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>AutoModz Detailing Studio</p>
                  <p className="font-body mt-1 flex items-start gap-1.5" style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.6)' }}>
                    <MapPin size={13} className="mt-0.5 shrink-0" /> Bhairavnath Rd, Maninagar, Ahmedabad 380028
                  </p>
                </div>
                {openNow !== null && (
                  <span className="inline-flex items-center gap-1.5 font-mono rounded-full px-3 py-1.5 shrink-0"
                    style={{ fontSize: 9, letterSpacing: '0.12em', color: openNow ? '#5FBF8F' : 'rgba(255,255,255,0.45)', border: `1px solid ${openNow ? 'rgba(95,191,143,0.3)' : 'rgba(255,255,255,0.12)'}` }}>
                    <span className="rounded-full" style={{ width: 6, height: 6, background: openNow ? '#5FBF8F' : 'rgba(255,255,255,0.3)' }} />
                    {openNow ? 'OPEN' : 'CLOSED'} · 9 AM – 9 PM
                  </span>
                )}
              </div>

              {/* four ways in - every path a customer actually uses */}
              <div className="grid grid-cols-2 gap-2.5 mt-5">
                {[
                  { label: 'CALL', icon: <Phone size={13} />, href: telLink() },
                  { label: 'WHATSAPP', icon: <WhatsAppMark size={13} />, href: waLink(`Hi ${COMPANY.name}! I'd like to book a detailing slot.`) },
                  { label: 'REVIEWS', icon: <GoogleG size={13} />, href: 'https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9' },
                  { label: 'DIRECTIONS', icon: <Navigation size={13} />, href: 'https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9', primary: true },
                ].map(a => (
                  <a key={a.label} href={a.href}
                    {...(a.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="inline-flex items-center justify-center gap-2 rounded-xl font-mono tap-target transition-transform active:scale-[0.97]"
                    style={{
                      minHeight: 48, fontSize: 10.5, letterSpacing: '0.1em',
                      ...(a.primary
                        ? { color: '#0b0c0e', background: 'linear-gradient(180deg, #fff, #e9ebef)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }
                        : { color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)' }),
                    }}>
                    {a.icon} {a.label}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="relative z-10 px-6 pb-14 pt-16 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex flex-col items-center gap-6">
          <Wordmark height="clamp(18px, 5vw, 24px)" variant="white" />
          <div className="flex items-center gap-8 font-mono" style={{ fontSize: 9.5, letterSpacing: '0.16em' }}>
            <a href={telLink()} className="tap-target inline-flex items-center" style={{ color: 'rgba(255,255,255,0.45)' }}>CALL</a>
            <a href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer" className="tap-target inline-flex items-center" style={{ color: 'rgba(255,255,255,0.45)' }}>DIRECTIONS</a>
            <Link href="/auth/login" className="tap-target inline-flex items-center" style={{ color: 'rgba(255,255,255,0.45)' }}>SIGN IN</Link>
          </div>
          <p className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.28)' }}>
            © {new Date().getFullYear()} AUTOMODZ · CRAFTED IN AHMEDABAD
          </p>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}

/* ── shared bits ── */

/** The seam that opens a chapter: a full-bleed hairline horizon so each section
 *  reads as a new page rather than the next paragraph of one long document. */
function ChapterSeam() {
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 pointer-events-none">
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.11) 50%, transparent)' }} />
      <div className="h-24" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.022), transparent)' }} />
    </div>
  );
}

function SectionHead({ index, kicker, title, sub }: { index: number; kicker: string; title: string; sub?: string }) {
  return (
    <div className="relative text-center max-w-2xl mx-auto mb-12 md:mb-16">
      {/* the chapter number, ghosted behind the head - the editorial page mark.
          Static (not a reveal) so its centering transform is never clobbered by
          an animated one, and so the page mark is always present. */}
      <span
        aria-hidden
        className="font-hero pointer-events-none select-none absolute left-1/2 -translate-x-1/2"
        style={{
          top: 'clamp(-46px, -7vw, -34px)', lineHeight: 1, whiteSpace: 'nowrap',
          fontSize: 'clamp(76px, 15vw, 132px)', fontWeight: 800, letterSpacing: '-0.04em',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,178,122,0.05) 58%, transparent)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        }}
      >
        {String(index).padStart(2, '0')}
      </span>
      <motion.p {...reveal} transition={{ ...reveal.transition, delay: 0.04 }} className="relative font-mono mb-3"
        style={{ fontSize: 10.5, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.42)' }}>{kicker}</motion.p>
      <motion.h2 {...reveal} transition={{ ...reveal.transition, delay: 0.08 }} className="relative font-hero"
        style={{ fontSize: 'clamp(27px, 5.5vw, 44px)', fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.02em', color: '#fff' }}>
        {title}
      </motion.h2>
      {sub && <motion.p {...reveal} transition={{ ...reveal.transition, delay: 0.12 }} className="relative font-body mt-4"
        style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>{sub}</motion.p>}
    </div>
  );
}

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function WhatsAppMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}
