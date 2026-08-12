'use client';
/**
 * THE SMALL PARTS the design repeats on every screen.
 *
 * Source: docs/AUTOMODZ-OS.md §3.5, §9.5, §14.4, §17.1, §21.3, §21.6, §22.2
 *         design "AutoModz App.dc.html"
 *
 * Each of these appears five or more times across the twelve screens. §22.2 -
 * one implementation of anything; the reason they are here rather than copied
 * into each room is that a whisper that is 10px in one room and 9.5px in the
 * next is a whisper nobody tuned.
 */
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { color, space, radius, TARGET_MIN, type as typeScale } from '@/design';

/* ── THE LABEL ───────────────────────────────────────────────────────────
   Mono, uppercase, widely tracked. Every piece of metadata in the design is
   set this way. `lit` is amber and reserved for the label that names what is
   happening right now ("IN THE STUDIO", "VISIT 14 · BAY 02"). */
export function Label(
  { children, lit = false, style }:
  { children: ReactNode; lit?: boolean; style?: CSSProperties },
) {
  return (
    <span
      className={`am-label${lit ? ' am-label-lit' : ''}`}
      style={{ letterSpacing: '0.3em', ...style }}
    >
      {children}
    </span>
  );
}

/* ── THE STATEMENT ───────────────────────────────────────────────────────
   §9.5 - one Display per screen, and it always arrives the same way: a label
   above it naming the situation, then the sentence itself in Outfit 200.

   The heading level is a prop rather than fixed, because §21.6's heading order
   is a property of the PAGE and only the page knows whether this is its h1. */
/**
 * THE TWO DISPLAY STEPS, named.
 *
 * `room` is the design's own token. `nested` is for a Display that sits under
 * another room's title - the Studio's sheet inside the Studio - and it is a
 * step, not a number somebody picked.
 */
export const DISPLAY = {
  room: typeScale.display.size,
  nested: 'clamp(24px, 6.6vw, 34px)',
} as const;

export function Statement(
  { eyebrow, lit = false, children, as: Tag = 'h1', size, style }:
  {
    eyebrow?: ReactNode;
    lit?: boolean;
    children: ReactNode;
    as?: 'h1' | 'h2';
    /**
     * ONE DISPLAY STEP, AND IT IS THE DESIGN'S OWN.
     *
     * This was `size = 30` - a number, fixed at every width - while the other
     * half of the product set the same headline through `Heading level="display"`,
     * which is `clamp(30px, 8.6vw, 46px)` from `design/typography.ts`. The two
     * are the same face at the same weight, so on a phone they were within two
     * pixels of each other and nobody noticed. On a laptop one was 30 and the
     * other 46, and the product visibly came from two eras.
     *
     * The token wins, because the token is what the design specifies and the
     * `30` was a hard-coded copy of its lower bound. Absent means the step;
     * a number is still accepted for the one place that legitimately steps
     * down - a Display nested under another room's title.
     */
    size?: number | string;
    style?: CSSProperties;
  },
) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {eyebrow ? <Label lit={lit}>{eyebrow}</Label> : null}
      <Tag
        className="am-display"
        style={{ fontSize: size ?? typeScale.display.size, margin: 0, lineHeight: 1.18 }}
      >
        {children}
      </Tag>
    </div>
  );
}

/* ── THE RAIL ────────────────────────────────────────────────────────────
   A section's name, preceded by a short rule. Used where a screen changes
   subject mid-scroll - "History" under the collection, "The rest of the
   rooms" in the design's own canvas. */
export function Rail({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.line }}>
      <span
        aria-hidden
        style={{ width: 44, height: 1, background: 'rgba(232,217,190,0.5)' }}
      />
      <Label style={{ letterSpacing: '0.28em' }}>{children}</Label>
    </div>
  );
}

/* ── THE PULSE ───────────────────────────────────────────────────────────
   §17.1 - "state changes surface as state." One breathing point of amber,
   which is the entire vocabulary the product has for "this is happening now".
   It is never a count and never a badge. */
export function Pulse({ size = 9 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="am-breathe"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color.amber,
        boxShadow: `0 0 ${size * 1.6}px ${size / 3}px rgba(224,164,92,0.6)`,
        flexShrink: 0,
      }}
    />
  );
}

/* ── THE CHEVRON ─────────────────────────────────────────────────────────
   The one "there is more this way" mark in the product. */
export function Chevron({ size = 17, tone = color.ink3 }: { size?: number; tone?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden
      fill="none" stroke={tone} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/* ── THE METER ───────────────────────────────────────────────────────────
   §14.2 - protection as a proportion of its term. A 2px bar, because the
   number beside it is the fact and the bar is only its shape.

   §14.4 - the tone is the term's, not the meter's: champagne for a thing in
   force, amber for a thing due, neutral for a thing with years left. */
export function Meter(
  { label, value, fill, tone = color.champagne }:
  { label: ReactNode; value: ReactNode; fill: number; tone?: string },
) {
  const pct = Math.max(0, Math.min(1, fill)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
          gap: space.line, fontSize: 13.5,
        }}
      >
        <span style={{ color: color.ink }}>{label}</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)', color: tone,
            marginLeft: 'auto', textAlign: 'right', overflowWrap: 'break-word',
          }}
        >
          {value}
        </span>
      </div>
      <div
        aria-hidden
        style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}
      >
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: tone }} />
      </div>
    </div>
  );
}

/* ── THE ROW ─────────────────────────────────────────────────────────────
   A line in a settings list or a record: a name, an optional value, and a
   hairline under it. A whole row is the target, never the chevron (§21.3). */
export function Row(
  { children, value, href, onClick, last = false, quiet = false }:
  {
    children: ReactNode;
    value?: ReactNode;
    href?: string;
    onClick?: () => void;
    last?: boolean;
    quiet?: boolean;
  },
) {
  const inner = (
    <>
      <span style={{ fontSize: 14.5, color: quiet ? color.ink2 : color.ink }}>{children}</span>
      {value ?? (href || onClick ? <Chevron size={16} tone="rgba(237,235,231,0.4)" /> : null)}
    </>
  );

  const style: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    /* So a value too long to sit beside its label drops below it instead of
       crushing it. See `Value`. */
    flexWrap: 'wrap',
    gap: space.line,
    minHeight: TARGET_MIN,
    padding: `${space.line}px ${space.hair}px`,
    borderBottom: last ? undefined : '1px solid rgba(255,255,255,0.06)',
    textDecoration: 'none',
    color: 'inherit',
    width: '100%',
    background: 'none',
    border: 'none',
    borderRadius: 0,
    textAlign: 'left',
    font: 'inherit',
    cursor: href || onClick ? 'pointer' : undefined,
  };

  if (href) return <Link href={href} className="am-tap" style={style}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="am-tap" style={{ ...style, borderBottom: style.borderBottom }}>{inner}</button>;
  return <div style={style}>{inner}</div>;
}

/** The mono value on the right of a Row. Champagne when it is a fact in force. */
export function Value({ children, tone = color.champagne }: { children: ReactNode; tone?: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)', fontSize: 12, color: tone,
        /* NOT `flexShrink: 0`. A value that refuses to yield takes the whole
           row, and the label beside it - which has `minWidth: 0` so the row can
           ever wrap at all - collapses to nothing and breaks ONE WORD PER LINE:

               Work        Full-body paint protection film
               BMW
               M340i
               xDrive
               Sport

           seen on the booking at 390px with a real service name. The value now
           yields and, when it cannot fit beside the label, takes its own line
           under it - which is the same shape the row already has for a wrapped
           label, and preserves the hierarchy rather than shrinking the type. */
        textAlign: 'right', marginLeft: 'auto', overflowWrap: 'break-word',
      }}
    >
      {children}
    </span>
  );
}

/* ── THE ACTION ──────────────────────────────────────────────────────────
   §6.3, §3.3 - the one control on a screen that commits to something. It is
   the only element in the product filled with light rather than lit by it,
   which is what makes it unmistakable without a second colour existing.

   `quiet` is its opposite number: a real control, glass, no fill. Used where
   a screen offers two things and neither is the commitment (the visit's "see
   today's photos" / "message the studio"). */
export function Action(
  { children, href, onClick, quiet = false, tone = 'amber', style, disabled = false, download = false, ...rest }:
  {
    children: ReactNode;
    href?: string;
    onClick?: () => void;
    quiet?: boolean;
    tone?: 'amber' | 'champagne';
    style?: CSSProperties;
    /**
     * A control that is momentarily unusable - a move with no date chosen yet,
     * a request already in flight. NOT a permanently dead control: §10.5 says
     * a screen must explain rather than disable, and every caller here pairs a
     * disabled state with a sentence saying what would enable it.
     */
    disabled?: boolean;
    /**
     * The href is a FILE, not a place. Without this the browser navigates to
     * the calendar route and tries to render `text/calendar` as a page.
     */
    download?: boolean;
    'aria-label'?: string;
  },
) {
  const base: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TARGET_MIN,
    padding: `${space.gap}px ${space.gap + space.hair}px`,
    borderRadius: radius.pane + 2,
    fontSize: 15.5,
    letterSpacing: '0.02em',
    textAlign: 'center',
    textDecoration: 'none',
    border: quiet ? '1px solid rgba(255,255,255,0.08)' : 'none',
    /* OPAQUE STOPS, NOT ALPHA. The design draws these as amber and champagne
       at 92%→64% alpha over the room, and at the weak end that composites to
       #926C3E - 4.12:1 against the label, under §21.1's floor. Solid stops
       down the same ramps look the same and hold their contrast wherever the
       control lands: amber 10.10:1 → 7.21:1, champagne 14.02:1 → 8.94:1. */
    background: quiet
      ? 'rgba(255,255,255,0.05)'
      : tone === 'amber'
        ? 'linear-gradient(160deg, #E8B072, #D0904A)'
        : 'linear-gradient(160deg, #E8D9BE, #E0A45C)',
    color: quiet ? color.ink : '#100C06',
    boxShadow: quiet
      ? undefined
      : `0 24px 50px -22px rgba(224,164,92,0.8), inset 0 1px 0 rgba(255,255,255,0.4)`,
    width: '100%',
    font: 'inherit',
    fontWeight: 400,
    /* Dimmed rather than redrawn: it is the SAME control, momentarily not
       ready, and a control that changes shape when it becomes usable is a
       different control appearing. */
    opacity: disabled ? 0.45 : undefined,
    cursor: disabled ? 'default' : 'pointer',
    ...style,
  };

  if (href) {
    return (
      <Link
        href={href}
        className="am-tap"
        style={base}
        /* `download` on a Next.js Link is passed through to the anchor; a
           calendar file must be handed to the calendar, not navigated to. */
        {...(download ? { download: true } : {})}
        {...rest}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className="am-tap"
      style={base}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── THE STAT ────────────────────────────────────────────────────────────
   A small pane holding one number and its name. The design pairs them two to
   a row; nothing here decides that, so a screen can place three. */
export function Stat(
  { label, children, foot }:
  { label: ReactNode; children: ReactNode; foot?: ReactNode },
) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.breath + 2 }}>
      <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>{label}</Label>
      <span className="am-display" style={{ fontSize: 28, lineHeight: 1 }}>{children}</span>
      {foot}
    </div>
  );
}
