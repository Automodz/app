'use client';
/**
 * STUDIO
 *
 * Source: docs/AUTOMODZ-OS.md §2.1, §2.2, §2.5, §3.1, §3.2, §3.5, §4.1,
 *         §4.3, §4.5, §5.2, §5.4, §6.3, §8.2, §8.3, §8.4, §8.6, §9.5,
 *         §10.4, §18.1, §21.1, §21.6, §21.7, §22.1
 *         design "AutoModz App.dc.html" — screen 1e, "What we do to cars"
 *
 * ── WHAT THIS SCREEN IS ──────────────────────────────────────────────────
 * §5.2 — Studio is about "AutoModz the place", and holds "what the studio is
 * and can do, credentials, services, hours, location, arranging a visit". It
 * never holds "a staff roster, any named individual".
 *
 * So this is a PLACE, entered. What changed with the design is the ORDER: the
 * catalogue now opens the room and the studio's voice follows it.
 *
 * ── THE PRICES ARE HERE NOW, AND THAT REVERSES A RULE ─────────────────────
 * This file used to carry the note "no price anywhere… a premium studio's
 * price is a conversation, and a shelf label is what turns craft into a
 * commodity." Screen 1e prices every service, and the reversal is deliberate:
 *
 *   - Every price is a FLOOR, said as one ("from ₹24,000"). A floor is not a
 *     shelf label; it is the honest opening of the conversation the old rule
 *     wanted to protect, and it lets a customer know whether to start it.
 *   - Withholding it did not make the product feel premium. It made the one
 *     question every customer arrives with — what does this cost — the one
 *     question the studio would not answer, which reads as evasion, not craft.
 *   - §22.1 is untouched: money is still computed on the server. This renders
 *     a catalogue the projection handed it and calculates nothing.
 *
 * The prose the room used to lead with (`does`) is kept and moved below the
 * catalogue: it is the studio's account of HOW it works, which is worth more
 * once you know what the work is.
 *
 * ── NO PHOTOGRAPH MAY CONTAIN A PERSON ───────────────────────────────────
 * §2.2 forbids naming an individual on a customer surface, and a face names
 * someone more loudly than text does. The photographs here are of the place
 * and of the work. Never of anyone.
 *
 * ── DATA ─────────────────────────────────────────────────────────────────
 * This component holds none and fetches none.
 */
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { color, space, INSET, imageSizes } from '@/design';
import { DOT } from '@/design';
import type { Service, Subscription, Vehicle } from '@/lib/types';
import { BookingFlow } from '@/components/studio/BookingFlow';
import type { CarriedEstimate, AddressChoice } from '@/components/studio/BookingFlow';
import { OfflineNote } from '@/components/system';
import {
  Screen, Pane, Label, Statement, DISPLAY, Rail, Action, Pulse, Chevron,
} from '@/components/os';

/* ── What the Studio needs to be true ──────────────────────────────────── */

export interface StudioPhoto {
  url: string;
  /** §21.6 — an image that carries meaning carries a description. */
  description: string;
}

export interface StudioModel {
  place: string;
  /**
   * WHERE IS MY CAR — the studio saying whether your car is with it. §4.5:
   * "the absence of news is good news and should look like it".
   */
  presence: string;
  /** §5.4 — the live account, while there is one to follow. */
  visitHref?: string;
  /** §2.2 — the studio's own words about how it works, unsigned. */
  voice: string;
  /** The work, mid-flight. No people. */
  work?: StudioPhoto;
  /** How the studio describes what it does, in prose. */
  does: string;
  /** §5.2 credentials. Lines of text, never badges in a row. */
  credentials?: readonly string[];
  hours: string;
  address: string;
  directionsHref: string;
  /** The place itself. No people (see above). */
  photo?: StudioPhoto;
  arrangeHref?: string;
  /**
   * WHERE CHOOSING A SERVICE GOES — design 06 → 07, keyed by service id.
   *
   * A scope screen has to know which service AND which car, and a renderer may
   * not build an address (ARCHITECTURE §1). The projection resolves one per
   * service so the pane is a plain link.
   */
  serviceHref: Record<string, string>;
  /** The menu, the cars and the standing — everything arranging a visit needs. */
  booking: {
    services: Service[];
    vehicles: Vehicle[];
    membership: Subscription | null;
    /** Design screen 08 — where the studio may collect from. */
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
   * Read on the server from the estimate's own document — never rebuilt from a
   * query string, which would make the figure on the sheet a client value and
   * therefore not a price at all.
   */
  estimate?: CarriedEstimate | null;
}

export interface StudioVisitRow {
  id: string;
  service: string;
  vehicleName: string;
  /** "Wed 12 February at 9:00 am" — worded by the projection. */
  when: string;
  /** The studio's word for where it stands. */
  standing: string;
  href: string;
}

/**
 * The floor, in the studio's currency. A price is stored in rupees and read
 * here in the Indian grouping — ₹45,000, never ₹45000 and never 45K.
 */
const floorPrice = (rupees: number) => `from ₹${Math.round(rupees).toLocaleString('en-IN')}`;

/**
 * HOW LONG THE CAR IS AWAY, which is the fact an owner actually plans around.
 * Stored as minutes of work; spoken in hours below a working day and in days
 * above it, because "600 minutes" is not a thing anyone says about their car.
 */
const inTheStudio = (minutes: number): string | undefined => {
  if (!minutes || minutes <= 0) return undefined;
  if (minutes < 480) {
    const h = Math.max(1, Math.round(minutes / 60));
    return `${h} hour${h === 1 ? '' : 's'} in the studio`;
  }
  const d = Math.ceil(minutes / 480);
  const h = Math.round(minutes / 60);
  return `${d} day${d === 1 ? '' : 's'} in the studio · ${h} hours of work`;
};

export function StudioScreen({ model }: { model: StudioModel }) {
  const {
    place, presence, visitHref, voice, work, does,
    credentials = [], hours, address, directionsHref, photo, booking, manageable,
    serviceHref, estimate = null,
  } = model;

  /* ARRANGING IS ADDRESSABLE (§6.4). `?arrange=1`, and `?cat=` carries the
     category a proposal named, so a "Renew it" from Home lands on the right
     service. Unchanged by the design; the sheet it opens is screen 1f. */
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const arranging = params.get('arrange') === '1';
  const prefillCategory = params.get('cat');

  const setArranging = (on: boolean) => {
    const next = new URLSearchParams(params.toString());
    if (on) next.set('arrange', '1');
    else { next.delete('arrange'); next.delete('cat'); }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  /* ARRIVING WITH AN ESTIMATE IS ARRIVING TO CHOOSE A DAY. The scope screen's
     "Choose a date" lands here; the sheet must already be open, or the
     customer is returned to the catalogue they have just come from. */
  useEffect(() => {
    if ((prefillCategory || estimate) && !arranging) setArranging(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCategory, estimate?.id]);

  /* §5.2 — the catalogue, in the studio's own order. The one marked `popular`
     is the warm pane: at most one thing on a screen is asking (§3.2), and this
     is the studio's recommendation rather than a merchandising banner. */
  const services = booking.services.filter(s => s.active !== false);
  const featured = services.find(s => s.popular);

  return (
    <Screen top={space.gap}>
      <OfflineNote />

      {/* ── WHERE MY CAR IS ─────────────────────────────────────────────
          §9.5 — the one Display. §21.7 — it changes without the customer
          acting, so it is announced politely rather than in silence. */}
      <Statement eyebrow={place} lit={Boolean(visitHref)}>
        <span aria-live="polite">{presence}</span>
      </Statement>

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

      {/* ── THE CATALOGUE ───────────────────────────────────────────────
          Screen 1e. Each service is one pane: what it is, what it starts at,
          and what it does to the car — in that order, because the price is
          the question and the description is the answer to it.

          The whole pane arranges the visit. §4.3 — depth of one; a "Book"
          control on each row would be a shop, and this is a menu of work. */}
      {services.length > 0 ? (
        <section
          aria-labelledby="studio-catalogue"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="studio-catalogue" style={{ margin: 0 }}>
            <Statement eyebrow="The studio" as="h2" size={DISPLAY.nested} lit>
              What we do to cars
            </Statement>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: space.line - 1 }}>
            {services.map(s => {
              const away = inTheStudio(s.duration);
              return (
                /* CHOOSING A SERVICE OPENS ITS COVERAGES (design 06 → 07).
                   It used to open the booking sheet directly, which asked a
                   customer to pick a day before they had been told how much of
                   their car was being treated or what it cost. */
                <Pane
                  key={s.id}
                  tone={s.id === featured?.id ? 'warm' : 'plain'}
                  as={serviceHref[s.id] ? Link : 'button'}
                  {...(serviceHref[s.id]
                    ? { href: serviceHref[s.id] }
                    : { onClick: () => setArranging(true) })}
                  className="am-tap"
                  style={{
                    padding: `${space.gap + 1}px ${space.gap + 3}px`,
                    display: 'flex', flexDirection: 'column', gap: space.breath,
                    textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%',
                    textDecoration: 'none',
                  }}
                >
                  <span
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'baseline', gap: space.line,
                      /* A service name long enough to wrap must not be squeezed
                         by the price beside it — see `Value` in os/parts. */
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 16, color: color.ink }}>{s.name}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        marginLeft: 'auto', textAlign: 'right', overflowWrap: 'anywhere',
                        color: s.id === featured?.id ? color.champagne : 'rgba(232,217,190,0.8)',
                      }}
                    >
                      {floorPrice(s.price)}
                    </span>
                  </span>
                  {s.description ? (
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: color.ink3 }}>
                      {s.description}
                    </span>
                  ) : null}
                  {/* The two facts a price does not carry: the brand standing
                      behind the work, and how long the car is away. */}
                  {s.brand || away ? (
                    <Label style={{ fontSize: 9.5, letterSpacing: '0.18em' }}>
                      {[s.brand, away].filter(Boolean).join(DOT)}
                    </Label>
                  ) : null}
                </Pane>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── ARRANGING A VISIT ───────────────────────────────────────────
          §10.4 — "the thing this screen exists to let you do — at most one."
          The only filled control in the room. */}
      <div style={{ marginTop: space.gap }}>
        <Action onClick={() => setArranging(true)}>Arrange a visit</Action>
      </div>

      {/* ── THE VISITS ALREADY ARRANGED ─────────────────────────────────
          §18.1 — nothing booked, nothing here. The invitation above is the
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
              /* THE WHOLE ROW IS THE DOOR (§21.3, §4.3 — depth of one). It was
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

      {/* ── THE WORK ────────────────────────────────────────────────────
          §8.4 — full-bleed, while the words around it stay in the gutter. One
          photograph, not a gallery: what the place does, shown once. */}
      {work ? (
        <div
          style={{
            position: 'relative', width: `calc(100% + ${INSET * 2}px)`,
            marginInline: -INSET, marginTop: space.rest / 2,
            aspectRatio: '4 / 3',
            overflow: 'hidden',
          }}
        >
          <Image
            src={work.url}
            alt={work.description}
            fill
            sizes={imageSizes.fullBleed}
            style={{ objectFit: 'cover' }}
          className="am-photo"
          />
        </div>
      ) : null}

      {/* ── WHO IS CARING FOR IT ────────────────────────────────────────
          §2.2 — the studio's voice, unsigned. No heading above it: a heading
          would label the studio's own words as a section, and §3.5 removes
          anything that only restates what its content already says. */}
      <section style={{ marginTop: space.rest / 2 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: color.ink }}>{voice}</p>
        <p style={{ marginTop: space.gap, marginBottom: 0, fontSize: 14, lineHeight: 1.65, color: color.ink2 }}>
          {does}
        </p>
      </section>

      {/* ── WHAT MAKES IT SO ────────────────────────────────────────────
          §5.2 credentials. Stacked lines, never badges in a row — a badge row
          is somebody else's brand doing the talking. §18.1 — with none stated,
          nothing appears. */}
      {credentials.length > 0 ? (
        <section
          aria-labelledby="studio-credentials"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="studio-credentials" style={{ margin: 0 }}><Rail>What stands behind it</Rail></h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.line }}>
            {credentials.map(line => (
              <p key={line} style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.ink2 }}>
                {line}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── WHEN IT IS OPEN, AND WHERE ──────────────────────────────────
          §8.6 — facts, so lines of text. The way to the door hangs off the
          address rather than standing alone in a row of buttons. */}
      <Pane style={{ marginTop: space.rest / 2, padding: `${space.gap + 2}px ${space.gap + 4}px` }}>
        <p style={{ margin: 0, fontSize: 14.5, color: color.ink }}>{hours}</p>
        <p style={{ marginTop: space.line, marginBottom: 0, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
          {address}
        </p>
        <div style={{ marginTop: space.gap }}>
          <Action href={directionsHref} quiet style={{ fontSize: 14 }}>How to find us</Action>
        </div>
      </Pane>

      {/* The place itself, at the foot — the room you are standing in, shown
          once you have read what happens in it. */}
      {photo ? (
        <div
          style={{
            position: 'relative', width: `calc(100% + ${INSET * 2}px)`,
            marginInline: -INSET, marginTop: space.rest / 2,
            height: 220, overflow: 'hidden', borderRadius: 0,
          }}
        >
          <Image
            src={photo.url}
            alt={photo.description}
            fill
            sizes={imageSizes.fullBleed}
            style={{ objectFit: 'cover' }}
          className="am-photo"
          />
          <span
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(8,9,10,0.55), rgba(8,9,10,0.2) 40%, ${color.paper})',
            }}
          />
        </div>
      ) : null}

      {/* THE VISIT ITSELF — screen 1f, as a sheet over this room. */}
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
