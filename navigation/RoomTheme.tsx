'use client';
/**
 * A ROOM IS ALWAYS DARK.
 *
 * Source: docs/AUTOMODZ-OS.md §9.1, §3.4
 *         design/colors.ts - "the application is dark because a car
 *         photographed against black reads as a car in a studio"
 *         app/layout.tsx - "the customer product is always-dark"
 *
 * ── WHAT WENT WRONG ──────────────────────────────────────────────────────
 * The light theme exists for the PUBLIC surfaces - the landing page, the
 * legal pages, an invoice that will be printed. It has never been for the
 * customer application, and the customer application is built on the
 * assumption that it never would be: every room writes its ink from
 * `design/colors.ts`, which is one palette, and that palette is the dark one.
 * `#EDEBE7` primary text is 16.74:1 on `#08090A` paper and about 1.1:1 on a
 * white pane.
 *
 * So a customer whose browser had ever stored `theme: 'light'` - from the
 * marketing site, from an invoice, from a toggle pressed once a year ago -
 * got a room drawn in daylight with dark-room ink. Reported from production
 * on Safari/iPhone: the ground was cream, "Follow the visit" was white on
 * white, the studio's address and every quiet line under it were gone, and
 * the four rooms the customer was not standing in had invisible names in the
 * dock. Nothing was overlapping there; the words were simply not there.
 *
 * The stored preference is not wrong and is not discarded - it is still what
 * the landing page, the legal pages and an invoice honour. It just does not
 * reach inside a room.
 *
 * ── WHY HERE ─────────────────────────────────────────────────────────────
 * `CustomerChrome` is already the ONE place that decides whether an address
 * is a room (see that file). Deciding it a second time - in the pre-paint
 * script, from a copy of the route table - is the duplication §22.2 exists to
 * prevent, and a copied route table is the kind that goes stale in silence.
 *
 * ── WHY BOTH A SCRIPT AND AN EFFECT ──────────────────────────────────────
 * The script is for the FIRST paint. It is rendered inside the room branch,
 * so it is in the HTML the server sent and runs while the parser is still
 * above the room - before anything is drawn, which is the whole point. An
 * effect alone would flash a light-themed room for one frame on every cold
 * load, which on a slow phone is worse than the bug.
 *
 * The effect is for every navigation AFTER that, when React inserts the
 * markup rather than the parser executing it, and it is also what gives the
 * customer their own preference back when they leave the rooms.
 */
import { useEffect } from 'react';

const DARK = 'dark';
const LIGHT = 'light';

/**
 * The customer's own preference, from the two places the product has ever
 * stored it. Dark when there is none, when it cannot be parsed, or when the
 * browser refuses storage - the same default the pre-paint script in
 * `app/layout.tsx` takes, for the same reason.
 */
function storedTheme(): string {
  try {
    const session = window.localStorage.getItem('automodz-session');
    if (session) {
      const parsed = JSON.parse(session) as { ui?: { theme?: string } };
      if (parsed?.ui?.theme) return parsed.ui.theme;
    }
    const legacy = window.localStorage.getItem('automodz-v5');
    if (legacy) {
      const parsed = JSON.parse(legacy) as { state?: { theme?: string } };
      if (parsed?.state?.theme) return parsed.state.theme;
    }
  } catch { /* storage refused, or a payload from an older shape */ }
  return DARK;
}

/** One implementation of "wear this theme", used by the effect both ways. */
function wear(theme: string) {
  const root = document.documentElement;
  const light = theme === LIGHT;
  root.classList.remove(light ? DARK : LIGHT);
  root.classList.add(light ? LIGHT : DARK);
  root.setAttribute('data-theme', light ? LIGHT : DARK);
}

/* The same three lines, inlined for the parser. Kept literal rather than
   generated from `wear` so that what runs before first paint is readable in
   the HTML - this is the one script on the page that must not depend on a
   bundle having arrived. */
const APPLY_DARK = "(function(){try{var r=document.documentElement;"
  + "r.classList.remove('light');r.classList.add('dark');"
  + "r.setAttribute('data-theme','dark');}catch(e){}})()";

/**
 * Renders nothing but the pre-paint script. Mounted only inside a room, so its
 * PRESENCE is the decision - there is no second test of the pathname here.
 */
export function RoomTheme() {
  useEffect(() => {
    wear(DARK);
    /* Leaving the rooms hands the preference back. Read from storage rather
       than remembered from before, because what was on the element a moment
       ago may be a value this component itself wrote. */
    return () => wear(storedTheme());
  }, []);

  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: APPLY_DARK }} />;
}
