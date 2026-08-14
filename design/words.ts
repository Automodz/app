/**
 * HOW THE PRODUCT JOINS TWO FACTS INTO ONE LINE.
 *
 * Source: docs/AUTOMODZ-OS.md §8.6, §21.1
 *
 * IN `design/`, NOT IN `lib/os/`. Where a line may break is a typographic
 * rule, not an engine one - and the renderers need it, which the architecture
 * suite settled by refusing them any import from the engine at all (§1). Both
 * a projection and a screen may reach the design layer.
 *
 * Thirteen places composed `A · B` with a plain `' · '`, and not one of them
 * could survive a long car name. Seen at 390px on three screens at once:
 *
 *   Now          BMW M340i xDrive Sport ·
 *                GJ01AB1234
 *   the visit    BMW M340I XDRIVE SPORT ·
 *                IN THE STUDIO
 *   settling     BMW M340I XDRIVE SPORT ·
 *                CLOSED
 *
 * A separator stranded at the end of a line reads as an unfinished sentence -
 * the eye stops, looks for the missing word, and only then finds it below. It
 * is the same defect every time because it is one convention with no
 * implementation: every call site typed the string itself.
 *
 * The fix is where the line breaks, not what size it is. A normal space BEFORE
 * the dot keeps the break opportunity there; a non-breaking space AFTER binds
 * the dot to what follows. So a long line wraps as
 *
 *   BMW M340i xDrive Sport
 *   · GJ01AB1234
 *
 * where the dot leads the continuation instead of trailing a fragment. On any
 * line that fits - which is nearly all of them - nothing changes at all.
 *
 * Falsy parts are dropped, so a caller can hand over an optional fact without
 * guarding it and without producing a line that begins with a separator.
 */

/** The separator itself: break before it, never after it. */
export const DOT = ' · ';

/**
 * Join facts into one line - "BMW M340i · GJ01AB1234", "In the studio · Bay 2".
 *
 * Empty when nothing survives, so `|| undefined` at a call site still works
 * the way it did.
 */
export function dotted(...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(DOT);
}
