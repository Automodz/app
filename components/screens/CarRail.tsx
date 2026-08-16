'use client';
/**
 * THE CARS, UNDER THE RING - and the one control on Home that decides what the
 * rest of the room is about.
 *
 * Source: docs/AUTOMODZ-OS.md §4.3, §6.2, §6.4, §7.6, §12.2, §12.3, §21.3,
 *         §21.6, §22.2
 *
 * ── WHAT CHANGED, AND WHY IT NEEDED A CLIENT ISLAND ──────────────────────
 * The rail sat at the FOOT of Home, under the record and the market, and each
 * card was a link that rewrote `?car=` - so the strip that decides whose car
 * the whole screen is about was the last thing on the screen, and tapping a
 * photograph of your car took you to a differently-worded copy of the page you
 * were already on rather than to the car.
 *
 * It is directly under the ring now, and it carries TWO gestures, because a
 * customer already makes two:
 *
 *   SCROLL   the card the rail settles on becomes Home's subject. The heading
 *            above the ring, the ring itself and every section below it follow.
 *   TAP      opens that car's own room (design 1d).
 *
 * Both are real addresses built by the projection (§6.4, ARCHITECTURE §1):
 * `selectHref` is `/?car=<id>` and `href` is the car's room. Nothing here
 * invents one, and with JavaScript unavailable the cards are still links to
 * the cars - the scroll gesture is the enhancement, never the only way.
 *
 * Home itself is still a SERVER component and still ships no JavaScript of its
 * own; this is the one island on it, and it exists because "which card is the
 * rail resting on" is a question only a browser can answer.
 *
 * ── WHY THE SELECTION IS OPTIMISTIC ──────────────────────────────────────
 * `?car=` is resolved on the server, so following it is a round trip. Waiting
 * for it before moving the light would make the rail feel broken on a slow
 * connection. The highlight is therefore local and immediate, and the server's
 * answer arrives underneath it - which is also why `current` from the model is
 * only the STARTING position rather than the source of truth for the mark.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { color, space, radius, INSET, dotted } from '@/design';
import { Label, Photograph } from '@/components/os';

export interface CarRailCar {
  id: string;
  name: string;
  plate: string;
  state: string;
  photo?: string;
  /** The car's own room. Where a tap goes. */
  href: string;
  /** `/?car=<id>`. Where a settled scroll goes. */
  selectHref: string;
  current: boolean;
}

/** The card's own width, and the scroll maths is measured rather than assumed. */
const CARD = 232;

/**
 * WHERE THE RAIL RESTS WHEN THIS CARD IS THE ONE IT IS ON.
 *
 * `scroll-snap-align: start` aligns a card to the SNAPPORT, which the rail
 * shrinks to its gutter with `scroll-padding` - so a card's snap position is
 * its offset MINUS that padding, not its offset. Twenty-four pixels out is
 * enough for the nearest-snap search to name the wrong card at the end of the
 * rail, which is exactly how the last car became unselectable.
 *
 * Read off the computed style rather than the constant, so the day somebody
 * changes the gutter this follows it.
 */
function snapOf(el: HTMLElement, card: HTMLElement): number {
  const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
  return card.offsetLeft - el.offsetLeft - pad;
}

export function CarRail({ cars }: { cars: readonly CarRailCar[] }) {
  const router = useRouter();
  const rail = useRef<HTMLDivElement | null>(null);
  const [lit, setLit] = useState(() => cars.find(c => c.current)?.id ?? cars[0]?.id);

  /* THE LIT CAR, READABLE FROM A LISTENER. The scroll handler is registered
     once and must not close over a stale `lit` - a ref is the value as it is
     NOW, so the guard against re-selecting the car already chosen actually
     holds after the first scroll. */
  const litNow = useRef(lit);
  litNow.current = lit;

  /* The model is authoritative when the SERVER changes its mind - a walk back
     to Home with a different `?car=`, or a car added in another tab. */
  useEffect(() => {
    const fromModel = cars.find(c => c.current)?.id;
    if (fromModel) setLit(fromModel);
  }, [cars]);

  /**
   * THE RAIL OPENS ON THE CAR HOME IS ABOUT.
   *
   * Without this, arriving at `/?car=<third car>` drew the third car's name
   * over the ring while the rail underneath showed the first - the two halves
   * of one statement disagreeing on the same screen. Jumped rather than
   * animated, and only on mount: this is where the rail STARTS, not a movement
   * the customer should watch (§7.6 - nothing is lost but the movement).
   */
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const i = cars.findIndex(c => c.current);
    if (i <= 0) return;
    const card = el.children[i] as HTMLElement | undefined;
    if (card) el.scrollLeft = snapOf(el, card);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * WHICH CARD THE RAIL HAS SETTLED ON.
   *
   * Measured from the cards themselves rather than divided out of `scrollLeft`,
   * because the rail bleeds into the gutter and arithmetic against an assumed
   * card width is right until somebody changes the padding.
   *
   * AGAINST THE SNAP, NOT AGAINST THE MIDDLE. The obvious reading of "which
   * card is the rail on" is the one nearest the centre of the viewport, and it
   * is wrong here: these cards snap to `start`, so the card the rail actually
   * rests on is the one whose left edge is at the scroll position. On a phone
   * the two answers agree, which is what makes the mistake so easy to keep -
   * at 768px the centre of the rail falls on the SECOND card, so the mount
   * alignment would have settled on it and navigated the room to a car the
   * customer never chose, before they touched anything.
   */
  const settled = () => {
    const el = rail.current;
    if (!el) return;

    /* A KEYBOARD IS NOT A SCROLL. Tabbing through the cards scrolls the rail
       as focus moves, and treating that as a choice would navigate the whole
       room out from under somebody who is only passing through (§21.6). */
    if (el.contains(document.activeElement) && document.activeElement !== document.body) return;

    /* THE END OF THE RAIL IS THE LAST CAR, whatever the arithmetic says.
       A start-aligned card cannot be scrolled to its own snap position once
       the content runs out - with four cards on a 390px phone the last one's
       snap point is 732 and the rail stops at 622 - so nearest-snap could
       never choose it, and the fourth car in a garage was unreachable by the
       gesture that is supposed to reach every car. */
    const end = el.scrollWidth - el.clientWidth;
    let best = end > 0 && el.scrollLeft >= end - 1 ? cars.length - 1 : 0;

    if (best === 0) {
      let bestGap = Infinity;
      Array.from(el.children).forEach((node, i) => {
        const gap = Math.abs(snapOf(el, node as HTMLElement) - el.scrollLeft);
        if (gap < bestGap) { bestGap = gap; best = i; }
      });
    }

    const car = cars[best];
    if (!car || car.id === litNow.current) return;
    setLit(car.id);
    /* `replace`, not `push`: which car Home is about is where you ARE, not a
       place you went, and a back button that walked five cars backwards would
       be the rail's scroll history rather than the customer's. */
    router.replace(car.selectHref, { scroll: false });
  };

  /* `scrollend` where the browser has it, a settle timer where it does not.
     Both answer the same question - "the finger has stopped" - and neither
     fires mid-gesture, which is what would make the room flicker. */
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;

    const onEnd = () => settled();
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(settled, 140);
    };

    const native = 'onscrollend' in window;
    if (native) el.addEventListener('scrollend', onEnd);
    else el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      if (native) el.removeEventListener('scrollend', onEnd);
      else el.removeEventListener('scroll', onScroll);
    };
    /* Registered ONCE. `settled` reads the cars from this closure and the lit
       car from a ref, so there is nothing stale for a dependency to refresh -
       and re-registering on every render would tear the listener off the
       element in the middle of a gesture.
       eslint-disable-next-line react-hooks/exhaustive-deps */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rail}
      className="no-scrollbar"
      style={{
        display: 'flex', gap: space.line, overflowX: 'auto',
        /* The gutter is the page's, so the rail bleeds to both edges and the
           first card still lines up with everything above it. */
        marginInline: -INSET, paddingInline: INSET, paddingBottom: space.breath,
        scrollSnapType: 'x mandatory',
        /* SNAP INSIDE THE GUTTER, NOT UNDER IT. The rail bleeds by `-INSET` and
           pads back by `INSET`, but a mandatory snap aligns the first card to
           the SCROLLPORT - the padding box - so on load it slid left underneath
           that padding and the first card sat 20px off the edge of the screen.
           `scroll-padding` is what shrinks the snapport to the gutter, and it
           is the only thing that does. */
        scrollPaddingInline: INSET,
      }}
    >
      {cars.map(c => {
        const on = c.id === lit;
        return (
          /* THE CAR, NOT A CARD ABOUT THE CAR. This was a 200x104 coloured pane
             with the name written on it - in a product whose whole argument is
             that the car is the subject (§2.1), the customer's own garage was
             the one strip that showed no cars. `Photograph` composes the
             absence, so a car with no picture yet is a quiet lit field at
             exactly this size rather than a shorter card that breaks the row. */
          <Link
            key={c.id}
            href={c.href}
            aria-current={on ? true : undefined}
            className="am-tap"
            style={{
              flex: `0 0 ${CARD}px`, width: CARD, textDecoration: 'none',
              borderRadius: radius.sheet, overflow: 'hidden',
              /* §6.2 - the light always shows where the customer is, and here
                 that is which car the room is about. §12.3 - cars are equals,
                 so "current" is a position and not a rank: an amber hairline,
                 never a warm pane. There is one warm surface on this screen and
                 it is the action. */
              border: `1px solid ${on ? 'rgba(224,164,92,0.35)' : 'rgba(255,255,255,0.08)'}`,
              scrollSnapAlign: 'start',
            }}
          >
            <span style={{ position: 'relative', display: 'block', height: 126 }}>
              <Photograph src={c.photo} alt={c.name} sizes={`${CARD}px`} radius={0} />
            </span>
            <span
              className="am-glass"
              style={{
                display: 'flex', flexDirection: 'column', gap: space.breath,
                padding: `${space.gap}px ${space.gap + 2}px`, borderRadius: 0, border: 'none',
              }}
            >
              <span style={{ fontSize: 15, color: color.ink }}>{c.name}</span>
              <Label lit={on} style={{ fontSize: 9.5, letterSpacing: '0.14em' }}>
                {dotted(c.plate, c.state)}
              </Label>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
