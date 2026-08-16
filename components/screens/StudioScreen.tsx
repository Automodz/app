'use client';
/**
 * STUDIO
 *
 * Source: docs/AUTOMODZ-OS.md §2.1, §2.2, §2.5, §3.1, §3.2, §3.5, §4.1,
 *         §4.3, §4.5, §5.2, §5.4, §6.3, §8.2, §8.3, §8.4, §8.6, §9.5,
 *         §10.4, §11.2, §18.1, §21.1, §21.6, §21.7, §22.1, §22.2
 *         design "AutoModz App.dc.html" - screen 1e, "What we do to cars"
 *
 * ── WHAT THIS SCREEN IS ──────────────────────────────────────────────────
 * §5.2 - Studio is about "AutoModz the place", and holds "what the studio is
 * and can do … and arranging a visit". It never holds "a staff roster, any
 * named individual".
 *
 * ── IT IS THE WORK, AND NOTHING ELSE ─────────────────────────────────────
 * The room briefly carried a photographic hero, a credentials section, a
 * strip of everything else the studio offers, and its hours and address. The
 * owner cut all four: the Studio is where a customer decides what their car
 * needs, and every other thing on it was competing with that decision. §3.2 -
 * one subject per surface, and this surface's subject is the work.
 *
 * §5.2 names hours and location among the things a Studio "holds"; the owner's
 * call overrides it here. The doors are still answered - the open/closed line
 * under the title says whether the studio is open right now, which is the part
 * of "hours" a customer actually reads - and the way to the door is the
 * landing page, which every visitor meets before they ever sign in.
 *
 * ── THE CATALOGUE IS A DECISION, NOT A LIST ──────────────────────────────
 * This room used to draw all eighteen active services in one column, grouped
 * under four headings. It read as a price list, and it asked a customer who
 * wanted paint protection to compare six films across two brands in a single
 * scroll - see `components/studio/ServiceChooser.tsx`, which is the whole
 * argument and the sheet that replaces it.
 *
 * What is here is the FOUR DISCIPLINES: the studio saying what it does, one
 * card each. Choosing one opens the chooser at that discipline, which asks
 * whose, then which of theirs, and hands off to the scope screen. Detailing
 * and washing carry no brand, so they narrow once instead of twice - in the
 * same sheet, with the same shapes.
 *
 * ── THE PRICES ARE HERE, AND THAT REVERSES AN OLD RULE ───────────────────
 * This file used to carry "no price anywhere… a premium studio's price is a
 * conversation". Every figure the room shows is a FLOOR, said as one ("from
 * ₹85,000"), which is the honest opening of that conversation rather than a
 * shelf label - and withholding it made the one question every customer
 * arrives with the one question the studio would not answer. §22.1 is
 * untouched: money is computed on the server. This renders what it is handed.
 *
 * ── AND THERE IS NO PHOTOGRAPH AT ALL ────────────────────────────────────
 * §2.2 forbids naming an individual on a customer surface, and a face names
 * someone louder than text does - so no photograph on this room may contain a
 * person, which is why the disciplines are DRAWN (see the chooser). The room's
 * one person-free photograph, the studio floor, was cut with the rest.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none.
 */
import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { color, space } from '@/design';
import type { Service, Subscription, Vehicle } from '@/lib/types';
import { BookingFlow } from '@/components/studio/BookingFlow';
import type { CarriedEstimate, AddressChoice } from '@/components/studio/BookingFlow';
import { ServiceChooser, DisciplineCard } from '@/components/studio/ServiceChooser';
import type { ChooserDiscipline } from '@/components/studio/ServiceChooser';
import { OfflineNote } from '@/components/system';
import {
  Screen, Pane, Label, Statement, DISPLAY, Rail, Action, Pulse, Chevron } from '@/components/os';

/* ── What the Studio needs to be true ──────────────────────────────────── */

export interface StudioModel {
  place: string;
  /**
   * WHERE IS MY CAR - the studio saying whether your car is with it. §4.5:
   * "the absence of news is good news and should look like it".
   */
  presence: string;
  /** §5.4 - the live account, while there is one to follow. */
  visitHref?: string;
  /** "Open now until 7 pm" / "Closed - opens 9 am". Absent is never guessed. */
  openLine?: string;
  /** Whether the doors are open at this moment. The one lit point (§17.1). */
  openNow?: boolean;
  /** §2.2 - the studio's own words about how it works, unsigned. */
  voice: string;
  /** How the studio describes what it does, in prose. */
  does: string;
  /**
   * WHERE CHOOSING A SERVICE GOES - design 06 → 07, keyed by service id.
   *
   * A scope screen has to know which service AND which car, and a renderer may
   * not build an address (ARCHITECTURE §1). The projection resolves one per
   * service so the pane is a plain link.
   */
  serviceHref: Record<string, string>;
  /**
   * THE CATALOGUE AS A DECISION - discipline → brand → product.
   *
   * Shaped by the projection from the same catalogue the booking sheet reads,
   * so the chooser and the sheet cannot offer different work.
   */
  disciplines: readonly ChooserDiscipline[];
  /**
   * THE SOONEST THE STUDIO CAN TAKE WORK - one real query against real
   * occupancy. Absent rather than guessed: an invented opening is a customer
   * told to come on a day the bays are full.
   */
  nextOpening?: string;
  /** The menu, the cars and the standing - everything arranging a visit needs. */
  booking: {
    services: Service[];
    vehicles: Vehicle[];
    membership: Subscription | null;
    /** Design screen 08 - where the studio may collect from. */
    addresses: AddressChoice[];
    /** ₹ per leg, from the pricing engine. Never a figure typed in a screen. */
    legFee: string;
    /** Where a customer with none goes to save their first. */
    addAddressHref: string;
  };
  /**
   * Visits the customer has arranged, soonest first.
   *
   * Each carries the address of its OWN screen. This used to carry a whole
   * `ManageVisitModel` and open a sheet over this room; a booking has two
   * screens of its own now (design 09 and 10), so the row is a doorway rather
   * than a second implementation of them.
   */
  manageable: StudioVisitRow[];
  /**
   * WHAT THE CUSTOMER WAS QUOTED, when they arrived from the scope screen.
   *
   * Read on the server from the estimate's own document - never rebuilt from a
   * query string, which would make the figure on the sheet a client value and
   * therefore not a price at all.
   */
  estimate?: CarriedEstimate | null;
}

export interface StudioVisitRow {
  id: string;
  service: string;
  vehicleName: string;
  /** "Wed 12 February at 9:00 am" - worded by the projection. */
  when: string;
  /** The studio's word for where it stands. */
  standing: string;
  href: string;
}

export function StudioScreen({ model }: { model: StudioModel }) {
  const {
    place, presence, visitHref, openLine, openNow = false, voice, does,
    booking, manageable, disciplines, nextOpening, estimate = null,
  } = model;

  /* ARRANGING IS ADDRESSABLE (§6.4). `?arrange=1`, and `?cat=` carries the
     category a proposal named, so a "Renew it" from Home lands on the right
     service. Unchanged by the design; the sheet it opens is screen 1f.

     CHOOSING IS ADDRESSABLE TOO, and for the same reason: `?choose=` holds the
     discipline and `?brand=` the brand, so every step of the chooser is a
     place a link can reach and the back button can close. State inside the
     sheet would lose all three. */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const arranging = params.get('arrange') === '1';
  const prefillCategory = params.get('cat');
  const choosing = params.get('choose');
  const chosenBrand = params.get('brand');

  const walk = (next: URLSearchParams) => {
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const setArranging = (on: boolean) => {
    const next = new URLSearchParams(params.toString());
    if (on) { next.set('arrange', '1'); next.delete('choose'); next.delete('brand'); }
    else { next.delete('arrange'); next.delete('cat'); }
    walk(next);
  };

  /* THE CHOOSER'S POSITION, WRITTEN INTO THE ADDRESS. `null` closes it; a
     discipline with no brand clears whatever brand was there, or stepping back
     one and forward into another would carry the first one's brand with it. */
  const setChoosing = (category: string | null, brand?: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (category === null) { next.delete('choose'); next.delete('brand'); }
    else {
      next.set('choose', category);
      if (brand) next.set('brand', brand);
      else next.delete('brand');
    }
    walk(next);
  };

  const openChooser = (category: string) => setChoosing(category);
  const openBrand = (brand: string | null) => setChoosing(choosing ?? 'all', brand);
  const closeChooser = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('choose');
    next.delete('brand');
    walk(next);
  };

  /* ARRIVING WITH AN ESTIMATE IS ARRIVING TO CHOOSE A DAY. The scope screen's
     "Choose a date" lands here; the sheet must already be open, or the
     customer is returned to the catalogue they have just come from. */
  useEffect(() => {
    if ((prefillCategory || estimate) && !arranging) setArranging(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCategory, estimate?.id]);

  /* §5.2 - the studio's recommendation, and at most one (§3.2). The catalogue
     marks a service `popular`; the discipline that holds it is the warm card. */
  const featured = disciplines.find(d =>
    d.brands.some(b => b.products.some(p => p.popular)));

  return (
    <Screen top={space.gap}>
      <OfflineNote />

      {/* ── WHERE MY CAR IS ────────────────────────────────────────────
          §9.5 - the one Display. §4.5 - the absence of news is good news and
          should look like it. §21.7 - it changes without the customer acting,
          so it is announced politely rather than in silence.

          The photographic hero that stood here is gone with the rest of the
          room's furniture: this screen is about choosing work, and a 440px
          photograph before the first card pushed the whole decision below the
          fold on a phone. */}
      <Statement eyebrow={place} lit={Boolean(visitHref)}>
        <span aria-live="polite">{presence}</span>
      </Statement>

      {/* WHETHER THE DOORS ARE OPEN. It is the part of "hours" a customer
          actually reads, and with the hours card gone it is the whole of the
          answer - so it stays, computed against the studio's own clock. */}
      {openLine ? (
        <span
          style={{
            display: 'flex', alignItems: 'center', gap: space.breath,
            marginTop: space.line,
          }}
        >
          {openNow ? <Pulse size={7} /> : null}
          <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>{openLine}</Label>
        </span>
      ) : null}

      {visitHref ? (
        <Pane
          tone="lit" live
          as="a"
          {...{ href: visitHref }}
          style={{
            marginTop: space.gap,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: space.line, padding: `${space.gap}px ${space.gap + 2}px`,
            textDecoration: 'none',
          }}
        >
          <span style={{ fontSize: 14, color: color.ink }}>Follow the work</span>
          <Pulse />
        </Pane>
      ) : null}

      {/* ── WHAT WE DO TO CARS ──────────────────────────────────────────
          The four disciplines, one card each, in the studio's own order - the
          same order the landing page states them in, so a customer who
          arrived from there meets the same four in the same sequence.

          The whole card opens the chooser at that discipline. §4.3 - depth of
          one; a "Book" control on each row would be a shop, and this is the
          studio saying what it does. */}
      {disciplines.length > 0 ? (
        <section
          aria-labelledby="studio-catalogue"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="studio-catalogue" style={{ margin: 0 }}>
            <Statement eyebrow="The studio" as="h2" size={DISPLAY.nested} lit>
              What we do to cars
            </Statement>
          </h2>

          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: color.ink3 }}>
            Choose what the car needs and we&rsquo;ll narrow it with you - the
            brand, then the exact grade, then what it costs for your car.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: space.line }}>
            {disciplines.map(d => (
              <DisciplineCard
                key={d.id}
                discipline={d}
                lit={d.id === featured?.id}
                onChoose={openChooser}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── ARRANGING A VISIT ───────────────────────────────────────────
          §10.4 - "the thing this screen exists to let you do - at most one."
          The only filled control in the room. The opening under it is the
          studio's real diary, so the commitment is made knowing the answer to
          "when could you take it" rather than after discovering it.

          IT OPENS THE CHOOSER, NOT THE DATE SHEET. It used to go straight to
          the booking sheet, whose first question is a menu of every service
          the studio sells - so the flat list this room removed was still one
          tap away, on the room's most-used control. The customer who has not
          decided what the car needs is asked that first, in the same three
          steps the cards above lead into; the customer who HAS decided arrives
          at the date sheet from the scope screen with a written estimate, and
          every other room's `?arrange=1` still opens it directly. */}
      <div style={{ marginTop: space.gap }}>
        <Action onClick={() => setChoosing('all')}>Arrange a visit</Action>
        {nextOpening ? (
          <p
            style={{
              margin: `${space.line}px 0 0`, textAlign: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: color.ink3,
            }}
          >
            {nextOpening}
          </p>
        ) : null}
      </div>

      {/* ── THE VISITS ALREADY ARRANGED ─────────────────────────────────
          §18.1 - nothing booked, nothing here. The invitation above is the
          empty state; a second empty card would be the same silence twice. */}
      {manageable.length > 0 ? (
        <section
          aria-labelledby="studio-visits"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="studio-visits" style={{ margin: 0 }}>
            <Rail>{manageable.length === 1 ? 'Your visit' : 'Your visits'}</Rail>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.line }}>
            {manageable.map(v => (
              /* THE WHOLE ROW IS THE DOOR (§21.3, §4.3 - depth of one). It was
                 a pane with a small "Change or cancel" link inside it, which
                 made the target the words rather than the visit. */
              <Pane
                key={v.id}
                as="a"
                {...{ href: v.href }}
                className="am-tap"
                style={{
                  padding: `${space.gap}px ${space.gap + 2}px`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: space.line, textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 15, color: color.ink }}>{v.service}</span>
                  <Label style={{ fontSize: 10, letterSpacing: '0.14em' }}>
                    {v.vehicleName} · {v.when}
                  </Label>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: space.breath, flexShrink: 0 }}>
                  <Label style={{ fontSize: 9, letterSpacing: '0.16em' }}>{v.standing}</Label>
                  <Chevron size={16} />
                </span>
              </Pane>
            ))}
          </div>
        </section>
      ) : null}

      {/* A SECOND FULL-BLEED PHOTOGRAPH STOOD HERE - the work, mid-flight.
          It went with the hero: this room carries no photography at all now,
          and the model no longer has a field for one, so a picture cannot
          quietly return without the decision being made again. */}

      {/* ── WHO IS CARING FOR IT ────────────────────────────────────────
          §2.2 - the studio's voice, unsigned. No heading above it: a heading
          would label the studio's own words as a section, and §3.5 removes
          anything that only restates what its content already says. */}
      <section style={{ marginTop: space.rest / 2 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: color.ink }}>{voice}</p>
        <p style={{ marginTop: space.gap, marginBottom: 0, fontSize: 14, lineHeight: 1.65, color: color.ink2 }}>
          {does}
        </p>
      </section>

      {/* CHOOSING THE WORK - discipline, then whose, then which of theirs.
          Its position lives in the address, so the sheet is restorable and the
          back button closes one step rather than the whole room. */}
      <ServiceChooser
        open={Boolean(choosing)}
        disciplines={disciplines}
        category={choosing === 'all' ? null : choosing}
        brand={chosenBrand}
        onCategory={cat => (cat === null ? setChoosing('all') : setChoosing(cat))}
        onBrand={openBrand}
        onClose={closeChooser}
        onArrange={() => setArranging(true)}
      />

      {/* THE VISIT ITSELF - screen 1f, as a sheet over this room. */}
      <BookingFlow
        open={arranging}
        onClose={() => setArranging(false)}
        services={booking.services}
        vehicles={booking.vehicles}
        membership={booking.membership}
        prefillCategory={prefillCategory}
        estimate={estimate}
        addresses={booking.addresses}
        legFee={booking.legFee}
        addAddressHref={booking.addAddressHref}
      />
    </Screen>
  );
}
