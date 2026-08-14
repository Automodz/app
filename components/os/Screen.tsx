'use client';
/**
 * THE ROOM - what every screen in the customer application sits inside.
 *
 * Source: docs/AUTOMODZ-OS.md §8.1, §8.4, §8.5, §9.1
 *         design "AutoModz App.dc.html" - the frame drawn around all twelve
 *
 * Three things, and only three, because every room in the design has exactly
 * these and nothing else:
 *
 * 1. ONE COLUMN, INSET (§8.1, §8.4). Capped, so the phone composition does not
 *    become a stretched band on a laptop - the design is drawn at 390 and the
 *    cap is what keeps it recognisably that composition at 1440.
 *
 * 2. THE STACKING CONTRACT (§8.5). The floor is `stack.contentFloor`, so the
 *    last element clears the dock by arithmetic rather than by anyone
 *    measuring it.
 *
 * 3. THE LIGHT ABOVE (§9.1). A soft warm bloom at the top of the room. It is
 *    on the room, not on any surface, which is why glass has something to be
 *    glass against - a pane over flat black is a grey box.
 *
 * The ambient field mounted by `CustomerChrome` sits behind all of this and is
 * not repeated here.
 */
import type { CSSProperties, ReactNode } from 'react';
import { INSET, MEASURE, space, stack } from '@/design';

export function Screen(
  { children, top = space.rest, style }:
  { children: ReactNode; top?: number; style?: CSSProperties },
) {
  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100svh',
        paddingInline: INSET,
        paddingTop: `calc(${top}px + env(safe-area-inset-top, 0px))`,
        paddingBottom: stack.contentFloor,
        maxWidth: MEASURE + INSET * 2,
        marginInline: 'auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* THE LIGHT. Two blooms, breathing on different periods so they never
          pulse together and read as a heartbeat. Behind everything, and
          `pointer-events:none` so a bloom can never eat a tap. */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          overflow: 'hidden', zIndex: -1,
        }}
      >
        <div
          className="am-breathe"
          style={{
            position: 'absolute', top: '-24%', left: '-20%',
            width: 620, height: 620, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(224,164,92,0.16), transparent 62%)',
            filter: 'blur(30px)',
            animationDuration: '14s',
          }}
        />
        <div
          className="am-breathe"
          style={{
            position: 'absolute', bottom: '-10%', right: '-16%',
            width: 560, height: 560, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,217,190,0.10), transparent 60%)',
            filter: 'blur(40px)',
            animationDuration: '18s',
          }}
        />
      </div>

      {children}
    </main>
  );
}
