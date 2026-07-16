'use client';
/**
 * AutoModz homepage — luxury automotive brand page.
 * Flow (one question per section):
 *   Hero (what is this?) → Trust (can I trust it?) → Services (what do you do?)
 *   → Why (why you?) → Membership (why stay?) → Process (how does it work?)
 *   → Before/After (prove it) → Reviews (who says so?) → FAQ (what else?) → CTA.
 *
 * Hero follows the Apple/Mercedes split: copy stack left, photorealistic AMG
 * photography right, floating on warm blurred light and liquid-glass cards —
 * no low-poly 3D. Always dark; Lenis inertial scroll; framer reveals; magnetic
 * CTAs. Reviews stay honest — real Google profile only, no fabricated cards.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MapPin, Phone, ShieldCheck, Smartphone, IndianRupee, Clock, Navigation,
  ChevronDown, ArrowRight, Droplets,
} from 'lucide-react';
import { getServices } from '@/lib/firebaseService';
import { formatCurrency, getDurationLabel } from '@/lib/utils';
import SlideToAction from '@/components/ui/SlideToAction';
import Wordmark from '@/components/ui/Wordmark';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import WhatsAppFloat from '@/components/ui/WhatsAppFloat';
import SmoothScroll from '@/components/home/SmoothScroll';
import Magnetic from '@/components/home/Magnetic';
import { SERVICE_SHOWCASE, STOCK } from '@/lib/stockImages';
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

// photorealistic hero — swap this ONE url for the real studio shoot (AMG / M4) when licensed
const HERO_CAR = 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1800&q=85';

const SERVICE_META: Record<string, { warranty?: string; duration: number; line: string }> = {
  PPF:     { warranty: 'Up to 12 yr', duration: 480, line: 'Self-healing film. Stone chips hit the film — never your paint.' },
  Ceramic: { warranty: 'Up to 5 yr',  duration: 300, line: '9H glass-hard gloss. Water rolls off, dirt gives up.' },
  Coating: { warranty: '6 months',    duration: 240, line: 'Swirls chased out, depth brought back to day one.' },
  Washing: { duration: 60,            line: 'pH-neutral foam and steam. Zero swirls, ever.' },
};

const FAQS: { q: string; a: string }[] = [
  { q: 'How long does PPF take?', a: 'A full-body wrap takes 2–3 days in a dust-controlled bay. Partial fronts are usually done in one. Your car stays indoors the whole time and you can follow every stage from the app.' },
  { q: 'Do I need an appointment?', a: 'Walk-ins are welcome for washes, but coatings and PPF are by appointment so a bay is dedicated to your car. Booking takes under a minute in the app.' },
  { q: 'Is my car insured while it is with you?', a: 'Your car is garaged indoors, moved only by senior staff, and photographed at check-in and delivery. Every panel is documented before we touch it.' },
  { q: 'What does the membership include?', a: 'Monthly maintenance washes, priority slots and member pricing on detailing. Plans start at ₹1,499/month and you can use a wash on any car in your garage.' },
  { q: 'Which areas do you serve?', a: 'The studio is on Bhairavnath Road, Maninagar. Pickup and drop are available across Ahmedabad for a small fee, added at booking.' },
];

export default function HomePage() {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

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

      {/* ── ambient stage: blurred warm light + cool counter-glow, fixed ── */}
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute" style={{ top: '-12%', right: '-8%', width: '55vw', height: '55vw', maxWidth: 900, maxHeight: 900, background: 'radial-gradient(circle, rgba(255,120,40,0.16) 0%, transparent 62%)', filter: 'blur(60px)' }} />
        <div className="absolute" style={{ bottom: '-18%', left: '-10%', width: '50vw', height: '50vw', maxWidth: 800, maxHeight: 800, background: 'radial-gradient(circle, rgba(90,130,255,0.10) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div className="absolute inset-0 noise-overlay" style={{ opacity: 0.5 }} />
      </div>

      {/* ── header ── */}
      <header className="fixed top-0 inset-x-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top,0px)' }}>
        <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl px-4 py-2.5"
          style={{ background: 'rgba(14,15,18,0.55)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Wordmark height="clamp(16px, 4.6vw, 20px)" variant="white" />
          <Link href="/auth/login" className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', color: '#fff', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 9, padding: '7px 14px' }}>
            SIGN IN
          </Link>
        </div>
      </header>

      {/* ═══ HERO — split: copy left, AMG right ═══ */}
      <section className="relative z-10 min-h-[100svh] flex items-center px-6 pt-24 pb-16">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-6 items-center">
          {/* copy stack */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
              className="font-mono mb-5" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)' }}>
              DETAILING STUDIO · MANINAGAR, AHMEDABAD
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: EASE, delay: 0.05 }}
              className="font-hero" style={{ fontSize: 'clamp(40px, 8.5vw, 72px)', fontWeight: 800, lineHeight: 0.96, letterSpacing: '-0.03em', color: '#fff' }}>
              The art of<br /><span style={{ background: 'linear-gradient(100deg, #fff 20%, #ffb27a 55%, #8ea2ff 90%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>the finish.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: EASE, delay: 0.12 }}
              className="font-body mt-6 max-w-md mx-auto lg:mx-0" style={{ fontSize: 16.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.62)' }}>
              Paint protection film, ceramic and correction for cars that deserve better than a roadside wash — photographed panel by panel, tracked live from your phone.
            </motion.p>

            {/* CTAs */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, ease: EASE, delay: 0.18 }}
              className="mt-9 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <Magnetic strength={0.35}>
                <motion.button onClick={book}
                  whileHover={{ y: -2, boxShadow: '0 14px 50px rgba(255,255,255,0.28), inset 0 1px 0 rgba(255,255,255,0.9)' }}
                  whileTap={{ scale: 0.97, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl"
                  style={{ background: 'linear-gradient(180deg, #fff 0%, #e9ebef 100%)', color: '#0b0c0e', boxShadow: '0 8px 40px rgba(255,255,255,0.18), inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                  <span className="font-display" style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '0.01em' }}>Book a slot</span>
                  <ArrowRight size={16} />
                </motion.button>
              </Magnetic>
              <Magnetic strength={0.3}>
                <motion.a href="#services"
                  whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.1)' }}
                  whileTap={{ scale: 0.97, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl"
                  style={{ ...glass(0.05), color: 'rgba(255,255,255,0.85)' }}>
                  <span className="font-display" style={{ fontSize: 14.5, fontWeight: 700 }}>Explore services</span>
                </motion.a>
              </Magnetic>
            </motion.div>

            {/* trust numbers */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.3 }}
              className="mt-10 flex items-center gap-7 justify-center lg:justify-start flex-wrap">
              {[
                { n: 'Since 2019', l: 'IN MANINAGAR' },
                { n: '500+', l: 'CARS PROTECTED' },
                { n: '100%', l: 'PHOTOGRAPHED' },
              ].map(x => (
                <div key={x.l} className="text-center lg:text-left">
                  <div className="font-display" style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>{x.n}</div>
                  <div className="font-mono mt-0.5" style={{ fontSize: 8.5, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.38)' }}>{x.l}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* photoreal car — floating on the light stage */}
          <motion.div initial={{ opacity: 0, scale: 0.96, x: 24 }} animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.1 }}
            className="relative order-1 lg:order-2">
            {/* bloom behind the car */}
            <div aria-hidden className="absolute -inset-8 pointer-events-none" style={{ background: 'radial-gradient(60% 55% at 60% 45%, rgba(255,140,60,0.10), transparent 70%)', filter: 'blur(30px)' }} />
            <div className="relative rounded-[28px] overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 40px 120px rgba(0,0,0,0.55), 0 0 100px rgba(255,120,40,0.1)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_CAR} alt="Mercedes-AMG GT under studio light" className="w-full object-cover" style={{ aspectRatio: '4/3' }} />
              <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,9,11,0.55) 0%, transparent 35%), linear-gradient(200deg, transparent 40%, rgba(8,9,11,0.6) 100%)' }} />
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

      {/* ═══ SERVICES — image cards with glass overlay + price/warranty/duration ═══ */}
      <section id="services" className="relative z-10 px-6 py-20">
        <SectionHead kicker="THE CRAFT" title="Four disciplines. One standard." />
        <div className="grid sm:grid-cols-2 gap-4 max-w-5xl mx-auto">
          {SERVICE_SHOWCASE.map((s, i) => {
            const meta = SERVICE_META[s.cat];
            const from = prices[s.cat] ?? s.from;
            return (
              <motion.article key={s.cat} {...reveal} transition={{ ...reveal.transition, delay: (i % 2) * 0.07 }}
                onClick={book}
                whileHover={{ y: -4 }}
                className="group relative rounded-[26px] overflow-hidden cursor-pointer"
                style={{ minHeight: 340, border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 60px rgba(0,0,0,0.4)' }}>
                <Image src={s.img} alt={s.name} fill sizes="(max-width:640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]" />
                <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(185deg, transparent 30%, rgba(6,7,9,0.72) 78%)' }} />
                <div className="absolute inset-x-3 bottom-3 rounded-[20px] p-4" style={glass(0.035)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display" style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>{s.name}</h3>
                      <p className="font-body mt-1" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>{meta.line}</p>
                    </div>
                    <ArrowRight size={17} className="shrink-0 mt-1 transition-transform group-hover:translate-x-1" style={{ color: 'rgba(255,255,255,0.5)' }} />
                  </div>
                  <div className="flex items-center gap-4 mt-3 pt-3 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <Spec label="FROM" value={formatCurrency(from)} />
                    {meta.warranty && <Spec label="WARRANTY" value={meta.warranty} />}
                    <Spec label="TIME" value={getDurationLabel(meta.duration)} />
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* ═══ WHY — three reasons, no fluff ═══ */}
      <section className="relative z-10 px-6 py-20">
        <SectionHead kicker="WHY AUTOMODZ" title="Detailing done properly." />
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { icon: ShieldCheck, t: 'Studio-grade correction', d: 'Dust-controlled bays and inspection lighting. Flaws have nowhere to hide.' },
            { icon: Smartphone, t: 'Live stage tracking', d: 'Follow every stage from your phone. Every panel photographed.' },
            { icon: IndianRupee, t: 'Honest pricing', d: 'Only what your car actually needs. No upselling, no surprises.' },
          ].map(p => (
            <motion.div key={p.t} {...reveal} className="rounded-[22px] p-6 text-center flex flex-col items-center"
              style={glass(0.04)}>
              <span className="grid place-items-center rounded-2xl mb-4" style={{ width: 46, height: 46, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                <p.icon size={20} />
              </span>
              <h3 className="font-display" style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>{p.t}</h3>
              <p className="font-body mt-2" style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.5)' }}>{p.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ MEMBERSHIP — why stay ═══ */}
      <section className="relative z-10 px-6 py-20">
        <SectionHead kicker="MEMBERSHIP" title="Your car, always fresh." sub="Monthly maintenance washes, priority slots and member pricing — one plan for every car in your garage." />
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {MEMBERSHIP_PLANS.map((p, i) => (
            <motion.button key={p.id} {...reveal} transition={{ ...reveal.transition, delay: i * 0.07 }} onClick={book}
              whileHover={{ y: -4 }} whileTap={{ scale: 0.98, y: 0 }}
              className="relative overflow-hidden rounded-[22px] p-6 text-left flex flex-col justify-between"
              style={{ ...glass(0.04, i === 1), aspectRatio: '1.586' }}>
              {/* card sheen — a diagonal light pass, like brushed metal */}
              <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.05) 45%, transparent 60%)' }} />
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

      {/* ═══ PROCESS — how it works ═══ */}
      <section className="relative z-10 px-6 py-20">
        <SectionHead kicker="HOW IT WORKS" title="Booked in a minute." />
        <div className="max-w-md mx-auto">
          {[
            { t: 'Vehicle enters', d: 'Checked in and photographed, panel by panel.' },
            { t: 'Inspection', d: 'Paint depth measured under studio lighting.' },
            { t: 'Service', d: 'Every stage streamed live to your phone.' },
            { t: 'Quality check', d: 'Senior detailer signs off under inspection light.' },
            { t: 'Delivery', d: 'Handed back gleaming. Pay in-app.' },
          ].map((s, i, arr) => (
            <motion.div key={s.t} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }}
              className="relative flex gap-5 pb-9 last:pb-0">
              {/* rail */}
              <div className="flex flex-col items-center">
                <span className="grid place-items-center rounded-full shrink-0 font-mono"
                  style={{ width: 34, height: 34, fontSize: 10, color: 'rgba(255,255,255,0.75)', ...glass(0.05) }}>
                  0{i + 1}
                </span>
                {i < arr.length - 1 && (
                  <span aria-hidden className="w-px flex-1 mt-2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))' }} />
                )}
              </div>
              <div className="pt-1.5">
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: '#fff' }}>{s.t}</h3>
                <p className="font-body mt-1" style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.5)' }}>{s.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ BEFORE / AFTER — prove it ═══ */}
      <section className="relative z-10 px-6 py-20">
        <SectionHead kicker="THE DIFFERENCE" title="From grimy to gleaming." sub="Drag across. The same car — dusty on the left, corrected and glossed on the right." />
        <motion.div {...reveal} className="relative max-w-3xl mx-auto">
          {/* cinematic frame: bloom under, glass rim around */}
          <div aria-hidden className="absolute -inset-6 pointer-events-none" style={{ background: 'radial-gradient(55% 50% at 50% 60%, rgba(255,140,60,0.08), transparent 70%)', filter: 'blur(24px)' }} />
          <div className="relative rounded-[26px] p-2" style={glass(0.03)}>
            <BeforeAfterSlider
              before={STOCK.ceramic}
              after={STOCK.ceramic}
              dirtBefore
              beforeFilter="saturate(0.4) brightness(0.72) contrast(0.95) blur(0.5px)"
              alt="The same car — dirty before, clean after" />
          </div>
        </motion.div>
      </section>

      {/* ═══ REVIEWS — honest, never fabricated ═══ */}
      <section id="reviews" className="relative z-10 px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <SectionHead kicker="WHAT OWNERS SAY" title="Don’t take our word for it." sub="Every review on our Google profile is from a real car and a real owner. Read them before you book." />
          <Magnetic strength={0.3}>
            <motion.a href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer"
              whileHover={{ y: -2 }} whileTap={{ scale: 0.97, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl"
              style={glass(0.05)}>
              <GoogleG />
              <span className="font-display" style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>Read our reviews on Google</span>
            </motion.a>
          </Magnetic>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="relative z-10 px-6 py-20">
        <SectionHead kicker="QUESTIONS" title="Before you ask." />
        <div className="max-w-2xl mx-auto space-y-2.5">
          {FAQS.map((f, i) => {
            const open = faqOpen === i;
            return (
              <motion.div key={f.q} {...reveal} transition={{ ...reveal.transition, delay: Math.min(i * 0.05, 0.2) }}
                className="rounded-2xl overflow-hidden"
                style={{ ...glass(open ? 0.05 : 0.03), border: `1px solid ${open ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'}` }}>
                <button onClick={() => setFaqOpen(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="font-display" style={{ fontSize: 14.5, fontWeight: 700, color: '#fff' }}>{f.q}</span>
                  <ChevronDown size={16} className="shrink-0 transition-transform duration-300" style={{ color: 'rgba(255,255,255,0.4)', transform: open ? 'rotate(180deg)' : 'none' }} />
                </button>
                <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
                  <div className="overflow-hidden">
                    <p className="font-body px-5 pb-4" style={{ fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255,255,255,0.55)' }}>{f.a}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ═══ FIND US + FINAL CTA ═══ */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-4xl mx-auto grid lg:grid-cols-2 gap-6 items-center">
          <motion.div {...reveal} className="rounded-[26px] overflow-hidden" style={glass(0.035)}>
            <div className="relative h-44">
              <iframe
                title="AutoModz on Google Maps"
                src="https://www.google.com/maps?q=AutoModz+Maninagar+Ahmedabad+Bhairavnath+Rd&output=embed"
                loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full" style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg) grayscale(0.35) contrast(0.92) brightness(0.9)' }} />
            </div>
            <div className="p-5">
              {openNow !== null && (
                <span className="flex items-center gap-1.5 font-mono mb-2" style={{ fontSize: 9.5, letterSpacing: '0.1em', color: openNow ? '#5FBF8F' : 'rgba(255,255,255,0.4)' }}>
                  <span className="rounded-full" style={{ width: 6, height: 6, background: openNow ? '#5FBF8F' : 'rgba(255,255,255,0.3)' }} />
                  {openNow ? 'OPEN NOW' : 'CLOSED'} · <Clock size={10} /> 9 AM – 9 PM DAILY
                </span>
              )}
              <p className="font-body flex items-start gap-1.5" style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.6)' }}>
                <MapPin size={14} className="mt-0.5 shrink-0" /> Bhairavnath Rd, Maninagar, Ahmedabad 380028
              </p>
              <div className="flex items-center gap-2.5 mt-4">
                <a href="tel:+919512605088" className="flex-1 text-center px-4 py-2.5 rounded-xl font-mono inline-flex items-center justify-center gap-1.5" style={{ fontSize: 10.5, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <Phone size={11} /> CALL
                </a>
                <a href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer" className="flex-1 text-center px-4 py-2.5 rounded-xl font-mono inline-flex items-center justify-center gap-1.5" style={{ fontSize: 10.5, letterSpacing: '0.08em', color: '#0b0c0e', background: '#fff' }}>
                  <Navigation size={11} /> DIRECTIONS
                </a>
              </div>
            </div>
          </motion.div>

          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.08 }} className="text-center lg:text-left">
            <h2 className="font-hero" style={{ fontSize: 'clamp(30px, 6vw, 52px)', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.02em', color: '#fff' }}>
              Bring it by.<br /><span style={{ color: 'rgba(255,255,255,0.45)' }}>We’ll take it from here.</span>
            </h2>
            <div className="mt-8 w-full max-w-sm mx-auto lg:mx-0">
              <SlideToAction label="Slide to book now" onComplete={book} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="relative z-10 px-6 pb-14 pt-16 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex flex-col items-center gap-6">
          <Wordmark height="clamp(18px, 5vw, 24px)" variant="white" />
          <div className="flex items-center gap-8 font-mono" style={{ fontSize: 9.5, letterSpacing: '0.16em' }}>
            <a href="tel:+919512605088" style={{ color: 'rgba(255,255,255,0.45)' }}>CALL</a>
            <a href="https://maps.app.goo.gl/S1ZBYHrYYUxezB7g9" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.45)' }}>DIRECTIONS</a>
            <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.45)' }}>SIGN IN</Link>
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

function SectionHead({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10">
      <motion.p {...reveal} className="font-mono mb-3" style={{ fontSize: 10.5, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.38)' }}>{kicker}</motion.p>
      <motion.h2 {...reveal} transition={{ ...reveal.transition, delay: 0.05 }} className="font-hero"
        style={{ fontSize: 'clamp(27px, 5.5vw, 44px)', fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.02em', color: '#fff' }}>
        {title}
      </motion.h2>
      {sub && <motion.p {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="font-body mt-4"
        style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>{sub}</motion.p>}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono" style={{ fontSize: 8, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.35)' }}>{label}</p>
      <p className="font-display" style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{value}</p>
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
