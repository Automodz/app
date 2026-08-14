'use client';
/**
 * THE PANE - the one raised material.
 *
 * Source: docs/AUTOMODZ-OS.md §3.4, §3.6, §10.2
 *         design "AutoModz App.dc.html" - every card on all twelve screens
 *
 * §10.2 - "not a card and a panel and a tile - one." The design draws exactly
 * one surface and then tints it three ways, and the tint is never decoration:
 *
 *   plain  - a fact. Most panes.
 *   warm   - the one thing on this screen that is ASKING for something: the
 *            service being recommended, the visit being confirmed.
 *   cool   - something already in force and requiring nothing: a membership
 *            benefit, a coat still holding.
 *
 * At most one warm pane per screen. Two things asking at once is a screen with
 * no subject (§3.2), and the design never draws it.
 *
 * `live` adds the slow band of light that crosses the surface. It belongs to
 * the pane that carries work happening RIGHT NOW and to no other - it is the
 * only thing on a still screen that says the studio is working.
 */
import type { CSSProperties, ReactNode, ElementType } from 'react';
import { radius } from '@/design';

export type PaneTone = 'plain' | 'warm' | 'cool' | 'lit';

const TONE: Record<PaneTone, string> = {
  plain: 'am-glass',
  lit: 'am-glass am-glass-lit',
  warm: 'am-glass am-glass-warm',
  cool: 'am-glass am-glass-cool',
};

export interface PaneProps {
  children: ReactNode;
  tone?: PaneTone;
  /** The slow sweep of light. One pane per screen, and only for live work. */
  live?: boolean;
  /** Corner. `radius.pane` unless a larger surface asks for `radius.sheet`. */
  round?: number;
  /**
   * What the pane actually IS - a div, a `Link`, a `button`. The design draws
   * the same surface whether or not it is pressable, so the material is a
   * prop of the element rather than a wrapper around it: a `<div>` inside an
   * `<a>` for every tappable card would double the DOM and, more to the
   * point, would put a non-interactive element between the finger and the
   * control for anything reading the tree.
   */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /* Whatever the chosen element needs - `href` for a Link, `onClick` for a
     button. Deliberately loose: `as` makes the valid set depend on a value,
     which the type system cannot narrow here without a generic that every
     call site would then have to spell out. */
  [key: string]: unknown;
}

export function Pane({
  children, tone = 'plain', live = false, round = radius.pane,
  as: Tag = 'div', className = '', style, ...rest
}: PaneProps) {
  return (
    <Tag
      className={`${TONE[tone]}${live ? ' am-sweep' : ''}${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        borderRadius: round,
        ...style,
      }}
      {...rest}
    >
      {/* The sweep is painted by `.am-sweep::after`, which is clipped by this
          element's own overflow - so the content sits above it without either
          one having to declare a z-index. */}
      {children}
    </Tag>
  );
}
