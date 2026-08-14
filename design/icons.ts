/**
 * ICONS - AutoModz Design Language
 *
 * Source: docs/AUTOMODZ-OS.md §3.3, §3.4, §3.5, §10.1, §21.3, §21.6, §5.5
 *
 * ── A NOTE ON PROVENANCE ────────────────────────────────────────────────
 * The constitution does not discuss iconography anywhere. Rather than invent
 * a philosophy, every rule below is deduced from a principle it does state.
 * Each is marked with the section it comes from; nothing here is free
 * invention, and if one of those sections changes, the rule changes with it.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * THE RULES
 *
 * 1. An icon inherits ink. (§3.3 - "colour is information, never decoration".)
 *    An icon may take a state colour when it *is* the state - a protection
 *    that needs attention. It may never be coloured to look interesting.
 *
 * 2. Stroked, not filled. (§3.4 - "light is the only ornament".) A filled
 *    glyph is a shape competing with the photograph; an outline is a label.
 *
 * 3. No icon has a container. (§3.4, §3.6.) No circular badge, no tinted
 *    chip behind a glyph. The icon sits on the surface it belongs to.
 *
 * 4. Three sizes, no more. (§10.1 - "a small vocabulary, used exactly".)
 *
 * 5. The glyph is not the target. (§21.3.) Visual size may be 16px; the
 *    touch area is always at least 44. This is the most common way an
 *    interface fails §21.3 while looking correct.
 *
 * 6. An icon-only control must carry an accessible name. (§21.6.) And that
 *    name is the customer's word, never the internal one (§5.5, §21.8) -
 *    "Your car", not "vehicleId".
 *
 * 7. An icon never replaces a word the customer needs. (§3.5, §4.5.) Where a
 *    word is clearer, the word wins; where both are needed, the word leads
 *    and the icon supports. Decorative icons are marked decorative and left
 *    silent to assistive technology (§21.6).
 *
 * 8. No icon for a document. (§2.3 - "states, never documents".) A file
 *    behind a state is reached by a labelled action, not by a paperclip.
 */
import { space } from './spacing';
import { TARGET_MIN } from './grid';

/**
 * Three sizes, derived from the type they accompany so a glyph optically
 * matches its neighbouring text rather than floating at its own scale.
 *
 *   inline  16  sits beside Body (17) and Data (14)
 *   control 20  the default for an action
 *   nav     24  primary navigation, where the glyph carries more weight
 */
export const iconSize = {
  inline: 16,
  control: 20,
  nav: 24,
} as const;

/**
 * Stroke weight. Derived to hold at the smallest size: below ~1.5 a 16px
 * outline thins to near-invisibility against paper, and above ~2 it reads as
 * filled, which rule 2 forbids.
 */
export const STROKE = 1.5;

/**
 * §21.3 - restated here because the icon is where it is most often missed.
 * Any icon-only control reserves this much touch area regardless of glyph.
 */
export const ICON_TARGET = TARGET_MIN;

/**
 * The padding that turns a glyph into a compliant target, per size.
 * Held as data so the arithmetic is checkable rather than eyeballed.
 */
export const iconPadding = {
  inline: (TARGET_MIN - iconSize.inline) / 2, // 14
  control: (TARGET_MIN - iconSize.control) / 2, // 12
  nav: (TARGET_MIN - iconSize.nav) / 2, // 10
} as const;

export type IconSize = keyof typeof iconSize;
