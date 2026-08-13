'use client';
/**
 * THE LANDING - the public face, before there is a session.
 *
 * Behaviour is the old `/` verbatim (reference/customer-old/app/page.tsx):
 * the same eleven sections, the same anchors, the same live minimum prices,
 * the same open/closed window, the same conversion (slide to book), the same
 * brand intro, the same sticky CTA, the same before/after drag, the same four
 * ways in. Nothing was removed and nothing was invented.
 *
 * What changed is the language. The old page carried a champagne accent
 * (#ffb27a) and a cool counter-glow (#8ea2ff) on hand-typed glass. The design
 * system is monochrome (design/colors.ts), so every value here comes from
 * design/ and the hierarchy is carried by the type scale and the photograph
 * instead of by hue. The editorial chapter numbers, the seams and the
 * photograph-first cards survive because they are structure, not colour.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, useScroll, useTransform } from 'framer-motion';
import { MapPin, Phone, Navigation, Droplets } from 'lucide-react';
import { formatCurrency, getDurationLabel } from '@/lib/utils';
import SlideToAction from '@/components/ui/SlideToAction';
import Wordmark from '@/components/ui/Wordmark';
import WhatsAppFloat from '@/components/ui/WhatsAppFloat';
import SmoothScroll from '@/components/home/SmoothScroll';
import { MEDIA } from '@/lib/media';
import { SERVICES, SERVICE_ORDER } from '@/lib/catalog';
import { COMPANY, waLink, telLink } from '@/lib/company';
import { MEMBERSHIP_PLANS } from '@/lib/types';
import {
  color, scrim, space, INSET, type as typeScale, radius, elevation,
  duration, curve, HAIRLINE, TARGET_MIN, iconSize, imageSizes, breakpoint,
} from '@/design';

/* ─────────────────────────────────────────────────────────────────────────
   Landing-only scale. The system's `display` tops out at 52px because a room
   is read at arm's length with one subject in it; a landing hero is read as a
   poster. Both are derived from the same clamp shape and the same family.
   ───────────────────────────────────────────────────────────────────────── */
const poster = {
  hero: 'clamp(40px, 8.5vw, 72px)',
  chapter: 'clamp(27px, 5.5vw, 44px)',
  mark: 'clamp(76px, 15vw, 132px)',
} as const;

/**
 * A membership tier's metal, at a given strength.
 *
 * `MEMBERSHIP_PLANS[].color` is one hex per tier - silver, gold, platinum -
 * and a card needs the same metal at three different weights: a wash across
 * the face, a hairline on the edge, a sheen that travels on hover. So it is
 * taken apart here rather than three more constants being invented for it.
 */
const metal = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** The mono voice for kickers, prices and the footer. */
const label = (size: number, tone: string = color.ink3) => ({
  fontFamily: typeScale.data.family,
  fontSize: size,
  letterSpacing: '0.16em',
  color: tone,
});

/**
 * One reveal, used everywhere on this page.
 *
 * It ran at `duration.morph` - 620ms - which is the token §7.5 reserves for a
 * PHOTOGRAPH CARRYING BETWEEN TWO SURFACES, not for a paragraph arriving on
 * scroll. `move` is what §7.3 defines for "an element changing place or
 * state", and at 280ms the same motion reads as immediate rather than as
 * something the page is doing to you.
 *
 * The travel came down with it: 26px over 620ms is a glide, 14px over 280ms is
 * an arrival.
 */
const reveal = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-70px' },
  transition: { duration: duration.move / 1000, ease: curve.ease },
};

/** One material (§10.2) - the system's surface over whatever is behind it. */
const glass = (): React.CSSProperties => ({
  background: `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)`,
  backdropFilter: 'blur(24px) saturate(1.4)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
  border: `${HAIRLINE}px solid ${color.edge}`,
  boxShadow: elevation.float.shadow,
});

const NAV = [
  { label: 'Services', href: '#services' },
  { label: 'Membership', href: '#membership' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Contact', href: '#contact' },
] as const;

/**
 * THE HOOK.
 *
 * "The art of the finish" is a category line - any detailer in any city could
 * run it, and a line anyone could run is a line nobody repeats. What follows
 * is built to be repeatable, which is the only property that matters in a
 * tagline somebody is meant to become habitual to.
 *
 * ── WHY THIS ONE ────────────────────────────────────────────────────────────
 * Every service on this page exists for ONE outcome, and it is not "shine".
 * PPF, ceramic and correction all do the same job from different angles: they
 * hold a car at the condition it was in the day it was handed over. That is
 * also the thing an owner actually feels - nobody is nostalgic about gloss,
 * they are nostalgic about the first week.
 *
 * So the promise is the hook, not the craft. Three words, a full stop, no
 * adjective, and it is a claim the studio can be held to.
 *
 * It is also ALREADY the studio's voice: the detailing card on this page
 * says "day-one depth back", written long before this line existed. Taking
 * the phrase the product already reaches for and putting it at the top is how
 * a tagline ends up sounding inevitable rather than applied.
 *
 * The sub-line carries the differentiator and nothing else. It was two lines
 * of specification; a hook followed by a paragraph is a hook nobody finishes.
 */
const HOOK = { first: 'Forever', second: 'day one' } as const;
const SUBHOOK = 'PPF, ceramic and detailing — every panel photographed.';

/**
 * THE PROOF STRIP.
 *
 * This was five mono claims in a row - "PPF EXPERTS", "CERAMIC SPECIALISTS" -
 * wrapped so that "SINCE 2025" fell onto a line of its own. Two of them were
 * adjectives about the studio rather than facts about it, and an adjective is
 * not proof; the other three were facts printed at the same weight as the
 * adjectives, so nothing stood out.
 *
 * Kept: only what is measurable, and only what this page already claims
 * elsewhere. "Up to 12 yr warranty" is the PPF card's own figure and
 * `lib/catalog`'s. Nothing here is invented, and there is deliberately NO
 * rating number - `lib/reviews` is marked scaffold, so the Google cell is a
 * link to the real thing and says nothing this studio has not earned.
 */
const PROOF = [
  { value: '500+', caption: 'Cars protected' },
  { value: '12 yr', caption: 'Longest warranty' },
  { value: '2025', caption: 'Studio established' },
] as const;

/**
 * ONE SHEET DIVIDED, NOT FOUR BOXES PLACED SIDE BY SIDE.
 *
 * So the hairlines are seams BETWEEN cells and never an outline around each -
 * and which edges are seams depends on how many columns there are. At two
 * columns the strip is 2x2 and the lower pair needs a top seam; at four it is
 * a single row and that same seam would be a line drawn through the middle of
 * nothing. Inline styles cannot answer a media query, so the SIDES are
 * Tailwind (which can) and the colour is the token (which Tailwind should not
 * be asked to duplicate).
 */
const SEAMS = [
  '',
  'border-l',
  'border-t lg:border-t-0 lg:border-l',
  'border-l border-t lg:border-t-0',
] as const;
const seam = (i: number) => SEAMS[i] ?? '';
const seamColour: React.CSSProperties = { borderColor: color.edge, borderStyle: 'solid', borderWidth: 0 };

const MEMBER_BENEFITS = ['MONTHLY PREMIUM WASHES', 'PRIORITY BOOKING', 'MEMBER PRICING'] as const;

/** Category → lowest active price, read on the server (lib/server/publicCatalogue). */
export interface LandingProps {
  prices: Record<string, number>;
}

export function LandingScreen({ prices }: LandingProps) {
  const router = useRouter();
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

  /* The open/closed pill is the visitor's clock, not ours, so it is computed
     after mount - rendering it on the server would state Ahmedabad's hour to
     someone reading in another one, and would differ from the hydrated value. */
  useEffect(() => {
    const h = new Date().getHours();
    setOpenNow(h >= 9 && h < 21);
  }, []);

  const book = () => router.push('/auth/login');

  /* WCAG 2.3.3 - motion respects the OS setting. `MotionConfig` applies it
     to every animation in this tree, which the CSS rules in globals.css
     could never do: they silence three named CSS animations, and every
     animation on this page is framer-motion. This is the one address every
     visitor arrives at, and it was the only customer surface that animated
     regardless of the preference. */
  return (
    <MotionConfig reducedMotion="user">
    {/* NO BACKGROUND OF ITS OWN. `body` is already `--bg`, and this painted
        the same near-black OVER the ambient field - a positioned element in
        DOM order after it - so mounting the field changed nothing until this
        came off. No room paints its own ground either; see `os/Screen`. */}
    <div className="relative" style={{ overflowX: 'clip' }}>
      <SmoothScroll />

      {/* ── brand intro: wordmark under a light sweep, then fade ── */}
      <AnimatePresence>
        {intro && (
          <motion.div
            key="intro"
            className="fixed inset-0 grid place-items-center"
            style={{ background: color.paper, zIndex: elevation.alert.z }}
            exit={{ opacity: 0, transition: { duration: duration.move / 1000, ease: curve.ease } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: duration.scene / 1000, ease: curve.ease }}
              className="relative overflow-hidden"
              style={{ paddingInline: INSET, paddingBlock: space.line }}
            >
              <Wordmark height="clamp(26px, 7vw, 40px)" variant="white" />
              <motion.div
                aria-hidden
                className="absolute inset-y-0"
                style={{
                  width: space.movement,
                  background: `linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent)`,
                  filter: 'blur(6px)',
                }}
                initial={{ left: '-30%' }}
                animate={{ left: '110%' }}
                transition={{ duration: duration.move / 1000, ease: curve.ease }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── sticky slide-to-book once the hero is gone ── */}
      <AnimatePresence>
        {heroGone && (
          <motion.div
            key="sticky-cta"
            className="fixed inset-x-0 flex justify-center pointer-events-none"
            style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${space.gap}px)`, zIndex: elevation.nav.z }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: duration.scene / 1000, ease: curve.ease }}
          >
            <div className="pointer-events-auto w-[min(320px,80vw)]" style={{ filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.6))' }}>
              <SlideToAction label="Slide to book" onComplete={book} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── the grain. The LIGHT is the application's own ─────────────────
          Two neutral WHITE lights used to be mounted here, which is why the
          landing read as flat black while every room behind the door is lit
          amber and champagne. `CustomerChrome` now mounts the same `Ambient`
          field here that it mounts in a room, so this is the one thing that
          was ever local to the landing: the grain over it. */}
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 noise-overlay" style={{ opacity: 0.5 }} />
      </div>

      {/* ── header ── */}
      <header className="fixed top-0 inset-x-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', zIndex: elevation.nav.z }}>
        <div
          className="flex items-center justify-between"
          style={{
            margin: space.line,
            paddingInline: space.gap,
            paddingBlock: space.breath + space.hair / 2,
            borderRadius: radius.sheet,
            background: 'rgba(21,24,27,0.55)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: `${HAIRLINE}px solid ${color.edge}`,
          }}
        >
          <Wordmark height="clamp(16px, 4.6vw, 20px)" variant="white" />
          {/* §21.3 - 44px is the floor whatever the type size is. These were
              10px labels in a 15px box: three links a finger cannot reliably
              hit, on the first screen anybody sees. The visual size is
              unchanged; only the target grew. */}
          <nav className="hidden md:flex items-center" style={{ gap: space.rest / 2 + space.hair }}>
            {NAV.map(n => (
              <a
                key={n.href}
                href={n.href}
                className="transition-colors"
                style={{
                  ...label(10, color.ink3), letterSpacing: '0.14em',
                  display: 'inline-flex', alignItems: 'center', minHeight: TARGET_MIN,
                }}
              >
                {n.label.toUpperCase()}
              </a>
            ))}
          </nav>
          <button
            onClick={book}
            style={{
              ...label(10.5, color.paper),
              letterSpacing: '0.1em',
              background: color.ink,
              borderRadius: radius.chip,
              paddingInline: space.gap,
              paddingBlock: space.line,
              /* WAS `TARGET_MIN - space.hair`, which is 40px - the floor,
                 shaved. §21.3 does not have a discount for the header. */
              minHeight: TARGET_MIN,
              border: 0,
              cursor: 'pointer',
            }}
          >
            BOOK &rarr;
          </button>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section
        ref={heroRef}
        className="relative z-10 md:min-h-[100svh] flex items-center"
        style={{
          paddingInline: INSET,
          paddingTop: `calc(env(safe-area-inset-top, 0px) + ${space.movement - space.line}px)`,
          paddingBottom: space.rest - space.hair * 2,
        }}
      >
        <div
          className="w-full mx-auto grid lg:grid-cols-[1fr_1.1fr] items-center"
          style={{ maxWidth: breakpoint.wide, gap: space.gap + space.hair }}
        >
          {/* copy stack */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.morph / 1000, ease: curve.ease }}
              style={{ ...label(11, color.ink3), letterSpacing: '0.22em', marginBottom: space.line }}
            >
              DETAILING STUDIO &middot; MANINAGAR, AHMEDABAD
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.move / 1000, ease: curve.ease }}
              style={{
                fontFamily: typeScale.display.family,
                fontSize: poster.hero,
                fontWeight: 800,
                lineHeight: 0.96,
                letterSpacing: '-0.03em',
                color: color.over,
              }}
            >
              {HOOK.first}<br />
              <span style={{ color: color.ink3 }}>{HOOK.second}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.move / 1000, ease: curve.ease }}
              className="max-w-md lg:max-w-xl mx-auto lg:mx-0"
              style={{
                fontFamily: typeScale.body.family,
                fontSize: typeScale.body.size,
                lineHeight: 1.65,
                color: color.ink2,
                marginTop: space.line,
              }}
            >
              {SUBHOOK}
            </motion.p>

            {/* primary conversion: slide to book */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.move / 1000, ease: curve.ease }}
              className="max-w-sm mx-auto lg:mx-0"
              style={{ marginTop: space.rest / 2 }}
            >
              <SlideToAction label="Slide to book" onComplete={book} />
              <a
                href="#services"
                className="inline-flex items-center"
                style={{ ...label(10.5, color.ink3), marginTop: space.breath, minHeight: TARGET_MIN }}
              >
                EXPLORE SERVICES &darr;
              </a>
            </motion.div>
          </div>

          {/* the photograph */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: duration.scene / 1000, ease: curve.ease }}
            style={{ y: heroParallax }}
            className="relative order-1 lg:order-2"
          >
            <div
              className="relative overflow-hidden"
              style={{
                borderRadius: radius.stage,
                border: `${HAIRLINE}px solid ${color.edge}`,
                boxShadow: elevation.takeover.shadow,
              }}
            >
              {/* The LCP element. `priority` preloads it, `sizes` stops a
                  1800px file landing on a 390px phone, and the fixed ratio
                  reserves the box so nothing shifts when it arrives. */}
              <div className="relative w-full max-h-[52vw] lg:max-h-none" style={{ aspectRatio: '4/3' }}>
                {/* §11.5 APPLIES HERE TOO. A hero that will not load collapsed
                    to its ALT TEXT at 16px in full ink, across the first thing
                    anybody sees. The attribute stays - a screen reader needs
                    it - and it is never allowed to lay the page out. */}
                <Image
                  src={MEDIA.hero.homepage}
                  alt="A finished car on the floor at AutoModz, Maninagar"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  style={{
                    fontSize: 0, color: 'transparent',
                    /* THE CROP IS DIRECTED, NOT CENTRED. The photograph is
                       719x1599 and this frame is 4:3, so `cover` keeps about a
                       third of its height - and centred, that third is the
                       empty ceiling. Pulled down, it lands on the car and the
                       brand wall behind it, which is the half worth showing. */
                    objectPosition: 'center 68%',
                  }}
                />
              </div>
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, rgba(10,11,13,${scrim.region * 0.7}) 0%, transparent 30%), linear-gradient(200deg, transparent 40%, rgba(10,11,13,${scrim.photo}) 100%)`,
                }}
              />
              {/* glass rim highlight along the top edge */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0"
                style={{ height: HAIRLINE, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35) 50%, transparent)' }}
              />
              {/* rating card */}
              <div
                className="absolute flex items-center sm:right-auto"
                style={{
                  left: space.gap, right: space.gap, bottom: space.gap,
                  gap: space.line, borderRadius: radius.card,
                  paddingInline: space.gap, paddingBlock: space.line,
                  ...glass(),
                }}
              >
                <GoogleG />
                <div>
                  <p style={{ fontFamily: typeScale.title.family, fontSize: typeScale.data.size, fontWeight: 600, color: color.over }}>
                    Rated on Google
                  </p>
                  <a
                    href={COMPANY.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                    style={{
                      fontFamily: typeScale.whisper.family,
                      fontSize: typeScale.whisper.size,
                      color: color.over2,
                      display: 'inline-flex', alignItems: 'center',
                      /* §21.3's floor, stated. `flexShrink: 0` is belt and
                         braces: this link sits in a block today, but the
                         section around it is a reveal that has been recomposed
                         more than once, and a control that is 44px only while
                         its parent stays a block is one bad refactor from
                         being 40. */
                      minHeight: TARGET_MIN, flexShrink: 0,
                    }}
                  >
                    Read reviews from real owners &rarr;
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── trust strip ── */}
      <section aria-label="Why owners trust AutoModz" className="relative z-10" style={{ paddingInline: INSET }}>
        <motion.div
          {...reveal}
          className="mx-auto relative overflow-hidden grid grid-cols-2 lg:grid-cols-4"
          style={{
            maxWidth: breakpoint.wide - INSET * 8,
            borderRadius: radius.card,
            ...glass(),
          }}
        >
          {/* THE GLOSS. One specular band across the top of the sheet - §3.4,
              light is the ornament - plus a soft pool under the first cell so
              the strip is lit from a direction rather than evenly filled. This
              is what makes it read as a polished surface instead of a box. */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{ height: HAIRLINE, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.38) 50%, transparent)' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(120% 180% at 12% -40%, rgba(255,255,255,0.10) 0%, transparent 58%)' }}
          />

          {PROOF.map((p, i) => (
            <div
              key={p.value}
              className={`relative flex flex-col items-center justify-center text-center ${seam(i)}`}
              style={{
                paddingBlock: space.gap + space.hair,
                paddingInline: space.line,
                gap: space.hair,
                ...seamColour,
              }}
            >
              <span
                style={{
                  fontFamily: typeScale.display.family,
                  fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em',
                  color: color.over, lineHeight: 1,
                }}
              >
                {p.value}
              </span>
              <span style={{ ...label(9, color.ink3), letterSpacing: '0.18em' }}>
                {p.caption.toUpperCase()}
              </span>
            </div>
          ))}

          {/* The fourth cell is the only one that is not a number, because the
              honest version of a rating on this page is the rating itself -
              `lib/reviews` is scaffold, so no score is printed here. */}
          <a
            href={COMPANY.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`am-tap relative flex flex-col items-center justify-center text-center hover:opacity-80 ${seam(3)}`}
            style={{
              paddingBlock: space.gap + space.hair,
              paddingInline: space.line,
              gap: space.hair,
              minHeight: TARGET_MIN,
              textDecoration: 'none',
              ...seamColour,
            }}
          >
            <span className="inline-flex items-center" style={{ gap: space.hair + 2, color: color.over }}>
              <GoogleG size={iconSize.inline - 2} />
              <span style={{ fontFamily: typeScale.display.family, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }}>
                Google
              </span>
            </span>
            <span style={{ ...label(9, color.ink3), letterSpacing: '0.18em' }}>
              RATED BY OWNERS &rarr;
            </span>
          </a>
        </motion.div>
      </section>

      {/* ═══ 01 SERVICES ═══ */}
      <Chapter id="services">
        <SectionHead index={1} kicker="THE CRAFT" title="Four disciplines, One standard" />
        <div className="grid sm:grid-cols-2 mx-auto" style={{ gap: space.gap, maxWidth: breakpoint.wide - INSET * 8 }}>
          {SERVICE_ORDER.map(cat => {
            const s = SERVICES[cat];
            const from = prices[s.cat] ?? s.from;
            const featured = s.cat === 'PPF';
            return (
              <motion.article
                key={cat}
                {...reveal}
                {...reveal}
                onClick={book}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden cursor-pointer"
                style={{
                  /* FOUR EQUAL CARDS, 2x2.
                     PPF used to span both columns and stand 60px taller, which
                     made the grid 1 + 2 + 1 - and the fourth card sat alone
                     beside a hole the width of a card. The layout was drawing
                     attention to an empty space rather than to the service.
                     "Most popular" is still said, by the badge, which is what
                     a badge is for; the composition no longer has to carry it
                     at the cost of a broken row. */
                  minHeight: 340,
                  borderRadius: radius.stage,
                  border: `${HAIRLINE}px solid ${color.edge}`,
                  boxShadow: elevation.float.shadow,
                }}
              >
                {featured && (
                  <span
                    className="absolute z-10"
                    style={{
                      top: space.gap, right: space.gap,
                      ...label(9, color.over),
                      borderRadius: radius.pill,
                      paddingInline: space.line,
                      paddingBlock: space.hair + 2,
                      background: 'rgba(10,11,13,0.6)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: `${HAIRLINE}px solid ${color.edge}`,
                    }}
                  >
                    MOST POPULAR
                  </span>
                )}
                <Image
                  src={s.img}
                  alt={s.name}
                  fill
                  sizes={imageSizes.fullBleed}
                  className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
                  style={{ fontSize: 0, color: 'transparent' }}
                />
                {/* editorial overlay: type sits on the photograph, no inner card */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, rgba(10,11,13,0.15) 0%, transparent 30%, transparent 45%, rgba(10,11,13,${scrim.photoFloor + 0.37}) 100%)`,
                  }}
                />
                <div className="absolute inset-x-0 bottom-0" style={{ padding: INSET - space.hair }}>
                  <h3
                    style={{
                      fontFamily: typeScale.display.family,
                      fontSize: featured ? 24 : 20,
                      fontWeight: 700,
                      letterSpacing: '-0.015em',
                      color: color.over,
                    }}
                  >
                    {s.name}
                  </h3>
                  <p
                    className="max-w-md"
                    style={{
                      fontFamily: typeScale.body.family,
                      fontSize: typeScale.data.size,
                      lineHeight: 1.5,
                      color: color.over2,
                      marginTop: space.hair,
                    }}
                  >
                    {s.detail}
                  </p>
                  <p style={{ ...label(9.5, color.over2), letterSpacing: '0.14em', marginTop: space.line }}>
                    FROM {formatCurrency(from)}
                    {s.warranty ? ` · ${s.warranty.toUpperCase()} WARRANTY` : ''}
                    {` · ${getDurationLabel(s.durationMin).toUpperCase()}`}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </Chapter>

      {/* ═══ 02 MARKETPLACE ═══ */}
      <Chapter id="cars">
        <SectionHead index={2} kicker="MARKETPLACE" title="Cars, kept honest" />
        <div className="grid sm:grid-cols-2 mx-auto" style={{ gap: space.gap, maxWidth: breakpoint.wide - INSET * 16 }}>
          {[
            { title: 'Buy a car', line: 'Studio-inspected listings with full service history.', cta: 'Browse cars', href: '/cars', img: MEDIA.fallbacks.car },
            { title: 'Sell your car', line: 'List it in minutes — we photograph and vet every car.', cta: 'Start selling', href: '/dashboard/sell-car', img: MEDIA.fallbacks.vehicle },
          ].map(t => (
            <motion.div key={t.href} {...reveal}>
              <Link
                href={t.href}
                className="group relative flex flex-col justify-end overflow-hidden"
                style={{
                  minHeight: 220,
                  borderRadius: radius.stage,
                  border: `${HAIRLINE}px solid ${color.edge}`,
                  boxShadow: elevation.float.shadow,
                }}
              >
                <Image
                  src={t.img}
                  alt={t.title}
                  fill
                  sizes={imageSizes.fullBleed}
                  className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.05]"
                  style={{ fontSize: 0, color: 'transparent' }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(180deg, rgba(10,11,13,0.2) 0%, transparent 35%, rgba(10,11,13,${scrim.photoFloor + 0.37}) 100%)` }}
                />
                <div className="relative" style={{ padding: INSET - space.hair }}>
                  <h3 style={{ fontFamily: typeScale.display.family, fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', color: color.over }}>
                    {t.title}
                  </h3>
                  <p className="max-w-xs" style={{ fontFamily: typeScale.body.family, fontSize: typeScale.data.size, lineHeight: 1.5, color: color.over2, marginTop: space.hair }}>
                    {t.line}
                  </p>
                  <p className="inline-flex items-center" style={{ ...label(9.5, color.over2), letterSpacing: '0.14em', marginTop: space.line, gap: space.hair + 2 }}>
                    {t.cta.toUpperCase()} <span aria-hidden className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </Chapter>

      {/* ═══ 03 MEMBERSHIP ═══ */}
      <Chapter id="membership">
        <SectionHead index={3} kicker="MEMBERSHIP" title="Protect your car, all year" />
        <motion.div
          {...reveal}
          className="flex items-center justify-center flex-wrap mx-auto"
          style={{ columnGap: space.rest / 2, rowGap: space.breath, maxWidth: MEASURE_WIDE, marginTop: -space.gap, marginBottom: space.rest - space.breath }}
        >
          {MEMBER_BENEFITS.map((b, i) => (
            <span key={b} className="inline-flex items-center" style={{ ...label(9.5, color.ink3), gap: space.rest / 2 }}>
              {b}
              {i < MEMBER_BENEFITS.length - 1 && <span aria-hidden style={{ color: color.ink3, opacity: 0.5 }}>&middot;</span>}
            </span>
          ))}
        </motion.div>
        <div className="grid sm:grid-cols-3 mx-auto" style={{ gap: space.gap, maxWidth: breakpoint.wide - INSET * 16 }}>
          {MEMBERSHIP_PLANS.map((p, i) => (
            <motion.button
              key={p.id}
              {...reveal}
              {...reveal}
              onClick={book}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98, y: 0 }}
              className="group relative overflow-hidden text-left flex flex-col justify-between"
              style={{
                aspectRatio: '1.586',
                padding: INSET,
                borderRadius: radius.sheet,
                /* THE CARD IS MADE OF THE METAL IT IS NAMED AFTER.
                   All three faces were the same near-black, so Silver, Gold
                   and Platinum were told apart only by the word printed on
                   them. The tier's own metal now lights the face from the top
                   left and catches the edge - at a tenth of an opacity,
                   because §3.3 allows colour that IS the information and this
                   is the tier itself, not a decoration of it. */
                background:
                  `radial-gradient(120% 120% at 20% 0%, ${metal(p.color, 0.13)} 0%, transparent 58%),`
                  + ` radial-gradient(120% 120% at 20% 0%, ${color.surface} 0%, ${color.paper} 100%)`,
                border: `${HAIRLINE}px solid ${metal(p.color, 0.22)}`,
                boxShadow: elevation.float.shadow,
              }}
            >
              {/* brushed-metal sheen - travels across the face on hover, in the
                  tier's own metal rather than in plain white */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none transition-transform duration-[1200ms] ease-out -translate-x-1/3 group-hover:translate-x-1/3"
                style={{ background: `linear-gradient(115deg, transparent 30%, ${metal(p.color, 0.14)} 45%, transparent 60%)` }}
              />
              <div aria-hidden className="absolute inset-0 noise-overlay pointer-events-none" style={{ opacity: 0.35 }} />
              <div className="flex items-start justify-between">
                <span style={{ ...label(9, color.ink3), letterSpacing: '0.22em' }}>AUTOMODZ MEMBER</span>
                {i === 1 && (
                  <span
                    style={{
                      ...label(8.5, color.ink2),
                      letterSpacing: '0.1em',
                      borderRadius: radius.pill,
                      paddingInline: space.breath,
                      paddingBlock: space.hair / 2,
                      border: `${HAIRLINE}px solid ${color.edge}`,
                    }}
                  >
                    POPULAR
                  </span>
                )}
              </div>
              <div>
                {/* THE TITLE IN ITS OWN METAL. The most direct reading of the
                    tier: the word "Gold" is gold. All three metals are light
                    against the card's near-black, so this costs nothing in
                    legibility - measured against §21.1's floor. */}
                <span className="block" style={{ fontFamily: typeScale.display.family, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: p.color }}>
                  {p.label}
                </span>
                <div className="flex items-end justify-between" style={{ gap: space.line, marginTop: space.hair + 2 }}>
                  <p className="whitespace-nowrap" style={{ fontFamily: typeScale.display.family, fontSize: 24, fontWeight: 700, color: color.ink }}>
                    {formatCurrency(p.price)}
                    <span style={{ fontFamily: typeScale.body.family, fontSize: typeScale.whisper.size, fontWeight: 400, color: color.ink3 }}> /mo</span>
                  </p>
                  <p
                    className="inline-flex items-center whitespace-nowrap"
                    style={{ fontFamily: typeScale.body.family, fontSize: typeScale.whisper.size, color: color.ink3, gap: space.hair + 2, paddingBottom: space.hair }}
                  >
                    <Droplets size={iconSize.inline - 4} /> {p.washesPerMonth} washes
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </Chapter>

      {/* ═══ 04 BEFORE / AFTER ═══ */}
      <Chapter id="gallery">
        <SectionHead index={4} kicker="THE DIFFERENCE" title="See for yourself" />
        {/* THE FRAME IS THE FILM'S WIDTH, because the film is PORTRAIT.
            This was capped at a landscape measure and the video inside it was
            a 16/9 box on `object-fit: cover` - so a 720x998 film was being
            filled into a wide frame and everything above and below the middle
            band was thrown away. That is the crop.
            Now the cap is a portrait one: the glass hugs the film instead of
            the film being cut to fit the glass. On a phone the column is
            narrower than this anyway, so one value serves both. */}
        <motion.div {...reveal} className="relative mx-auto" style={{ maxWidth: 520 }}>
          <div className="relative" style={{ borderRadius: radius.stage, padding: space.breath, ...glass() }}>
            {/* ── THE STUDIO'S OWN FILM ────────────────────────────────────
                This was a before/after drag over the SAME stock photograph
                twice, the second copy CSS-filtered to look dirty - the section
                asked the customer to see the difference and then showed them a
                filter. The studio has a commercial; it is the real thing.

                `muted` is what makes `autoPlay` legal on every mobile browser,
                and it is also the right behaviour: §7.4 permits ambient motion,
                and sound that starts by itself is not ambient. `playsInline`
                stops iOS taking it fullscreen. No controls, because there is
                nothing to control - it loops.

                `poster` is the first frame's job, so the glass is never a
                black rectangle while the file arrives, and `preload="metadata"`
                keeps 2.7MB off the critical path of a page most people reach
                on a phone. */}
            <video
              src={MEDIA.video.commercial}
              poster={MEDIA.hero.homepage}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="AutoModz at work - a short film of the studio"
              className="block w-full"
              style={{
                borderRadius: radius.sheet,
                /* THE FILM SIZES THE FRAME, not the other way round.
                   This was a 16/9 box with `object-fit: cover`, which happens
                   to match this file and would silently crop the next one -
                   `cover` fills the box and throws away whatever does not fit.
                   `height: auto` lets the element take the video's OWN ratio,
                   so the frame is always exactly the film's shape and there is
                   nothing left to crop. `contain` is belt-and-braces for the
                   moment before metadata arrives. */
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
        </motion.div>
      </Chapter>

      {/* ═══ 05 CONTACT ═══ */}
      <Chapter id="contact">
        <SectionHead index={5} kicker="CONTACT" title="Bring it by, We&rsquo;ll take it from there." />
        <div className="mx-auto" style={{ maxWidth: MEASURE_WIDE }}>
          <motion.div {...reveal} className="overflow-hidden" style={{ borderRadius: radius.stage, ...glass() }}>
            <div className="relative" style={{ height: 176 }}>
              <iframe
                title="AutoModz on Google Maps"
                src="https://www.google.com/maps?q=AutoModz+Maninagar+Ahmedabad+Bhairavnath+Rd&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full"
                style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg) grayscale(1) contrast(0.92) brightness(0.9)' }}
              />
            </div>
            <div style={{ padding: INSET - space.hair }}>
              {/* studio identity row: name + live hours */}
              <div className="flex items-start justify-between flex-wrap" style={{ gap: space.line }}>
                <div>
                  <p style={{ fontFamily: typeScale.title.family, fontSize: space.gap, fontWeight: 600, color: color.ink }}>
                    AutoModz Detailing Studio
                  </p>
                  <p
                    className="flex items-start"
                    style={{ fontFamily: typeScale.body.family, fontSize: typeScale.data.size, lineHeight: 1.55, color: color.ink2, gap: space.hair + 2, marginTop: space.hair }}
                  >
                    <MapPin size={iconSize.inline - 3} style={{ marginTop: 2, flexShrink: 0 }} /> {COMPANY.address}
                  </p>
                </div>
                {openNow !== null && (
                  <span
                    className="inline-flex items-center shrink-0"
                    style={{
                      ...label(9, openNow ? color.ink : color.ink3),
                      letterSpacing: '0.12em',
                      borderRadius: radius.pill,
                      paddingInline: space.line,
                      paddingBlock: space.hair + 2,
                      gap: space.hair + 2,
                      border: `${HAIRLINE}px solid ${color.edge}`,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: radius.pill, background: openNow ? color.ink : color.ink3 }} />
                    {/* The window the pill is computed from (9 ≤ h < 21), stated
                        in the customer's words. It is deliberately NOT
                        `COMPANY.hours`, which is the booking day (09:00–19:00)
                        - showing that beside a pill derived from a different
                        window would make the two disagree in the last two
                        hours of every evening. */}
                    {openNow ? 'OPEN' : 'CLOSED'} &middot; 9 AM – 9 PM
                  </span>
                )}
              </div>

              {/* four ways in - every path a customer actually uses */}
              <div className="grid grid-cols-2" style={{ gap: space.breath + 2, marginTop: space.rest / 2 - space.hair }}>
                {[
                  { label: 'CALL', icon: <Phone size={iconSize.inline - 3} />, href: telLink() },
                  { label: 'WHATSAPP', icon: <WhatsAppMark size={iconSize.inline - 3} />, href: waLink(`Hi ${COMPANY.name}! I'd like to book a detailing slot.`) },
                  { label: 'REVIEWS', icon: <GoogleG size={iconSize.inline - 3} />, href: COMPANY.googleReviewUrl },
                  { label: 'DIRECTIONS', icon: <Navigation size={iconSize.inline - 3} />, href: COMPANY.mapsUrl, primary: true },
                ].map(a => (
                  <a
                    key={a.label}
                    href={a.href}
                    {...(a.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="inline-flex items-center justify-center transition-transform active:scale-[0.97]"
                    style={{
                      minHeight: TARGET_MIN + space.hair,
                      borderRadius: radius.chip,
                      gap: space.breath,
                      ...label(10.5, color.ink2),
                      letterSpacing: '0.1em',
                      ...(a.primary
                        ? { color: color.paper, background: color.ink }
                        : { border: `${HAIRLINE}px solid ${color.edge}`, background: 'rgba(255,255,255,0.04)' }),
                    }}
                  >
                    {a.icon} {a.label}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Chapter>

      {/* ── footer ── */}
      <footer
        className="relative z-10 text-center"
        style={{ paddingInline: INSET, paddingTop: space.rest, paddingBottom: space.rest - space.hair * 2, borderTop: `${HAIRLINE}px solid ${color.edge}` }}
      >
        <div className="flex flex-col items-center" style={{ gap: space.rest / 2 }}>
          <Wordmark height="clamp(18px, 5vw, 24px)" variant="white" />
          <div className="flex items-center" style={{ gap: space.rest - space.gap }}>
            <a href={telLink()} className="inline-flex items-center" style={{ ...label(9.5, color.ink3), minHeight: TARGET_MIN }}>CALL</a>
            <a href={COMPANY.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center" style={{ ...label(9.5, color.ink3), minHeight: TARGET_MIN }}>DIRECTIONS</a>
            <Link href="/auth/login" className="inline-flex items-center" style={{ ...label(9.5, color.ink3), minHeight: TARGET_MIN }}>SIGN IN</Link>
          </div>
          <p style={{ ...label(9, color.ink3), letterSpacing: '0.14em', opacity: 0.7 }}>
            © {new Date().getFullYear()} AUTOMODZ &middot; CRAFTED IN AHMEDABAD
          </p>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
    </MotionConfig>
  );
}

/* ── shared bits ── */

const MEASURE_WIDE = 672;

/** A section with its opening seam. */
function Chapter({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className="relative z-10"
      style={{ paddingInline: INSET, paddingTop: space.movement - space.gap, paddingBottom: space.rest + space.gap }}
    >
      <ChapterSeam />
      {children}
    </section>
  );
}

/** The seam that opens a chapter: a full-bleed hairline horizon so each section
 *  reads as a new page rather than the next paragraph of one long document. */
function ChapterSeam() {
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 pointer-events-none">
      <div style={{ height: HAIRLINE, background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.11) 50%, transparent)` }} />
      <div style={{ height: space.movement, background: 'linear-gradient(180deg, rgba(255,255,255,0.022), transparent)' }} />
    </div>
  );
}

function SectionHead({ index, kicker, title, sub }: { index: number; kicker: string; title: string; sub?: string }) {
  return (
    <div className="relative text-center mx-auto" style={{ maxWidth: MEASURE_WIDE, marginBottom: space.rest + space.gap }}>
      {/* the chapter number, ghosted behind the head - the editorial page mark.
          Static (not a reveal) so its centering transform is never clobbered by
          an animated one, and so the page mark is always present. */}
      <span
        aria-hidden
        className="pointer-events-none select-none absolute left-1/2 -translate-x-1/2"
        style={{
          top: 'clamp(-46px, -7vw, -34px)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          fontFamily: typeScale.display.family,
          fontSize: poster.mark,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.035) 58%, transparent)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {String(index).padStart(2, '0')}
      </span>
      <motion.p
        {...reveal}
        {...reveal}
        className="relative"
        style={{ ...label(10.5, color.ink3), letterSpacing: '0.24em', marginBottom: space.line }}
      >
        {kicker}
      </motion.p>
      <motion.h2
        {...reveal}
        {...reveal}
        className="relative"
        style={{
          fontFamily: typeScale.display.family,
          fontSize: poster.chapter,
          fontWeight: 800,
          lineHeight: 1.04,
          letterSpacing: '-0.02em',
          color: color.ink,
        }}
      >
        {title}
      </motion.h2>
      {sub && (
        <motion.p
          {...reveal}
          {...reveal}
          className="relative"
          style={{ fontFamily: typeScale.body.family, fontSize: typeScale.body.size, lineHeight: 1.6, color: color.ink3, marginTop: space.gap }}
        >
          {sub}
        </motion.p>
      )}
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
