'use client';
/**
 * AutoModz homepage — lean, mobile-first, centred. One continuous premium
 * background (`.lux-bg`) scrolls behind everything.
 * Flow: Home → Trust → Why → Services → Before/After → Google reviews →
 *       Find us → Slide to book.
 *
 * The homepage is ALWAYS dark — the fixed luxury look. The light/dark toggle
 * only governs the admin + user app, not this marketing surface. We force
 * `data-theme="dark"` on <html> while mounted (an inline script does it before
 * first paint to avoid a flash), and restore the user's real app theme on
 * leave. Imagery + review data are scaffold (flagged in source).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Star, MapPin, Phone, ShieldCheck, Smartphone, IndianRupee, Clock, Navigation,
} from 'lucide-react';
import { getServices } from '@/lib/firebaseService';
import { formatCurrency } from '@/lib/utils';
import SlideToAction from '@/components/ui/SlideToAction';
import Wordmark from '@/components/ui/Wordmark';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import WhatsAppFloat from '@/components/ui/WhatsAppFloat';
import { SERVICE_SHOWCASE, STOCK } from '@/lib/stockImages';
import { REVIEWS, GOOGLE_RATING } from '@/lib/reviews';
import type { Service } from '@/lib/types';

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: EASE },
};

const COPY: Record<string, { title: string; line: string }> = {
  PPF:     { title: 'Paint Protection Film', line: 'A clear, self-healing skin. Stone chips and scratches hit the film — not your paint.' },
  Ceramic: { title: 'Ceramic Coating',       line: 'A glass-hard 9H coat. Water rolls off, dirt gives up, the gloss holds for years.' },
  Coating: { title: 'Detailing & Polish',    line: 'We chase out the swirls and bring the depth back — the shine it had on day one.' },
  Washing: { title: 'Wash & Care',           line: 'pH-neutral foam, steam and patience. A proper wash that never leaves a swirl.' },
};

function PremiumBackground() {
  return (
    <div aria-hidden className="lux-bg">
      {/* fine grain for a tactile, premium surface */}
      <div className="absolute inset-0 noise-overlay" style={{ opacity: 'var(--lux-grain)' }} />
      <div className="absolute inset-0 bg-grid" style={{ opacity: 0.35 }} />
    </div>
  );
}

function Stars({ n = 5, size = 14 }: { n?: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={size} strokeWidth={0} fill={i < n ? 'var(--accent)' : 'var(--border-strong)'} />
      ))}
    </span>
  );
}

function SectionTitle({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-9">
      {kicker && <motion.p {...reveal} className="font-mono mb-3" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--fg-dim)' }}>{kicker}</motion.p>}
      <motion.h2 {...reveal} transition={{ ...reveal.transition, delay: 0.05 }} className="font-display"
        style={{ fontSize: 'clamp(26px, 6vw, 44px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.015em', color: 'var(--fg)' }}>
        {title}
      </motion.h2>
      {sub && <motion.p {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="font-body mt-4"
        style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--muted)' }}>{sub}</motion.p>}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [openNow, setOpenNow] = useState<boolean | null>(null);

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
      <PremiumBackground />

      {/* Header — glass; wordmark auto-adapts to theme */}
      <header className="fixed top-0 inset-x-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top,0px)' }}>
        <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl px-4 py-2.5"
          style={{ background: 'var(--glass)', backdropFilter: 'blur(18px) saturate(1.3)', WebkitBackdropFilter: 'blur(18px) saturate(1.3)', border: '1px solid var(--glass-border)' }}>
          <Wordmark height="clamp(16px, 4.6vw, 20px)" />
          <Link href="/auth/login" className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--fg)', border: '1px solid var(--border-strong)', borderRadius: 9, padding: '7px 14px' }}>
            SIGN IN
          </Link>
        </div>
      </header>

      {/* ── HOME — full screen, centred ── */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-6">
        <motion.p {...reveal} className="font-mono mb-5" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--fg-dim)' }}>
          DETAILING STUDIO · MANINAGAR, AHMEDABAD
        </motion.p>
        <motion.h1 {...reveal} transition={{ ...reveal.transition, delay: 0.05 }} className="font-hero"
          style={{ fontSize: 'clamp(46px, 13vw, 108px)', fontWeight: 800, lineHeight: 0.94, letterSpacing: '-0.03em', color: 'var(--fg)' }}>
          The art of<br /><span className="text-ember">the finish.</span>
        </motion.h1>
        <motion.p {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="font-body mt-7 max-w-md mx-auto"
          style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--muted)' }}>
          The studio in Maninagar that treats your car like it&rsquo;s the only one in the bay.
        </motion.p>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.16 }} className="mt-10 w-full max-w-sm">
          <SlideToAction label="Slide to book now" onComplete={book} />
        </motion.div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="relative px-6 py-6">
        <motion.div {...reveal} className="max-w-3xl mx-auto rounded-3xl px-5 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 text-center"
          style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)' }}>
          {[
            { n: GOOGLE_RATING.score.toFixed(1), l: 'GOOGLE RATING', stars: true },
            { n: '500+', l: 'CARS PROTECTED' },
            { n: 'Since 2019', l: 'IN MANINAGAR' },
            { n: '100%', l: 'PHOTOGRAPHED' },
          ].map(x => (
            <div key={x.l}>
              <div className="flex items-center justify-center gap-1.5">
                <span className="font-display font-800" style={{ fontSize: 22, color: 'var(--fg)' }}>{x.n}</span>
                {x.stars && <Stars n={5} size={13} />}
              </div>
              <div className="font-mono mt-1" style={{ fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--muted)' }}>{x.l}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── WHY AUTOMODZ — 3 pillars ── */}
      <section className="relative px-6 py-16">
        <SectionTitle kicker="WHY AUTOMODZ" title="Detailing done properly." />
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { icon: ShieldCheck, t: 'Studio-grade correction', d: 'Dust-free bays, inspection lighting, no shortcuts. Flaws have nowhere to hide.' },
            { icon: Smartphone, t: 'Live stage tracking', d: 'Follow every stage of your car from your phone. Every panel photographed.' },
            { icon: IndianRupee, t: 'Honest pricing', d: 'Only what your car actually needs. No upselling, no surprises.' },
          ].map(p => (
            <motion.div key={p.t} {...reveal} className="rounded-[22px] p-6 text-center flex flex-col items-center"
              style={{ background: 'var(--glass)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid var(--glass-border)' }}>
              <span className="grid place-items-center rounded-2xl mb-4" style={{ width: 46, height: 46, background: 'var(--accent-mist)', border: '1px solid var(--border-strong)', color: 'var(--fg)' }}>
                <p.icon size={20} />
              </span>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--fg)' }}>{p.t}</h3>
              <p className="font-body mt-2" style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--muted)' }}>{p.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="relative px-6 py-16">
        <SectionTitle kicker="THE CRAFT" title="What we do." />
        <div className="grid sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {SERVICE_SHOWCASE.map((s, i) => {
            const from = prices[s.cat] ?? s.from;
            const c = COPY[s.cat];
            return (
              <motion.article key={s.cat} {...reveal} transition={{ ...reveal.transition, delay: (i % 2) * 0.06 }} onClick={book}
                className="group relative rounded-[24px] overflow-hidden cursor-pointer" style={{ minHeight: 250, border: '1px solid var(--glass-border)' }}>
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
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* ── BEFORE / AFTER PROOF ── */}
      <section className="relative px-6 py-16">
        <SectionTitle kicker="THE DIFFERENCE" title="Correction, not cover-up." sub="Drag across a real paint-correction. The swirls come out before anything is sealed over them." />
        <motion.div {...reveal} className="max-w-2xl mx-auto">
          <BeforeAfterSlider
            before={STOCK.ceramic}
            after={STOCK.ceramic}
            beforeFilter="saturate(0.45) brightness(0.8) contrast(0.9) blur(0.4px)"
            alt="Paint correction — same panel, before and after" />
        </motion.div>
      </section>

      {/* ── GOOGLE REVIEWS ── */}
      <section id="reviews" className="relative py-16">
        <div className="text-center max-w-2xl mx-auto px-6 mb-8">
          <motion.p {...reveal} className="font-mono mb-3" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--fg-dim)' }}>WHAT AHMEDABAD SAYS</motion.p>
          <motion.h2 {...reveal} transition={{ ...reveal.transition, delay: 0.05 }} className="font-display" style={{ fontSize: 'clamp(26px, 6vw, 44px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.015em', color: 'var(--fg)' }}>
            Loved across the city.
          </motion.h2>
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="inline-flex items-center gap-2.5 mt-5 px-4 py-2 rounded-full"
            style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
            <GoogleG />
            <span className="font-display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg)' }}>{GOOGLE_RATING.score.toFixed(1)}</span>
            <Stars n={5} />
            <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--muted)' }}>{GOOGLE_RATING.count}+ REVIEWS</span>
          </motion.div>
        </div>

        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar px-6 pb-3" style={{ scrollPaddingLeft: 24 }}>
          {REVIEWS.map(r => (
            <motion.article key={r.name} {...reveal} className="snap-start shrink-0 w-[82vw] sm:w-[340px] rounded-[22px] p-5"
              style={{ background: 'var(--glass)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="grid place-items-center rounded-full font-display" style={{ width: 38, height: 38, fontSize: 15, fontWeight: 700, color: 'var(--on-accent)', background: 'var(--accent-grad)' }}>{r.name[0]}</span>
                <div>
                  <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{r.name}</div>
                  <div className="flex items-center gap-2"><Stars n={r.rating} size={12} /><span className="font-mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{r.when}</span></div>
                </div>
              </div>
              <p className="font-body" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--fg-dim)' }}>{r.text}</p>
            </motion.article>
          ))}
          <div aria-hidden className="shrink-0 w-2" />
        </div>
      </section>

      {/* ── FIND US ── */}
      <section className="relative px-6 py-16">
        <SectionTitle kicker="FIND US" title="Right here in Maninagar." />
        <motion.div {...reveal} className="max-w-md mx-auto rounded-[26px] overflow-hidden text-center"
          style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)' }}>
          <div className="relative h-40" style={{ background: 'var(--accent-mist)' }}>
            <div className="absolute inset-0 bg-grid" style={{ opacity: 0.5 }} />
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid place-items-center rounded-full" style={{ width: 52, height: 52, background: 'var(--accent-grad)', color: 'var(--on-accent)', boxShadow: 'var(--shadow)' }}>
                <MapPin size={22} />
              </span>
            </div>
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
        </motion.div>
      </section>

      {/* ── SLIDE TO BOOK ── */}
      <section className="relative px-6 py-20 text-center">
        <motion.h2 {...reveal} className="font-hero" style={{ fontSize: 'clamp(32px, 8vw, 60px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
          Bring it by.<br /><span className="text-ember">We&rsquo;ll take it from here.</span>
        </motion.h2>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="mt-10 w-full max-w-sm mx-auto">
          <SlideToAction label="Slide to book now" onComplete={book} />
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative px-6 pb-10 pt-12 text-center" style={{ borderTop: '1px solid var(--border)' }}>
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
