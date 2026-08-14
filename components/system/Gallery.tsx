'use client';
/**
 * GALLERY - a grid of media.
 *
 * Source: docs/AUTOMODZ-OS.md §8.4, §8.6, §10.3, §18.1, §21.3, §21.6
 *
 * §10.3 - composition over configuration. This component does not accept a
 * list of image URLs and render them; it renders whatever tiles it is given as
 * children. That is what keeps it ignorant of what media is, where it comes
 * from and what opening one means.
 *
 * §8.6 - "a photograph opened" deserves a full screen. This grid therefore
 * does NOT contain a viewer: opening is the caller's business, composed from
 * `Modal`. Building the viewer in would make this component know what a tile
 * means, which it must not.
 *
 * §18.1 - a gallery with nothing in it renders nothing. Absence is silence,
 * never an empty grid with a dashed box in it (§18.2).
 *
 * §21.3 - a tappable tile is an interactive element, so the minimum tile edge
 * is the target floor.
 */
import type { CSSProperties, ReactNode } from 'react';
import { space, TARGET_MIN } from '@/design';

export interface GalleryProps {
  /** The tiles. Each is whatever the caller composes (§10.3). */
  children?: ReactNode;
  /** Minimum tile width; the grid fits as many as will hold that. */
  min?: number;
  /** Gap between tiles, from the rhythm scale (§8.3). */
  gutter?: keyof typeof space;
  className?: string;
  style?: CSSProperties;
}

export function Gallery({
  children,
  min = 96,
  gutter = 'breath',
  className,
  style,
}: GalleryProps) {
  /* §18.1 - nothing renders as nothing. */
  const empty = children == null
    || (Array.isArray(children) && children.filter(Boolean).length === 0);
  if (empty) return null;

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(min, TARGET_MIN)}px, 1fr))`,
        gap: space[gutter],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
