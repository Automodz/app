'use client';
/**
 * ICON BUTTON
 *
 * Source: docs/AUTOMODZ-OS.md §21.3, §21.6, §21.8, §10.5
 * Design language: design/icons.ts rules 1, 3, 5, 6
 *
 * §21.3 is the reason this component exists separately from Button: "Visual
 * size may be smaller; the touch area may not." A 20px glyph inside a 44pt
 * target is the single most common way an interface satisfies the eye and
 * fails the thumb. The padding is computed from the token, so the target is
 * arithmetic rather than an inline guess.
 *
 * §21.6 - an icon-only control carries no visible text, so `label` is a
 * REQUIRED prop, not an optional nicety. §21.8 constrains what it may say:
 * the customer's word, never the internal one.
 *
 * design/icons.ts rule 3 - no container. The glyph sits on the surface it
 * belongs to; there is no circular badge or tinted chip behind it.
 */
import type { CSSProperties, ReactNode } from 'react';
import { radius, duration, easing, iconPadding, ICON_TARGET } from '@/design';
import type { IconSize } from '@/design';
import { toneColor, type Tone } from './tone';

export interface IconButtonProps {
  /**
   * §21.6 - required. The accessible name, in the customer's language (§21.8).
   * There is no way to render this control without one.
   */
  label: string;
  /** The glyph. */
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  size?: IconSize;
  tone?: Tone;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function IconButton({
  label,
  children,
  onClick,
  href,
  size = 'control',
  tone = 'ink',
  disabled = false,
  className,
  style,
}: IconButtonProps) {
  if (process.env.NODE_ENV !== 'production' && !onClick && !href) {
    console.error(`[IconButton "${label}"] has no onClick or href - nothing is inert (§10.5).`);
  }

  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    /* §21.3 - the floor, whatever the glyph does. */
    minWidth: ICON_TARGET,
    minHeight: ICON_TARGET,
    padding: iconPadding[size],
    border: 0,
    background: 'transparent',
    borderRadius: radius.pill,
    color: toneColor(tone),
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: `opacity ${duration.tick}ms ${easing.ease}`,
    ...style,
  };

  if (href && !disabled) {
    return (
      <a className={className} href={href} aria-label={label} style={base}>
        {children}
      </a>
    );
  }

  return (
    <button
      className={className}
      type="button"
      aria-label={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={base}
    >
      {children}
    </button>
  );
}
