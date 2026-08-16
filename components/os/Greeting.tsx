'use client';
/**
 * THE ROOM GREETS ITS OWNER.
 *
 * Source: docs/AUTOMODZ-OS.md §2.2, §9.5, §21.7
 *
 * ── WHY IT IS A CLIENT COMPONENT, AND WHY IT IS THE ONLY ONE ─────────────
 * "Good evening" is a fact about the READER's clock, and the server does not
 * have it. Rendering it on the server would state Ahmedabad's hour to somebody
 * reading in another one, and would differ from the value React hydrates with -
 * the same trap `LandingScreen` already documents for its open/closed pill.
 *
 * So the hour is read after mount. That is a beat late by definition, and the
 * NAME is not: the name comes from the server and is painted immediately, with
 * only the time-of-day word arriving with the second frame. A customer sees
 * their own name at once and the greeting completes around it, rather than the
 * whole line popping in.
 *
 * `HomeScreen` is a server component and must stay one - it is the room opened
 * most often, and it ships no JavaScript of its own. This island is the reason
 * that is still true: three lines of state, and nothing else crosses.
 *
 * ── §2.2 PERMITS THIS ────────────────────────────────────────────────────
 * "No individual is ever named on any customer surface" is about the STUDIO's
 * people - so that confidence attaches to the place rather than to a technician.
 * The customer is not one of the studio's individuals, and their own name on
 * their own screen names nobody but themselves. `YouScreen` makes the same
 * argument at length for the monogram.
 */
import { useEffect, useState } from 'react';
import { color, space, TARGET_MIN, type as typeScale } from '@/design';

/**
 * The studio's own hours are 9 to 21 (`LandingScreen`), and these boundaries
 * are the ordinary English ones rather than anything the business defines.
 */
const wordFor = (hour: number): string =>
  hour < 5 ? 'Good evening'
    : hour < 12 ? 'Good morning'
      : hour < 17 ? 'Good afternoon'
        : 'Good evening';

export function Greeting({ name }: { name: string }) {
  /* Absent until the clock is known. The NAME is not waiting on it. */
  const [word, setWord] = useState<string | null>(null);
  useEffect(() => { setWord(wordFor(new Date().getHours())); }, []);

  return (
    <p
      style={{
        /* PARALLEL WITH THE MENU, NOT UNDER IT.
           The greeting and the menu button are the room's top line, so they
           share its height exactly - `TARGET_MIN`, the same 44 the button is -
           and the room's own top padding is set to the button's offset so the
           two sit on one axis. The right padding is the button's width plus
           the gutter, so a long name wraps rather than sliding beneath it. */
        margin: 0,
        minHeight: TARGET_MIN,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        /* THE SPACE BETWEEN THE GREETING AND THE NAME.
           It was a `{' '}` at the end of the first span, and a flex item's
           trailing whitespace is trimmed - so every customer has been greeted
           "Good afternoon,Meet" since the day this became a flex row. A gap is
           the flex container's own way of saying it, and in `em` so it stays a
           word space at every step of the fluid Display clamp. */
        columnGap: '0.26em',
        paddingInlineEnd: TARGET_MIN + space.line,
        /* THE DISPLAY STEP, LIKE EVERY OTHER ROOM'S FIRST LINE.
           This was the Title step (22px) while the Studio, the Garage and the
           Club all open on a Display - so the one room a customer opens daily
           opened smaller than the rest of the product, and moving between them
           read as moving between two applications. §9.5's "one Display per
           screen" is unbroken: Home's h1 is the state's word, said for a
           screen reader and drawn by the ring (see `HomeScreen`), and this is
           the greeting rather than a second statement of it. */
        fontFamily: typeScale.display.family,
        fontSize: typeScale.display.size,
        fontWeight: typeScale.display.weight,
        letterSpacing: typeScale.display.letterSpacing,
        lineHeight: 1.15,
        color: color.ink2,
      }}
    >
      {/* The comma belongs to the greeting, so it arrives with it - a stray
          comma in front of a name is worse than a name on its own. */}
      <span
        style={{
          opacity: word ? 1 : 0,
          transition: 'opacity 240ms ease',
        }}
      >
        {word ?? 'Good evening'},
      </span>
      <span style={{ color: color.ink }}>{name}</span>
    </p>
  );
}
