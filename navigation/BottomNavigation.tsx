'use client';
/**
 * THE DOCK
 *
 * Source: docs/AUTOMODZ-OS.md §6.1, §6.2, §6.3, §3.4, §3.5, §7.2, §8.5,
 *         §9.3, §21.3, §21.5, §21.6
 *         design "AutoModz App.dc.html" - drawn identically on all twelve screens
 *
 * ── WHY IT LOOKS LIKE THIS ──────────────────────────────────────────────
 * §6.1 asks navigation to feel like moving through "one lit space", and the
 * design answers with an object resting in the room rather than chrome bolted
 * to its edge: inset on all three sides, fully rounded, glass, lifted by a
 * shadow and a lit top edge (§3.4 - raised by light, not by a stroke).
 *
 * Three things changed when the design was ratified, and each is a reversal
 * of something this file used to argue for:
 *
 * 1. FIVE SLOTS, NOT FOUR PLUS A MARK. See navigation/routes.ts for why that
 *    honours §6.3 rather than dropping it.
 *
 * 2. EVERY SLOT SAYS ITS NAME. This file used to withhold the word from the
 *    four rooms you were not in, on §3.5 grounds. But the words are set in
 *    9px mono at 42% ink - quieter than the glyphs they sit under - and a
 *    name you can read without tapping is not a demand for attention, it is
 *    the removal of a guess. The old rule also forced a 390px media query to
 *    stop the bar clipping; a column of glyph-over-word does not.
 *
 * 3. THE LIGHT DOES NOT TRAVEL. A shared `layoutId` slid one indicator
 *    between slots. With the word always present there is nothing left for
 *    it to reveal, and the design says "here" the way the rest of the product
 *    says everything: the amber light falls on it. §3.3 stands - warmth means
 *    the studio, and where you are standing is the one place the studio's
 *    light is pointed.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import {
  color, elevation, radius, space, duration, easing, curve, TARGET_MIN, NAV_GAP,
} from '@/design';
import { useAppStore } from '@/lib/store';
import { useNavigation } from './NavigationProvider';
import { slots, rooms, HOME, STUDIO, GARAGE, MEMBERSHIP, PROFILE } from './routes';

/**
 * THE GLYPHS.
 *
 * Drawn here rather than imported from an icon set, because the design draws
 * them: a clock for the present moment, the car itself for the car, a roof for
 * the place the work happens, a shuttered bay for the collection, a person for
 * the person. Lucide's nearest equivalents are heavier and read as an icon
 * font - these are one 1.4px stroke on a 24 grid, like every other line in the
 * product.
 *
 * `currentColor` throughout, so a slot's colour is decided once, by the slot.
 */
const GLYPH: Record<string, React.ReactNode> = {
  /* Now - a clock, because Home is a moment, not a house. */
  [HOME]: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  /* The Club - a card, held. Not a crown, not a star, not a badge: those are
     loyalty-scheme marks and §15.1 makes a membership a relationship. */
  [MEMBERSHIP]: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.2" />
      <path d="M3 10.5h18" />
    </>
  ),
  /* THE STUDIO - THE CRAFT, NOT THE BUILDING.
     It was a roof, which is a house: it named the premises when the slot is
     where a customer goes to have work DONE. This is the polisher over a
     panel, with the finish coming up beside it - the two things the studio
     actually sells. The sparkle is one mark, not three: §3.4 keeps light as
     the ornament, and three would be a sticker. */
  [STUDIO]: (
    <>
      {/* The car, head-on: roof and screen, then the body, then the lamps and
          the grille between them. */}
      <path d="M5.4 14.9l1.4-3A2 2 0 018.6 10.7h6.8a2 2 0 011.8 1.2l1.4 3" />
      <rect x="3.4" y="14.9" width="17.2" height="5" rx="1.8" />
      <path d="M6 17.1h2.6M15.4 17.1h2.6M10.6 18.1h2.8" />
      {/* The polisher, resting on the roof, with its lead running off. */}
      <circle cx="15.9" cy="7.2" r="2.5" />
      <path d="M17.7 5.4l1.6-1.7" />
      <path d="M19.3 3.7c1-1 2.2.1 1.4 1.1s.5 1.9 1.3 1.2" />
      {/* The finish coming up. Two marks, not four - §3.4 keeps light the
          ornament, and a row of stars is a sticker. */}
      <path d="M4.6 3.4l.55 1.35L6.5 5.3l-1.35.55L4.6 7.2l-.55-1.35L2.7 5.3l1.35-.55z" />
      <path d="M8.4 6.6l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" />
    </>
  ),
  /* THE GARAGE - THE CAR, AND THE PLACE IT IS KEPT.
     It was the car alone, which is the same subject as every photograph in the
     product and read as "a car" rather than as "your cars". The roof and the
     two posts make it a garage; the car stays inside it, because §11.1 keeps
     the vehicle the spine and the collection is where you go to find one. */
  [GARAGE]: (
    <>
      <path d="M3 10.4L12 4.6l9 5.8" />
      <path d="M4.9 9.6V20M19.1 9.6V20" />
      <path d="M7.6 16.6l.9-2.6a1.5 1.5 0 011.4-1h4.2a1.5 1.5 0 011.4 1l.9 2.6" />
      <rect x="7.1" y="16.6" width="9.8" height="2.8" rx="1.1" />
    </>
  ),
  /* You. */
  [PROFILE]: <><circle cx="12" cy="9" r="3.4" /><path d="M5.5 19a6.5 6.5 0 0113 0" /></>,
};

/** The drawn mark. One 1.4px stroke on a 24 grid, `currentColor` throughout. */
function Glyph({ path }: { path: string }) {
  return (
    <svg
      width={22} height={22} viewBox="0 0 24 24" aria-hidden
      fill="none" stroke="currentColor" strokeWidth={1.4}
      strokeLinecap="round" strokeLinejoin="round"
    >
      {GLYPH[path]}
    </svg>
  );
}

/**
 * YOU, AS YOURSELF.
 *
 * The one slot that is about a person gets that person's own picture, which is
 * how every application a customer already uses marks this slot. It is the
 * same argument `YouScreen` makes at length for the monogram: §2.2 forbids
 * naming the STUDIO's people, so that confidence attaches to the place rather
 * than to a technician - the customer is not one of them, and their own face on
 * their own screen names nobody but themselves.
 *
 * The drawn mark stays for everyone the picture fails for: no Google photo, an
 * account made another way, or a URL that will not load. §11.5 - the absence is
 * composed, never a broken image and never an empty ring.
 */
function Portrait({ src, active }: { src?: string; active: boolean }) {
  const [failed, setFailed] = useState(false);
  /* THE SAME THREE STATES `Photograph` OWNS, MARKED THE SAME WAY.
     It is not that primitive - that one fills a frame and composes absence as
     a lit plate, which is right for a car and wrong for a 22px slot where the
     honest absence is the drawn person. But the CONTRACT is the primitive's:
     absent, ready and failed are three states and none of them is a broken
     image. `data-photograph` is how the product marks that, so this says it
     out loud and `surface-law` can read it. */
  if (!src || failed) {
    return (
      <span data-photograph={src ? 'failed' : 'absent'} style={{ display: 'flex' }}>
        <Glyph path={PROFILE} />
      </span>
    );
  }
  return (
    <img
      data-photograph="ready"
      src={src}
      alt=""
      width={22}
      height={22}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{
        width: 22, height: 22, borderRadius: '50%', objectFit: 'cover',
        /* Lit the way every other slot is lit - the ring is the state, and the
           picture inside it never changes. */
        boxShadow: active ? `0 0 0 1.6px ${color.amber}` : `0 0 0 1.2px ${color.ink3}`,
        /* An avatar that fails to decode must not collapse to its alt text and
           push the four names beside it out of position. */
        fontSize: 0, color: 'transparent',
      }}
    />
  );
}

export function BottomNavigation() {
  const { activeSlot, navVisible, navigate } = useNavigation();
  /* The customer's own picture for the one slot that is about them. */
  const user = useAppStore(st => st.user);
  const still = useReducedMotion();

  /* §7.2, §22.2 - one curve, from the tokens. */
  const move: Transition = still
    ? { duration: 0 }
    : { duration: duration.move / 1000, ease: curve.ease };

  return (
    <motion.nav
      aria-label="Rooms"
      initial={false}
      /* §6.2 - it leaves for a takeover and returns after. §7.2 - the system
         initiates this, so it moves on the ease curve, never the spring. */
      animate={{
        y: navVisible ? 0 : `calc(100% + ${NAV_GAP}px)`,
        opacity: navVisible ? 1 : 0,
      }}
      transition={move}
      style={{
        position: 'fixed',
        insetInline: 0,
        /* §8.5 - the dock declares its own distance from the edge, and the
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
             `--pane-lit` is white at 3–8% - the material is essentially the
             blur of whatever is behind it, which is right for a card resting
             in a dark room and wrong for the one element that is ALWAYS on
             screen. The Garage, the record and the car are full-bleed
             photographs, and a white car scrolling under the dock turned it
             pale and took its four quiet names with it. §21.1 solves for the
             worst image; this is that floor. The gradient and the sheen still
             sit on top, so the material is unchanged - it simply has
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
              /* §21.6 - the name is always available; here it is also always
                 visible, so the two agree. §21.8 - the customer's word. */
              aria-label={room.name}
              aria-current={active ? 'page' : undefined}
              className="am-tap"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                /* §21.3 - the floor, whatever the glyph does. */
                minWidth: TARGET_MIN,
                minHeight: TARGET_MIN,
                flex: 1,
                textDecoration: 'none',
                /* §3.3 - the studio's light falls on where you are standing,
                   and on nothing else in this control.

                   THE QUIET FOUR ARE `ink3`, NOT A LITERAL. This was
                   `rgba(237,235,231,0.42)` - primary ink at 42%, which is a
                   number nobody had measured: it composites to roughly 2.6:1
                   on the dock's own glass, under the 4.5:1 §21.1 requires of
                   the names it is setting. `ink3` is the token the palette
                   publishes for exactly this - "labels and whispers" - and it
                   is 6.31:1 with the contrast recorded beside it. §22.4: no
                   component writes its own colour value. */
                color: active ? color.amber : color.ink3,
                transition: `color ${duration.move}ms ${easing.ease}`,
              }}
            >
              {/* THE MARK CARRIES THE SLOT, AND THE NAME IS STILL THERE.
                  Five words under five glyphs is a toolbar; the dock is meant
                  to disappear into the room. The names came off, the marks came
                  up from 18 to 22, and the lit one is still the only coloured
                  thing in the control (§3.3, §6.2 - it always shows where you
                  are). §21.6 is unharmed: `aria-label` on the link is the
                  accessible name and it has not moved - a screen reader reads
                  exactly what it read before. */}
              {path === PROFILE
                ? <Portrait src={user?.photoURL} active={active} />
                : <Glyph path={path} />}
              {/* Where you are, said without a word. */}
              <span
                aria-hidden
                style={{
                  width: active ? 14 : 0,
                  height: 2,
                  borderRadius: 2,
                  background: color.amber,
                  opacity: active ? 1 : 0,
                  transition: `width ${duration.move}ms ${easing.ease},`
                    + ` opacity ${duration.move}ms ${easing.ease}`,
                }}
              />
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
