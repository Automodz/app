'use client';
/**
 * AutoModz homepage — a single-page scroll story. A persistent vanilla-three.js
 * car stage lives fixed behind everything: it starts assembled, blows apart into
 * floating panels through the middle of the scroll, and reassembles by the end.
 * Content is told in chapters that fade + rise in over the car.
 *
 * The stage is client-only (next/dynamic ssr:false → three.js never touches the
 * server, dodging the r3f/Next-15 crash). Lenis gives inertial scroll; the whole
 * page's scroll progress drives the car. Reduced-motion / no-WebGL fall back to a
 * static studio backdrop with fully-visible content.
 *
 * The homepage is ALWAYS dark — an inline script forces data-theme="dark" before
 * paint. Imagery + review data are scaffold (flagged in source).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion';
import {
  Star, MapPin, Phone, ShieldCheck, Smartphone, IndianRupee, Clock, Navigation,
  CalendarCheck, SprayCan, Sparkles, CarFront,
} from 'lucide-react';
import { getServices } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import SlideToAction from '@/components/ui/SlideToAction';
import Wordmark from '@/components/ui/Wordmark';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import WhatsAppFloat from '@/components/ui/WhatsAppFloat';
import SmoothScroll from '@/components/home/SmoothScroll';
import ScrollChapter from '@/components/home/ScrollChapter';
import { SERVICE_SHOWCASE, STOCK } from '@/lib/stockImages';
import { REVIEWS, GOOGLE_RATING } from '@/lib/reviews';
import type { Service } from '@/lib/types';

const CarStage = dynamic(() => import('@/components/home/CarStage'), { ssr: false });

const COPY: Record<string, { title: string; line: string }> = {
  PPF:     { title: 'Paint Protection Film', line: 'A clear, self-healing skin. Stone chips and scratches hit the film — not your paint.' },
  Ceramic: { title: 'Ceramic Coating',       line: 'A glass-hard 9H coat. Water rolls off, dirt gives up, the gloss holds for years.' },
  Coating: { title: 'Detailing & Polish',    line: 'We chase out the swirls and bring the depth back — the shine it had on day one.' },
  Washing: { title: 'Wash & Care',           line: 'pH-neutral foam, steam and patience. A proper wash that never leaves a swirl.' },
};

function Stars({ n = 5, size = 14 }: { n?: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} strokeWidth={0} fill={i < n ? 'var(--accent)' : 'var(--border-strong)'} />
      ))}
    </span>
  );
}

/** Big chapter heading — Unbounded, with a soft glow so it reads over the car. */
function ChapterTitle({ children, size = 'clamp(30px, 7vw, 56px)' }: { children: React.ReactNode; size?: string }) {
  return (
    <h2 className="font-hero" style={{ fontSize: size, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em', color: 'var(--fg)', textShadow: '0 2px 40px rgba(0,0,0,0.55)' }}>
      {children}
    </h2>
  );
}

export default function HomePage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [openNow, setOpenNow] = useState<boolean | null>(null);

  // whole-page scroll progress → smoothed → drives the car assemble/explode rig
  const { scrollYProgress } = useScroll();
  const carProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });

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
    <div className="relative" style={{ overflowX: 'clip' }}>
      <SmoothScroll />

      {/* ── fixed studio backdrop + car stage ── */}
      <div aria-hidden className="fixed inset-0 z-0" style={{ background: 'radial-gradient(125% 85% at 50% 30%, #24272c 0%, #101216 55%, #08090b 100%)' }} />
      {!reduce && (
        <div className="fixed inset-0 z-0">
          <CarStage progress={carProgress} />
        </div>
      )}
      {reduce && (
        <div aria-hidden className="fixed inset-0 z-0 opacity-40">
          <Image src={STOCK.hero} alt="" fill priority sizes="100vw" className="object-cover" />
        </div>
      )}
      {/* legibility veil — darker top & bottom, open in the middle where the car blooms */}
      <div aria-hidden className="fixed inset-0 z-0" style={{ background: 'linear-gradient(180deg, rgba(8,9,11,0.72) 0%, rgba(8,9,11,0.28) 30%, rgba(8,9,11,0.28) 70%, rgba(8,9,11,0.78) 100%)' }} />
      <div aria-hidden className="fixed inset-0 z-0 noise-overlay" style={{ opacity: 'var(--lux-grain)' }} />

      {/* Header — glass */}
      <header className="fixed top-0 inset-x-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top,0px)' }}>
        <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl px-4 py-2.5"
          style={{ background: 'var(--glass)', backdropFilter: 'blur(18px) saturate(1.3)', WebkitBackdropFilter: 'blur(18px) saturate(1.3)', border: '1px solid var(--glass-border)' }}>
          <Wordmark height="clamp(16px, 4.6vw, 20px)" />
          <Link href="/auth/login" className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--fg)', border: '1px solid var(--border-strong)', borderRadius: 9, padding: '7px 14px' }}>
            SIGN IN
          </Link>
        </div>
      </header>

      {/* ═══ CHAPTER 01 — HERO (car assembled) ═══ */}
      <section className="relative z-10 min-h-[100svh] flex flex-col items-center justify-center text-center px-6">
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-mono mb-5" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--fg-dim)' }}>
          DETAILING STUDIO · MANINAGAR, AHMEDABAD
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
          className="font-hero" style={{ fontSize: 'clamp(46px, 13vw, 112px)', fontWeight: 800, lineHeight: 0.92, letterSpacing: '-0.03em', color: 'var(--fg)', textShadow: '0 2px 50px rgba(0,0,0,0.6)' }}>
          The art of<br /><span className="text-ember">the finish.</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
          className="font-body mt-7 max-w-md mx-auto" style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--muted)' }}>
          The studio in Maninagar that treats your car like it&rsquo;s the only one in the bay.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
          className="mt-10 w-full max-w-sm">
          <SlideToAction label="Slide to book now" onComplete={book} />
        </motion.div>
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }}
          className="font-mono absolute bottom-8" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--muted)' }}>
          SCROLL TO BEGIN ↓
        </motion.span>
      </section>

      {/* ═══ CHAPTER 02 — WHY (car starts to come apart) ═══ */}
      <ScrollChapter index="02" kicker="WHY AUTOMODZ">
        <ChapterTitle>Detailing,<br />taken apart.</ChapterTitle>
        <p className="font-body mt-5 max-w-lg mx-auto" style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--muted)' }}>
          We treat a car as a sum of panels — every one corrected, protected and photographed on its own.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto mt-10 w-full">
          {[
            { icon: ShieldCheck, t: 'Studio-grade correction', d: 'Dust-free bays, inspection lighting, no shortcuts. Flaws have nowhere to hide.' },
            { icon: Smartphone, t: 'Live stage tracking', d: 'Follow every stage of your car from your phone. Every panel photographed.' },
            { icon: IndianRupee, t: 'Honest pricing', d: 'Only what your car actually needs. No upselling, no surprises.' },
          ].map(p => (
            <div key={p.t} className="rounded-[22px] p-6 text-center flex flex-col items-center"
              style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)' }}>
              <span className="grid place-items-center rounded-2xl mb-4" style={{ width: 46, height: 46, background: 'var(--accent-mist)', border: '1px solid var(--border-strong)', color: 'var(--fg)' }}>
                <p.icon size={20} />
              </span>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--fg)' }}>{p.t}</h3>
              <p className="font-body mt-2" style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--muted)' }}>{p.d}</p>
            </div>
          ))}
        </div>
      </ScrollChapter>

      {/* ═══ CHAPTER 03 — SERVICES (car mid-explode) ═══ */}
      <ScrollChapter index="03" kicker="THE CRAFT" id="services">
        <ChapterTitle>What we do.</ChapterTitle>
        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto mt-10 w-full">
          {SERVICE_SHOWCASE.map((s) => {
            const from = prices[s.cat] ?? s.from;
            const c = COPY[s.cat];
            return (
              <article key={s.cat} onClick={book}
                className="group relative rounded-[24px] overflow-hidden cursor-pointer text-left" style={{ minHeight: 230, border: '1px solid var(--glass-border)' }}>
                <Image src={s.img} alt={c.title} fill sizes="(max-width:640px) 100vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="rounded-[18px] p-4" style={{ background: 'var(--glass-2)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)', border: '1px solid var(--glass-border)' }}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-display" style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--fg)' }}>{c.title}</h3>
                      <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>
                        <span className="font-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>FROM </span>{formatCurrency(from)}
                      </span>
                    </div>
                    <p className="font-body mt-2" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--fg-dim)' }}>{c.line}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </ScrollChapter>

      {/* ═══ CHAPTER 04 — THE DIFFERENCE (car reassembling) ═══ */}
      <ScrollChapter index="04" kicker="THE DIFFERENCE">
        <ChapterTitle>From grimy<br />to gleaming.</ChapterTitle>
        <p className="font-body mt-5 max-w-lg mx-auto" style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--muted)' }}>
          Drag across. The same car — dusty and dull on the left, corrected and glossed on the right.
        </p>
        <div className="max-w-2xl mx-auto mt-9 w-full">
          <BeforeAfterSlider
            before={STOCK.ceramic}
            after={STOCK.ceramic}
            dirtBefore
            beforeFilter="saturate(0.4) brightness(0.72) contrast(0.95) blur(0.5px)"
            alt="The same car — dirty before, clean after" />
        </div>
      </ScrollChapter>

      {/* ═══ CHAPTER 05 — HOW IT WORKS ═══ */}
      <ScrollChapter index="05" kicker="HOW IT WORKS">
        <ChapterTitle>Booked in a minute.</ChapterTitle>
        <p className="font-body mt-5 max-w-lg mx-auto" style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--muted)' }}>
          No calls, no back-and-forth. Slide to book, pick your service, track every stage from your phone.
        </p>
        <div className="max-w-3xl mx-auto grid sm:grid-cols-4 gap-3 mt-10 w-full">
          {[
            { icon: CalendarCheck, t: 'Book', d: 'Slide to book and pick a slot that suits you.' },
            { icon: CarFront,      t: 'Drop off', d: 'Bring it to the Maninagar studio — or we collect.' },
            { icon: SprayCan,      t: 'We detail', d: 'Every panel worked and photographed, live to your phone.' },
            { icon: Sparkles,      t: 'Glow', d: 'Pick it up gleaming. Pay in-app, done.' },
          ].map((s, i) => (
            <div key={s.t} className="relative rounded-[20px] p-5 text-center flex flex-col items-center"
              style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)' }}>
              <span className="font-mono absolute top-3 right-4" style={{ fontSize: 10, color: 'var(--faint)' }}>0{i + 1}</span>
              <span className="grid place-items-center rounded-2xl mb-3" style={{ width: 44, height: 44, background: 'var(--accent-mist)', border: '1px solid var(--border-strong)', color: 'var(--fg)' }}>
                <s.icon size={19} />
              </span>
              <h3 className="font-display" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--fg)' }}>{s.t}</h3>
              <p className="font-body mt-1.5" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--muted)' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </ScrollChapter>

      {/* ═══ CHAPTER 06 — FIND US (car whole again) ═══ */}
      <ScrollChapter index="06" kicker="FIND US">
        <ChapterTitle>Right here in<br />Maninagar.</ChapterTitle>
        <div className="max-w-md mx-auto mt-9 w-full rounded-[26px] overflow-hidden text-center"
          style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)' }}>
          <div className="relative h-48" style={{ background: 'var(--accent-mist)' }}>
            <iframe
              title="AutoModz on Google Maps"
              src="https://www.google.com/maps?q=AutoModz+Maninagar+Ahmedabad+Bhairavnath+Rd&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 w-full h-full"
              style={{ border: 0, filter: 'grayscale(0.35) contrast(1.05)' }}
            />
            <span className="pointer-events-none absolute top-3 left-3 grid place-items-center rounded-full" style={{ width: 34, height: 34, background: 'var(--accent-grad)', color: 'var(--on-accent)', boxShadow: 'var(--shadow)' }}>
              <MapPin size={16} />
            </span>
          </div>
          <div className="p-6">
            {openNow !== null && (
              <span className="inline-flex items-center gap-1.5 font-mono mb-3" style={{ fontSize: 10, letterSpacing: '0.1em', color: openNow ? 'var(--success)' : 'var(--muted)' }}>
                <span className="rounded-full" style={{ width: 7, height: 7, background: openNow ? 'var(--success)' : 'var(--muted)' }} />
                {openNow ? 'OPEN NOW' : 'CLOSED'} · <Clock size={11} /> 9 AM – 9 PM DAILY
              </span>
            )}
            <p className="font-body" style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--fg-dim)' }}>
              Bhairavnath Rd, Bhairavnath,<br />Maninagar, Ahmedabad, Gujarat 380028
            </p>
            <div className="flex items-center justify-center gap-3 mt-5">
              <a href="tel:+919512605088" className="px-4 py-2.5 rounded-xl font-mono inline-flex items-center gap-1.5" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--fg-dim)', border: '1px solid var(--border-2)', background: 'var(--fog)' }}>
                <Phone size={12} /> CALL
              </a>
              <a href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-xl font-mono inline-flex items-center gap-1.5" style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--on-accent)', background: 'var(--accent-grad)' }}>
                <Navigation size={12} /> DIRECTIONS
              </a>
            </div>
          </div>
        </div>
      </ScrollChapter>

      {/* ═══ CHAPTER 07 — SLIDE TO BOOK ═══ */}
      <ScrollChapter index="07" kicker="YOUR TURN">
        <h2 className="font-hero" style={{ fontSize: 'clamp(32px, 8vw, 64px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em', color: 'var(--fg)', textShadow: '0 2px 40px rgba(0,0,0,0.55)' }}>
          Bring it by.<br /><span className="text-ember">We&rsquo;ll take it from here.</span>
        </h2>
        <div className="mt-10 w-full max-w-sm mx-auto">
          <SlideToAction label="Slide to book now" onComplete={book} />
        </div>
      </ScrollChapter>

      {/* ═══ CHAPTER 08 — GOOGLE REVIEWS (last before footer) ═══ */}
      <section id="reviews" className="relative z-10 py-24">
        <div className="text-center max-w-2xl mx-auto px-6 mb-8">
          <p className="font-mono mb-3" style={{ fontSize: 11, letterSpacing: '0.24em', color: 'var(--fg-dim)' }}>08 — WHAT AHMEDABAD SAYS</p>
          <ChapterTitle>Loved across the city.</ChapterTitle>
          <div className="inline-flex items-center gap-2.5 mt-6 px-4 py-2 rounded-full"
            style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
            <GoogleG />
            <span className="font-display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>{GOOGLE_RATING.score.toFixed(1)}</span>
            <Stars n={5} />
            <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--muted)' }}>{GOOGLE_RATING.count}+ REVIEWS</span>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 pb-3" style={{ scrollPaddingLeft: 24 }}>
          {REVIEWS.map(r => (
            <article key={r.name} className="snap-start shrink-0 w-[82vw] sm:w-[340px] rounded-[22px] p-5"
              style={{ background: 'var(--glass)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="grid place-items-center rounded-full font-display" style={{ width: 38, height: 38, fontSize: 15, fontWeight: 700, color: 'var(--on-accent)', background: 'var(--accent-grad)' }}>{r.name[0]}</span>
                <div>
                  <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{r.name}</div>
                  <div className="flex items-center gap-2"><Stars n={r.rating} size={12} /><span className="font-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{r.when}</span></div>
                </div>
              </div>
              <p className="font-body" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--fg-dim)' }}>{r.text}</p>
            </article>
          ))}
          <div aria-hidden className="shrink-0 w-2" />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 px-6 pb-10 pt-12 text-center" style={{ borderTop: '1px solid var(--border)', background: 'rgba(8,9,11,0.6)', backdropFilter: 'blur(8px)' }}>
        <div className="flex flex-col items-center gap-3">
          <Wordmark height="clamp(18px, 5vw, 24px)" />
          <p className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--faint)' }}>
            © {new Date().getFullYear()} AUTOMODZ · CRAFTED IN AHMEDABAD
          </p>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
