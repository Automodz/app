'use client';
/**
 * BUTTON
 *
 * Source: docs/AUTOMODZ-OS.md §10.4, §10.5, §19.3, §21.3, §21.5, §4.6
 *
 * §10.4 gives the three tiers and they are the only variants offered:
 *
 *   primary  "the thing this screen exists to let you do" — at most one
 *   forward  "go deeper, read more"
 *   quiet    "dismiss, cancel, secondary paths"
 *
 * §21.3 — the target is at least 44pt. That is a floor on the touch area, not
 * on the visual, so the height is set here and cannot be overridden away.
 *
 * §19.3 — "A spinner is permitted only inside a control the customer just
 * pressed, to confirm the press was received. Nowhere else." This is that one
 * place. The spinner is not exported and cannot be used anywhere else.
 *
 * §10.5 — "Nothing is inert." A button with neither `onClick` nor `href` is a
 * label wearing a control's clothes, so it is refused in development.
 *
 * The companion check — an href equal to the address it sits on — moved OUT of
 * this component and into the projection tests. It needed `usePathname`, which
 * subscribes every button in the tree to every route change, so the most-used
 * control in the product re-rendered on every navigation to run a guard that is
 * compiled out of production anyway. The assertions live in
 * __tests__/customer/project.test.ts, where they fail the build instead of
 * logging at runtime.
 *
 * §6.1 — "Moving from Garage to Vehicle should feel like walking toward
 * something, not like loading a page." An internal href therefore renders
 * `next/link`, not a bare anchor. It used to render `<a>` unconditionally, which
 * made twelve of the product's fifteen navigations full document loads: blank
 * screen, re-parsed bundle, re-run auth, re-run every query.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import {
  color, radius, space, type as typeScale,
  duration, easing, TARGET_MIN, STROKE, fill,
} from '@/design';

/** An href that leaves the application, and so must stay a plain anchor. */
const isExternal = (href: string) =>
  /^(https?:|mailto:|tel:)/.test(href) || href.startsWith('//');

/** §10.4 — the three tiers. */
export type ButtonTier = 'primary' | 'forward' | 'quiet';

export interface ButtonProps {
  tier?: ButtonTier;
  children: ReactNode;
  onClick?: () => void;
  /** Renders an anchor instead of a button. */
  href?: string;
  disabled?: boolean;
  /** §19.3 — the one permitted spinner. Also blocks re-entry while true. */
  loading?: boolean;
  /** Fill the available width. */
  full?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  style?: CSSProperties;
}

const TIER: Record<ButtonTier, CSSProperties> = {
  /**
   * FILLED WITH LIGHT, not inverted with ink.
   *
   * This was `color.ink` on `color.paper` — a white slab, which is what the
   * monochrome product had available. The ratified design makes the one
   * primary action on a screen the only element FILLED with the studio's own
   * light, which is what lets a customer find it without reading: everything
   * else in the room is lit BY that light and nothing else carries it.
   *
   * `#100C06` rather than `color.paper` for the text: near-black with the
   * amber's own warmth in it, so the label reads as ink printed on the
   * control rather than as a hole punched through it.
   *
   * ── THE FILL IS OPAQUE, AND THAT IS A CONTRAST FIX ──
   * The design draws this as amber at 92%→64% ALPHA over the near-black room.
   * Measured, the weak end of that gradient composites to #926C3E, where
   * #100C06 reads at 4.12:1 — under §21.1's 4.5 floor, on the single most
   * important control in the product. Two SOLID stops down the same amber
   * ramp look identical and cannot composite toward the paper:
   *
   *     #E8B072  10.10:1        #D0904A  7.21:1
   *
   * The lesson generalises: a translucent fill over a dark room has no fixed
   * contrast, so it may carry decoration but never text.
   */
  primary: {
    /* THE SAME RAMP `Action` USES, from the one place it is written. Both
       primitives carried their own copy of these three literals — two places
       for the product's single filled control to drift apart (§22.4). */
    background: fill.amber,
    color: fill.on,
    boxShadow: '0 24px 50px -22px rgba(224,164,92,0.8), inset 0 1px 0 rgba(255,255,255,0.4)',
  },
  forward: { background: 'transparent', color: color.amber },
  quiet: { background: 'transparent', color: color.ink2 },
};

/**
 * §19.3 — scoped to this file on purpose, and CSS rather than a motion library:
 * see `.am-press-spinner` in globals.css for why. Reduced motion is handled
 * there too, by a media query rather than a hook.
 */
function PressSpinner() {
  return (
    <span
      aria-hidden
      className="am-press-spinner"
      style={{
        width: typeScale.data.size,
        height: typeScale.data.size,
        borderRadius: radius.pill,
        border: `${STROKE}px solid currentColor`,
        borderTopColor: 'transparent',
        display: 'inline-block',
        opacity: 0.9,
      }}
    />
  );
}

export function Button({
  tier = 'quiet',
  children,
  onClick,
  href,
  disabled = false,
  loading = false,
  full = false,
  type = 'button',
  className,
  style,
}: ButtonProps) {
  if (process.env.NODE_ENV !== 'production' && !onClick && !href && type !== 'submit') {
    // §10.5 — "If there is no destination yet, there is no control yet."
    /* NAMES ITSELF. The bare sentence told you a dead control existed and
       gave you no way to find it — with a dozen of them across seven rooms,
       that is a warning nobody can act on. The label is what a customer reads,
       so it is what identifies the control. */
    console.error(
      `[Button] "${typeof children === 'string' ? children : '(unnamed)'}" has no `
      + 'onClick, href or submit type — nothing is inert (§10.5).',
    );
  }

  const interactive = !(disabled || loading);
  const t = typeScale.body;

  const base = useMemo<CSSProperties>(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.breath,
    minHeight: TARGET_MIN,
    /* Only a filled tier needs inner padding. `forward` and `quiet` are
       transparent — padding them pushes the label in from the gutter, so a
       link under a paragraph reads as indented from the text it follows.
       §8.3's rhythm only holds if type and the controls beneath it share an
       edge. The 44pt target (§21.3) comes from `minHeight`, not from this. */
    paddingInline: tier === 'primary' ? space.gap : 0,
    paddingBlock: space.line,
    width: full ? '100%' : undefined,
    border: 0,
    borderRadius: radius.pill,
    fontFamily: t.family,
    fontSize: t.size,
    fontWeight: t.weight,
    lineHeight: 1,
    letterSpacing: t.letterSpacing,
    cursor: interactive ? 'pointer' : 'default',
    opacity: interactive ? 1 : 0.5,
    textDecoration: 'none',
    /* BOTH properties, because this inline value overrides the stylesheet.
       `.am-tap` declares a transform transition for the press and an inline
       `transition: opacity` silently replaced it — the scale still applied,
       it simply snapped instead of easing. */
    transition: `opacity ${duration.tick}ms ${easing.ease}, `
      + `transform ${duration.tick}ms ${easing.ease}`,
    /* §21.5 — the focus ring is global (app/globals.css). This component used
       to carry its own because the global one failed 1.4.11; it no longer does,
       and a local copy would be a second implementation of the same guarantee. */
    ...TIER[tier],
    ...style,
  }), [tier, full, interactive, style, t]);

    /* TACTILE FEEDBACK. Every control in the product renders through here, and
     none of them acknowledged a press — a tap changed nothing until the
     navigation happened, which is what makes an interface feel dead under a
     finger. `.am-tap` scales by 2% for `duration.tick`, the token §7.3 defines
     for exactly this ("acknowledgement — a press, a toggle").

     CSS rather than framer-motion: a press must respond on the compositor
     within a frame, and a state-driven re-render cannot promise that. */
  const press = interactive ? `am-tap${className ? ` ${className}` : ''}` : className;

  const inner = (
    <>
      {loading ? <PressSpinner /> : null}
      {children}
    </>
  );

  if (href && interactive) {
    /* §6.1 — an internal move is a client transition; only a departure is a
       document load. `rel` is set because a new-tab external link without
       `noopener` hands the opener to the destination. */
    if (isExternal(href)) {
      return (
        <a
          className={press}
          href={href}
          style={base}
          target="_blank"
          rel="noopener noreferrer"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link className={press} href={href} style={base}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      className={press}
      type={type}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-busy={loading || undefined}
      style={base}
    >
      {inner}
    </button>
  );
}
