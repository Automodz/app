'use client';
/**
 * SURFACE - the one raised material.
 *
 * Source: docs/AUTOMODZ-OS.md §10.2, §3.4, §3.6, §9.1, §9.3
 *
 * §10.2: "There is one raised surface in the product. Not a card and a panel
 * and a tile and a well - one. Variation comes from what is inside it, not
 * from a new container."
 *
 * So there is no `variant`. There is one fill (`color.surface`) and a choice
 * of elevation band, and §3.4 says the band is what expresses height: a sheet
 * is not a lighter grey than a card, it simply casts further.
 *
 * §3.6 - "glass never sits on glass; a translucent surface inside another
 * translucent surface reads as a rendering mistake, because it is one." That
 * is enforced here rather than remembered: a Surface rendered inside a Surface
 * drops its own material and becomes a plain container, so composition cannot
 * accidentally produce the mistake. Checklist question 9 asks the same thing
 * at review time; this makes the answer structural.
 */
import { createContext, useContext } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { color, elevation, radius, space, HAIRLINE } from '@/design';
import type { Elevation, Radius } from '@/design';

/** True once we are inside a material. §3.6 */
const InsideSurface = createContext(false);

export interface SurfaceProps {
  /** §9.3 - chosen from the band, never invented. */
  elevation?: Elevation;
  /** §9.4 */
  radius?: Radius;
  /** Inner padding, from the rhythm scale (§8.3). */
  padding?: keyof typeof space | 'none';
  /** §9.1 - the hairline. Off by default: §3.4 raises by light, not by stroke. */
  edge?: boolean;
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Surface({
  elevation: band = 'raised',
  radius: r = 'card',
  padding = 'gap',
  edge = false,
  as,
  children,
  className,
  style,
}: SurfaceProps) {
  const nested = useContext(InsideSurface);
  const Tag = (as ?? 'div') as ElementType;
  const pad = padding === 'none' ? 0 : space[padding];

  /* §3.6 - a nested surface keeps its padding and radius but drops the
     material, so the caller still gets the box they composed without the
     glass-on-glass artefact. */
  const material: CSSProperties = nested
    ? {}
    : {
      background: color.surface,
      boxShadow: elevation[band].shadow,
      ...(edge ? { border: `${HAIRLINE}px solid ${color.edge}` } : {}),
    };

  const node = (
    <Tag
      className={className}
      style={{
        borderRadius: radius[r],
        padding: pad,
        ...material,
        ...style,
      }}
    >
      {children}
    </Tag>
  );

  return nested ? node : (
    <InsideSurface.Provider value>{node}</InsideSurface.Provider>
  );
}
