/**
 * THE ONE GLASS SURFACE.
 *
 * §10.2 — one raised material, "not a card and a panel and a tile — one". This
 * is it. A card is this, a stat is this, a sheet's body is this. There is no
 * `strong` or `subtle` variant, because a second translucency in the same view
 * is the stacking §3.6 forbids even when the two are not literally nested.
 *
 * A SERVER COMPONENT. It holds no state and no handlers — it is a lit box with
 * children in it — so it costs the browser nothing.
 *
 * `tone` is the ONE place colour is allowed in (§3.3): a surface may carry a
 * state's hue in its edge when the state is what the surface is about. It is
 * never decorative, and the default carries none.
 */
import type { CSSProperties, ReactNode, ElementType } from 'react';
import { radius, space, elevation } from '@/design';
import { toneColor, type Tone } from './tone';

export interface GlassProps {
  children?: ReactNode;
  /** How much room inside. Defaults to a comfortable card. */
  pad?: keyof typeof space | 'none';
  /** Corner. `card` unless a surface is behaving as a sheet or a chip. */
  round?: keyof typeof radius;
  /**
   * A state's colour, on the edge only, when the state is the subject.
   * §3.3 — information, never decoration.
   */
  tone?: Tone;
  /** Lifted further off the ground. Sparingly — §3.5. */
  raised?: boolean;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

export function Glass({
  children,
  pad = 'gap',
  round = 'card',
  tone,
  raised = false,
  as: Tag = 'div',
  className,
  style,
}: GlassProps) {
  const edge = tone ? toneColor(tone) : undefined;

  return (
    <Tag
      className={`am-glass${className ? ` ${className}` : ''}`}
      style={{
        borderRadius: radius[round],
        padding: pad === 'none' ? 0 : space[pad],
        /* The state's hue replaces the neutral hairline rather than joining it
           — two edges on one boundary is the second border §3.4 warns about. */
        ...(edge ? { borderColor: edge } : null),
        ...(raised ? { boxShadow: elevation.float.shadow } : null),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
