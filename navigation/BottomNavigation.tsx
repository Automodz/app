'use client';
/**
 * BOTTOM NAVIGATION
 *
 * Source: docs/AUTOMODZ-OS.md §6.1, §6.2, §6.3, §3.4, §3.5, §7.2, §8.5,
 *         §9.3, §21.3, §21.5, §21.6
 *
 * ── WHY IT LOOKS LIKE THIS ──────────────────────────────────────────────
 * §6.1 asks navigation to feel like moving through "one lit space", and the
 * brief asks it to disappear into the experience rather than compete with it.
 * Three decisions follow, and each is the constitution's rather than a taste:
 *
 * 1. IT FLOATS. A full-width bar bolted to the bottom edge is chrome — it
 *    frames the product like a dashboard. This is an object resting in the
 *    room: inset from the edges, fully rounded, lifted by the `nav` band
 *    (§9.3). §3.4 — it is raised by light, not by a stroke.
 *
 * 2. ONLY THE CURRENT ROOM IS NAMED. Every slot always carries its accessible
 *    name (§21.6), but only the lit one shows the word. Four permanent labels
 *    is four permanent demands for attention; §3.5 — "every element removed
 *    makes the rest louder."
 *
 * 3. THE LIGHT MOVES. §6.2 requires the bar to show where the customer is, and
 *    §6.1 wants that to read as walking rather than switching. A single shared
 *    indicator slides between slots instead of one turning off while another
 *    turns on.
 *
 * §6.3 — the primary action sits apart from the four, in ink, permanently.
 * It is not a fifth tab and must never be styled as one.
 *
 * §3.3 — nothing here is coloured. Ink for the room you are in, tertiary ink
 * for the rooms you are not; colour in this product means state, and where you
 * are standing is not a state.
 * ─────────────────────────────────────────────────────────────────────────
 */
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import { Home, Car, Clock, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  color, elevation, radius, space, duration, easing, curve,
  iconSize, STROKE, TARGET_MIN, NAV_GAP, HAIRLINE,
} from '@/design';
import { Text } from '@/components/system';
import { StudioMark } from './StudioMark';
import { useNavigation } from './NavigationProvider';
import {
  slots, rooms, primaryAction, HOME, GARAGE, HISTORY, PROFILE,
} from './routes';

/**
 * The glyph for each slot. Icons live here rather than in `routes.ts` because
 * a route is an address and a glyph is a rendering of it — keeping them apart
 * means the route table stays free of React.
 */
const GLYPH: Record<string, LucideIcon> = {
  [HOME]: Home,
  /* §11.1 — the vehicle is the spine of the product, so the collection wears
     the car itself rather than a building. */
  [GARAGE]: Car,
  [HISTORY]: Clock,
  [PROFILE]: User,
};

/**
 * WHAT "YOU ARE HERE" LOOKS LIKE — one implementation, §22.2.
 *
 * §6.1 — "one light, moving. Not four lights switching." The shared `layoutId`
 * is what makes it one: framer-motion carries the same element between
 * controls, so arriving somewhere is the light travelling rather than two
 * lights blinking. It has five possible destinations, not four — the Studio is
 * reached by its own control and still has to be able to say "here" (§6.2).
 */
function Here({ move }: { move: Transition }) {
  return (
    <motion.span
      layoutId="room-light"
      aria-hidden
      transition={move}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius.pill,
        background: color.paper,
        /* A decorative overlay must never eat input. `layoutId` positions this
           element by transform, so while the light is travelling it overlaps the
           slot next door; nothing has been seen to swallow a tap because of it,
           and this makes that impossible rather than incidental. */
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * §3.5 — only the room you are in says its name.
 *
 * WITHHELD ON A NARROW PHONE, and the reason is arithmetic. The bar's widest
 * state measures 358px; a 360px viewport offers 344 and a 375px one (iPhone SE)
 * offers 359 before this padding was reduced. The word is worth 48px of that,
 * so on those devices the bar was clipped at both ends — the Home slot and the
 * Studio mark ran off the screen.
 *
 * The rule lives in globals.css keyed on `data-nav-word`, because a media query
 * cannot be written as an inline style. Nothing is lost where it applies: the
 * glyph and the travelling light still say where the customer is, and
 * `aria-label` carries the name to assistive technology at every width.
 */
function Word({ name }: { name: string }) {
  return (
    <Text
      role="whisper"
      tone="ink"
      as="span"
      data-nav-word=""
      style={{ position: 'relative', whiteSpace: 'nowrap' }}
    >
      {name}
    </Text>
  );
}

export function BottomNavigation() {
  const { activeSlot, navVisible, navigate } = useNavigation();
  const still = useReducedMotion();
  const studioActive = activeSlot === primaryAction.path;

  /* §7.2, §22.2 — one curve, from the tokens. Typing the four control points
     out here would be a third copy of the system's ease. */
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
        /* §8.5 — the bar declares its own distance from the edge, and the safe
           area is included here so no surface has to remember it. */
        bottom: `calc(${NAV_GAP}px + env(safe-area-inset-bottom, 0px))`,
        zIndex: elevation.nav.z,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: navVisible ? 'auto' : 'none',
        /* The pill is centred and floating, so this is only a guarantee that it
           never touches a screen edge — `breath` is enough for that, and the
           `gap` it used to be cost 32px the narrowest phone did not have. */
        paddingInline: space.breath,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.breath,
          padding: space.breath,
          borderRadius: radius.pill,
          background: color.surface,
          boxShadow: elevation.nav.shadow,
        }}
      >
        {slots.map(path => {
          const room = rooms[path];
          const Glyph = GLYPH[path];
          const active = activeSlot === path;
          return (
            <Link
              key={path}
              href={path}
              onClick={e => { e.preventDefault(); navigate(path); }}
              /* §21.6 — the name is always available, even when the word is
                 not shown. §21.8 — it is the customer's word. */
              aria-label={room.name}
              aria-current={active ? 'page' : undefined}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: space.breath,
                /* §21.3 — the floor, whatever the glyph does. */
                minWidth: TARGET_MIN,
                minHeight: TARGET_MIN,
                paddingInline: active ? space.gap : 0,
                justifyContent: 'center',
                borderRadius: radius.pill,
                textDecoration: 'none',
                color: active ? color.ink : color.ink3,
                transition: `color ${duration.move}ms ${easing.ease}`,
              }}
            >
              {active ? <Here move={move} /> : null}
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <Glyph size={iconSize.nav} strokeWidth={STROKE} />
              </span>
              {active ? <Word name={room.name} /> : null}
            </Link>
          );
        })}

        {/* §6.3 — "a permanent, distinct control, NOT a slot among equals."
            The hairline is what makes it distinct. Separation says "this is a
            different kind of thing" without an inverted fill, which would be a
            floating-action button — a convention that means *create*, and
            entering the studio creates nothing. */}
        <span
          aria-hidden
          style={{
            alignSelf: 'stretch',
            width: HAIRLINE,
            background: color.edge,
            /* `hair`, not `breath`. The pill already carries `breath` as its own
               gap on both sides of this rule, so `breath` here was doubling it —
               and those 8px were the last thing standing between the bar and a
               320px screen, where it measured 305 against 304 available. */
            marginInline: space.hair,
            marginBlock: space.breath,
          }}
        />

        {/* THE STUDIO MARK — light, and its reflection in a perfect surface.
            The studio signs its own work, and the signature is the way in.
            See StudioMark.tsx for what it draws and why.

            It carries no container (design/icons.ts rule 3), which is what
            keeps it clear of both the floating-action-button and the circular
            -avatar conventions. §3.3 — it is ink, never coloured; the only
            other full-ink element in the bar is the room you are standing in. */}
        {/* §6.2 — the navigation "always shows where the customer is", and that
            has to include the room reached by this control rather than by a
            slot. Standing in the Studio indicated nothing at all until this was
            added, because the mark was always full ink and so could not say
            "here".

            It now carries the SAME three signals a slot does — the travelling
            light, its word, full ink — because §6.2 makes no exception for the
            one room that is not a slot, and an indicator that is merely
            similar is one a customer has to learn separately.

            §6.3's "not a slot among equals" is unaffected: what makes this
            control distinct is the hairline above it and the mark itself, not a
            weaker way of saying where you are. */}
        <Link
          href={primaryAction.path}
          onClick={e => { e.preventDefault(); navigate(primaryAction.path); }}
          aria-label={primaryAction.label}
          aria-current={studioActive ? 'page' : undefined}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: space.breath,
            justifyContent: 'center',
            minWidth: TARGET_MIN,
            minHeight: TARGET_MIN,
            paddingInline: studioActive ? space.gap : 0,
            borderRadius: radius.pill,
            textDecoration: 'none',
            color: studioActive ? color.ink : color.ink3,
            transition: `color ${duration.move}ms ${easing.ease}`,
          }}
        >
          {studioActive ? <Here move={move} /> : null}
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <StudioMark size="nav" />
          </span>
          {studioActive ? <Word name={rooms[primaryAction.path].name} /> : null}
        </Link>
      </div>
    </motion.nav>
  );
}
