'use client';
/**
 * HOW EVERY ROOM STARTS.
 *
 * Source: docs/AUTOMODZ-OS.md §6.2, §9.5, §21.3, §21.6, §21.8, §22.2
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Ten screens opened with the same four lines — `<OfflineNote/>` and a
 * `<Statement eyebrow=… size=…/>` — and no two agreed on the numbers: the
 * display was 28, 29 or 30 depending on the screen, and the room's top rhythm
 * was `space.gap` on six of them and `space.rest` on the rest. Nobody chose
 * those differences; they accumulated. §22.2 — one implementation of
 * anything, and a title that is 30 in one room and 28 in the next is a scale
 * nobody tuned.
 *
 * ── AND WHY IT OWNS THE WAY BACK ─────────────────────────────────────────
 * The product had THREE back idioms and five screens with none:
 *
 *   · a `quiet` Action at the very bottom of the page — the studio's scope,
 *     the approval, manage-a-booking, the live visit. A control you reach by
 *     scrolling past everything is not an escape route, it is a footer.
 *   · a `quiet` Button at the top of `/cars/<id>`, set flush with no glyph, so
 *     it read as a caption rather than as a control. This is the one the owner
 *     reported as "no obvious way back".
 *   · nothing at all on `/history`, `/history/<id>`, `/vehicle`,
 *     `/booking/<id>` and `/dashboard/sell-car`.
 *
 * `/cars` and `/dashboard/sell-car` carry no dock either — deliberately, they
 * are public — so those two were closed rooms with no exit of any kind.
 *
 * The back affordance is therefore part of the header rather than a thing each
 * screen remembers to add: it is at the top, it is the same shape in every
 * room, it NAMES where it goes (§21.8 — the customer's word, never "Back"),
 * and it is a link to a deterministic parent rather than `history.back()`.
 * See `parentOf` for why that distinction matters to a notification.
 */
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { color, space, TARGET_MIN, MEASURE } from '@/design';
import { parentOf, type Parent } from '@/navigation/resolve';
import { Statement } from './parts';

/**
 * THE ONE BACK CONTROL.
 *
 * A chevron and the parent's name. The whole row is the target and it clears
 * §21.3's 44px on its own, so the glyph can stay the size the design draws it
 * without the tap area following it down.
 */
export function Back(
  { parent, over = false, style }:
  {
    /**
     * WHERE IT GOES, when the screen knows better than the address does.
     *
     * Omit it and the control asks the route table about the address it is
     * standing at — which is the normal case and the reason a renderer never
     * has to name a route (ARCHITECTURE §1: renderers draw, they do not build
     * addresses). Pass it only where the MODEL holds a truer answer than the
     * path: an approval knows its own visit, a listing knows the filtered
     * list the customer arrived through, and nothing in `/approval/<id>`
     * does. Those hrefs come from the projection, as every href does.
     */
    parent?: Parent;
    /**
     * The room opens on a full-bleed photograph, so the control sits ON it.
     * Placing it above instead would push the photograph down the screen, and
     * §11.2 makes the photograph the largest element — a back button is not
     * allowed to cost it that. `over` ink plus its own scrim, because §21.1
     * solves for the WORST image and a photograph can be white.
     */
    over?: boolean;
    style?: CSSProperties;
  },
) {
  const here = usePathname() ?? '';
  const to = parent ?? parentOf(here);
  /* A root room has no parent and must not grow one (§6.2). Drawing nothing
     is the answer, so a screen can place `<Back />` unconditionally. */
  if (!to) return null;

  return (
    <Link
      href={to.href}
      className="am-tap"
      /* §21.6 — the accessible name says where, because "back" read out of
         context tells a screen-reader user nothing about where they land. */
      aria-label={`Back to ${to.name}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space.breath,
        minHeight: TARGET_MIN,
        /* Pulled left by its own optical inset so the glyph — not the padding
           — lines up with the gutter every other element sits on. */
        marginLeft: over ? 0 : -space.breath,
        paddingInline: over ? space.line : space.breath,
        textDecoration: 'none',
        color: over ? color.over : color.ink2,
        alignSelf: 'flex-start',
        ...(over ? {
          borderRadius: 999,
          background: 'rgba(8,9,10,0.55)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } : null),
        ...style,
      }}
    >
      <svg
        width={17} height={17} viewBox="0 0 24 24" aria-hidden
        fill="none" stroke="currentColor" strokeWidth={1.4}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {/* A PARENT'S NAME IS ONE LINE. Wrapped, the chevron centres itself
          against the block and the control stops reading as a control — seen
          on the harness with a deliberately long name. Every real parent is
          two or three words; this is the guard, not the expectation. */}
      <span
        style={{
          fontSize: 14, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60vw',
        }}
      >
        {to.name}
      </span>
    </Link>
  );
}

export interface RoomHeaderProps {
  /** Where this room sits under. Absent on the five dock slots, by rule. */
  parent?: Parent | null;
  /** The label above the title — the situation the title belongs to. */
  eyebrow?: ReactNode;
  /** Amber on the eyebrow: the studio is doing something right now (§3.3). */
  lit?: boolean;
  /** The one Display on the screen (§9.5). */
  children: ReactNode;
  /**
   * The sentence under it. Held here rather than left to each screen so the
   * gap above it, its size and its measure are the same in every room.
   */
  supporting?: ReactNode;
  /**
   * A control on the title's own line — the Desk on Home, and nothing else so
   * far. §6.3 keeps the COMMITTING control elsewhere; this is for a control
   * that only opens something.
   */
  action?: ReactNode;
  /** `h2` where the page's `h1` is elsewhere — §21.6 is the page's to decide. */
  as?: 'h1' | 'h2';
  /**
   * The Display's size. Named steps rather than numbers, because the three
   * that existed were an accident and a fourth would be too.
   *
   *   `room`    30 — a room's own name
   *   `subject` 26 — a room about ONE thing that is already named above it
   */
  scale?: 'room' | 'subject';
  style?: CSSProperties;
}

const SIZE = { room: 30, subject: 26 } as const;

export function RoomHeader({
  parent, eyebrow, lit = false, children, supporting, action,
  as = 'h1', scale = 'room', style,
}: RoomHeaderProps) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {/* ALWAYS PLACED, NEVER CONDITIONAL. `Back` returns nothing at a root
          room because `parentOf` has no answer there, so a header does not
          have to know which kind of room it is in — and a child room cannot
          lose its only exit by forgetting to pass a prop. That is exactly the
          bug this replaced: `Booked` composed the header without a `parent`,
          relying on the control to locate itself, and the header quietly drew
          nothing at all. */}
      <Back parent={parent ?? undefined} style={{ marginBottom: space.breath }} />

      <div
        style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: space.gap,
        }}
      >
        <Statement eyebrow={eyebrow} lit={lit} as={as} size={SIZE[scale]}>
          {children}
        </Statement>
        {action}
      </div>

      {supporting ? (
        <p
          style={{
            marginTop: space.line, marginBottom: 0,
            fontSize: 15, lineHeight: 1.6, color: color.ink2, maxWidth: MEASURE,
          }}
        >
          {supporting}
        </p>
      ) : null}
    </header>
  );
}
