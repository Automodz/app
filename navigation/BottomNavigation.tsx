'use client';
/**
 * THE DOCK
 *
 * Source: docs/AUTOMODZ-OS.md §6.1, §6.2, §6.3, §3.4, §3.5, §7.2, §8.5,
 *         §9.3, §21.3, §21.5, §21.6
 *         design "AutoModz App.dc.html" — drawn identically on all twelve screens
 *
 * ── WHY IT LOOKS LIKE THIS ──────────────────────────────────────────────
 * §6.1 asks navigation to feel like moving through "one lit space", and the
 * design answers with an object resting in the room rather than chrome bolted
 * to its edge: inset on all three sides, fully rounded, glass, lifted by a
 * shadow and a lit top edge (§3.4 — raised by light, not by a stroke).
 *
 * Three things changed when the design was ratified, and each is a reversal
 * of something this file used to argue for:
 *
 * 1. FIVE SLOTS, NOT FOUR PLUS A MARK. See navigation/routes.ts for why that
 *    honours §6.3 rather than dropping it.
 *
 * 2. EVERY SLOT SAYS ITS NAME. This file used to withhold the word from the
 *    four rooms you were not in, on §3.5 grounds. But the words are set in
 *    9px mono at 42% ink — quieter than the glyphs they sit under — and a
 *    name you can read without tapping is not a demand for attention, it is
 *    the removal of a guess. The old rule also forced a 390px media query to
 *    stop the bar clipping; a column of glyph-over-word does not.
 *
 * 3. THE LIGHT DOES NOT TRAVEL. A shared `layoutId` slid one indicator
 *    between slots. With the word always present there is nothing left for
 *    it to reveal, and the design says "here" the way the rest of the product
 *    says everything: the amber light falls on it. §3.3 stands — warmth means
 *    the studio, and where you are standing is the one place the studio's
 *    light is pointed.
 * ─────────────────────────────────────────────────────────────────────────
 */
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import {
  color, elevation, radius, space, duration, easing, curve, TARGET_MIN, NAV_GAP,
} from '@/design';
import { useNavigation } from './NavigationProvider';
import { slots, rooms, HOME, STUDIO, GARAGE, MEMBERSHIP, PROFILE } from './routes';

/**
 * THE GLYPHS.
 *
 * Drawn here rather than imported from an icon set, because the design draws
 * them: a clock for the present moment, the car itself for the car, a roof for
 * the place the work happens, a shuttered bay for the collection, a person for
 * the person. Lucide's nearest equivalents are heavier and read as an icon
 * font — these are one 1.4px stroke on a 24 grid, like every other line in the
 * product.
 *
 * `currentColor` throughout, so a slot's colour is decided once, by the slot.
 */
const GLYPH: Record<string, React.ReactNode> = {
  /* Now — a clock, because Home is a moment, not a house. */
  [HOME]: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  /* The Club — a card, held. Not a crown, not a star, not a badge: those are
     loyalty-scheme marks and §15.1 makes a membership a relationship. */
  [MEMBERSHIP]: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.2" />
      <path d="M3 10.5h18" />
    </>
  ),
  /* The studio — a roof. The place, never a tool or a spanner. */
  [STUDIO]: <path d="M4 9l8-5 8 5v10a1 1 0 01-1 1H5a1 1 0 01-1-1z" />,
  /* The garage — the car itself, because §11.1 makes the vehicle the spine of
     the product and the collection is where a customer goes to find one. */
  [GARAGE]: (
    <>
      <path d="M4 15l1.6-5A2 2 0 017.5 8.6h9A2 2 0 0118.4 10L20 15" />
      <rect x="3" y="15" width="18" height="4" rx="1.6" />
    </>
  ),
  /* You. */
  [PROFILE]: <><circle cx="12" cy="9" r="3.4" /><path d="M5.5 19a6.5 6.5 0 0113 0" /></>,
};

function Glyph({ path }: { path: string }) {
  return (
    <svg
      width={18} height={18} viewBox="0 0 24 24" aria-hidden
      fill="none" stroke="currentColor" strokeWidth={1.4}
      strokeLinecap="round" strokeLinejoin="round"
    >
      {GLYPH[path]}
    </svg>
  );
}

export function BottomNavigation() {
  const { activeSlot, navVisible, navigate } = useNavigation();
  const still = useReducedMotion();

  /* §7.2, §22.2 — one curve, from the tokens. */
  const move: Transition = still
    ? { duration: 0 }
    : { duration: duration.move / 1000, ease: curve.ease };

  return (
    <motion.nav
      aria-label="Rooms"
      initial={false}
      /* §6.2 — it leaves for a takeover and returns after. §7.2 — the system
         initiates this, so it moves on the ease curve, never the spring. */
      animate={{
        y: navVisible ? 0 : `calc(100% + ${NAV_GAP}px)`,
        opacity: navVisible ? 1 : 0,
      }}
      transition={move}
      style={{
        position: 'fixed',
        insetInline: 0,
        /* §8.5 — the dock declares its own distance from the edge, and the
           safe area is included here so no surface has to remember it. */
        bottom: `calc(${NAV_GAP}px + env(safe-area-inset-bottom, 0px))`,
        zIndex: elevation.nav.z,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: navVisible ? 'auto' : 'none',
        paddingInline: NAV_GAP,
      }}
    >
      <div
        className="am-glass am-glass-lit"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          /* The design's dock spans the screen inset by its own gap, rather
             than hugging five glyphs. On a phone that is the same object; on a
             tablet it stops the dock stretching into a rail. */
          width: '100%',
          maxWidth: 460,
          padding: `${space.line}px ${space.gap}px`,
          borderRadius: radius.pill,
          boxShadow: elevation.nav.shadow,
          /* THE DOCK CARRIES ITS OWN GROUND.
             `--pane-lit` is white at 3–8% — the material is essentially the
             blur of whatever is behind it, which is right for a card resting
             in a dark room and wrong for the one element that is ALWAYS on
             screen. The Garage, the record and the car are full-bleed
             photographs, and a white car scrolling under the dock turned it
             pale and took its four quiet names with it. §21.1 solves for the
             worst image; this is that floor. The gradient and the sheen still
             sit on top, so the material is unchanged — it simply has
             something dark to be glass against. */
          backgroundColor: 'rgba(8,9,10,0.78)',
        }}
      >
        {slots.map(path => {
          const room = rooms[path];
          const active = activeSlot === path;
          return (
            <Link
              key={path}
              href={path}
              onClick={e => { e.preventDefault(); navigate(path); }}
              /* §21.6 — the name is always available; here it is also always
                 visible, so the two agree. §21.8 — the customer's word. */
              aria-label={room.name}
              aria-current={active ? 'page' : undefined}
              className="am-tap"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                /* §21.3 — the floor, whatever the glyph does. */
                minWidth: TARGET_MIN,
                minHeight: TARGET_MIN,
                flex: 1,
                textDecoration: 'none',
                /* §3.3 — the studio's light falls on where you are standing,
                   and on nothing else in this control.

                   THE QUIET FOUR ARE `ink3`, NOT A LITERAL. This was
                   `rgba(237,235,231,0.42)` — primary ink at 42%, which is a
                   number nobody had measured: it composites to roughly 2.6:1
                   on the dock's own glass, under the 4.5:1 §21.1 requires of
                   the names it is setting. `ink3` is the token the palette
                   publishes for exactly this — "labels and whispers" — and it
                   is 6.31:1 with the contrast recorded beside it. §22.4: no
                   component writes its own colour value. */
                color: active ? color.amber : color.ink3,
                transition: `color ${duration.move}ms ${easing.ease}`,
              }}
            >
              <Glyph path={path} />
              <span
                className="am-label"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  color: 'currentColor',
                  lineHeight: 1,
                }}
              >
                {room.name}
              </span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
