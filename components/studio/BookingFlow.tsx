'use client';
/**
 * ARRANGING A VISIT.
 *
 * Source: reference/customer-old/app/app/page.tsx:834-1105 (ArrangeSheet)
 *         docs/AUTOMODZ-OS-ARCHITECTURE.md §1, §6
 *
 * EVERY BUSINESS RULE IS THE SERVER'S. `/api/booking/create` deliberately does
 * NOT read `totalAmount`, `discount`, `serviceBasePrice`, `promoId` or
 * `discountAmount` off the body — it recomputes all of them. So this sends the
 * intent and nothing that could be forged, and the price shown here is a
 * PREVIEW of what the server will decide, never an instruction to it.
 *
 * Four rules ported verbatim because each one cost money when it was wrong:
 *
 *   1. The menu groups by category, so it reads as a few objects rather than a
 *      flat list of SKUs.
 *   2. A membership wash is covered when the plan is active AND washes remain.
 *   3. The promo lookup is a network read and may fail; the MEMBERSHIP discount
 *      is already in hand and must never depend on it. That is why the promo
 *      call is wrapped separately — a promo outage used to silently charge a
 *      member full price.
 *   4. One idempotency key per intent — this car, this service, this slot — so
 *      a retry after a timeout joins the first booking instead of making a
 *      second one.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
/* WAITED FOR, NOT GUESSED AT — `auth.currentUser` is null until the SDK has
   restored the persisted session, and no customer room subscribes to make that
   happen. See lib/clientSession.ts. */
import { idToken, currentUid } from '@/lib/clientSession';
import { getEligiblePromos } from '@/lib/services/promos';
import { computeBestDiscount, applyDiscount } from '@/lib/services/pricing';
import { washesLeftOf } from '@/lib/os/club';
import { generateTimeSlots } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import type { Service, Subscription, BookingDiscount, Vehicle } from '@/lib/types';
import { BottomSheet, Heading, Text, Button, OfflineNote, useOnline } from '@/components/system';
import {
  color, space, INSET, MEASURE, HAIRLINE, TARGET_MIN, radius,
  type as typeScale,
} from '@/design';

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The days a customer may choose from. Fourteen, starting today. */
const nextDays = (n = 14) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return iso(d);
  });

const dayLabel = (i: string) =>
  new Date(`${i}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** Today and tomorrow are named, because that is how anybody books. */
const dayName = (i: string) => {
  const today = iso(new Date());
  const t = new Date(); t.setDate(t.getDate() + 1);
  if (i === today) return 'Today';
  if (i === iso(t)) return 'Tomorrow';
  return new Date(`${i}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });
};

const dayNumeral = (i: string) =>
  new Date(`${i}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * WHEN THE CAR COMES BACK.
 *
 * A start time on its own answers half the question a customer is actually
 * asking. Ceramic work runs for hours; "10:00" and "10:00 – 15:00" are
 * different decisions, and only one of them can be planned around.
 */
const endTime = (start: string, durationMin: number) => {
  if (!Number.isFinite(durationMin) || durationMin <= 0) return null;
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + durationMin;
  /* Work spilling past closing is carried to the next day by the studio, and
     the slot generator already refuses to start one that cannot finish — so a
     wrapped time here would be a lie rather than a rounding. */
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * How long the car is away, said the way a person would say it.
 *
 * RETURNS NULL RATHER THAN NONSENSE. A catalogue document written without a
 * `duration` — the shape drifted once already — rendered "NaN hour" on the
 * control a customer uses to commit thousands of rupees. A fact we do not
 * have is not shown; it is never shown wrong.
 */
const spokenDuration = (min: number): string | null => {
  if (!Number.isFinite(min) || min <= 0) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) {
    const d = Math.round(h / 24);
    return d === 1 ? 'a full day' : `about ${d} days`;
  }
  return m ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
};

/** Morning, afternoon, evening — a flat strip of times is a list to parse. */
const PART_OF_DAY = [
  ['Morning', (h: number) => h < 12],
  ['Afternoon', (h: number) => h >= 12 && h < 17],
  ['Evening', (h: number) => h >= 17],
] as const;

/**
 * WHAT THE CUSTOMER WAS QUOTED — design screen 07, carried into 08.
 *
 * Read on the SERVER from the estimate's own document and handed down, so the
 * figure on this sheet is the figure the studio wrote rather than one the
 * browser reconstructed from a query string. Only its ID travels to the
 * booking route; the amount is never sent, and would be ignored if it were.
 */
export interface CarriedEstimate {
  id: string;
  serviceId: string;
  vehicleId: string;
  serviceName: string;
  /** "Full body · Two-stage correction" — what was actually chosen. */
  scopeLine: string;
  /** "₹1,26,720", or "Covered" for a membership wash. */
  total: string;
  /** "2 days in the bay" */
  bay: string;
  /** Minutes, so the slot picker offers hours the work can actually finish in. */
  durationMinutes: number;
}

export interface BookingFlowProps {
  open: boolean;
  onClose: () => void;
  services: Service[];
  vehicles: Vehicle[];
  membership: Subscription | null;
  /** The category the proposal named, when one sent the customer here. */
  prefillCategory?: string | null;
  /** Set when the customer arrived from the scope screen. */
  estimate?: CarriedEstimate | null;
}

export function BookingFlow({
  open, onClose, services, vehicles, membership, prefillCategory = null,
  estimate = null,
}: BookingFlowProps) {
  const router = useRouter();
  const online = useOnline();
  const { user } = useAppStore();

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [full, setFull] = useState<{ fullDates: string[]; fullSlots: Record<string, string[]> }>(
    { fullDates: [], fullSlots: {} },
  );
  const [discount, setDiscount] = useState<BookingDiscount | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* What the studio now holds. Set on success; the sheet becomes a receipt. */
  const [done, setDone] = useState<
    { reference: string; when: string; service: string; bookingId: string } | null
  >(null);

  /* 1 · the menu, grouped */
  const menu = useMemo(() => {
    const active = services.filter(s => s.active !== false);
    const m = new Map<string, Service[]>();
    active.forEach(s => {
      if (!m.has(s.category)) m.set(s.category, []);
      m.get(s.category)!.push(s);
    });
    return [...m.entries()];
  }, [services]);

  /**
   * OPENING resets, and honours the category the proposal named.
   *
   * ONLY ON THE TRANSITION INTO OPEN, and that is the whole point. `services`
   * and `vehicles` arrive as fresh array identities on every render of the
   * room above, so this effect used to re-run constantly — and the run
   * immediately after a successful booking was fatal: `confirm` calls
   * `router.refresh()`, the server re-renders, new arrays come down, and
   * `setDone(null)` wiped the receipt. The customer's booking succeeded and
   * the sheet showed them the empty form again, which reads as it having
   * failed. They book a second time.
   */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) { wasOpen.current = false; return; }
    if (wasOpen.current) return;
    wasOpen.current = true;
    const active = services.filter(s => s.active !== false);
    /* ARRIVED FROM THE SCOPE SCREEN. The car and the work are already decided
       and priced; asking again would invite a customer to change one of them
       and silently keep the other's price. */
    if (estimate) {
      setVehicleId(estimate.vehicleId);
      setService(active.find(s => s.id === estimate.serviceId) ?? null);
    } else {
      setVehicleId(vehicles[0]?.id ?? null);
      setService(prefillCategory ? active.find(s => s.category === prefillCategory) ?? null : null);
    }
    setDate(null);
    setTime(null);
    setError(null);
    setDone(null);
  }, [open, prefillCategory, services, vehicles, estimate]);

  /**
   * HOW LONG THE BAY IS ACTUALLY NEEDED.
   *
   * The catalogue's headline duration is the whole service; a scope and its
   * extra stages change it. Offering slots against the headline would let a
   * customer book a two-day PPF into an afternoon, and the server would then
   * refuse the very slot the sheet had just offered.
   */
  const workMinutes = estimate?.durationMinutes ?? service?.duration ?? 60;

  /* Which days and slots are already taken. */
  useEffect(() => {
    if (!open || !service) return;
    let cancelled = false;

    /* THIS ROUTE IS BEARER-AUTHENTICATED TOO, and it was called without a
       token. The 401 body parsed cleanly into `{ fullDates: undefined }`, so
       the sheet defaulted to "everything is free" and offered days and hours
       that were already taken — the customer only found out at the very end,
       as "that slot has just gone". A silent failure that reads as an answer
       is worse than an error. */
    void (async () => {
      const token = await idToken();
      if (!token || cancelled) return;
      try {
        const r = await fetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            dates: nextDays(),
            category: service.category,
            durationMinutes: workMinutes,
          }),
        });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (!cancelled) setFull({ fullDates: d.fullDates ?? [], fullSlots: d.fullSlots ?? {} });
      } catch {
        /* Unreachable — the studio may still take it; the server decides. */
      }
    })();

    return () => { cancelled = true; };
  }, [open, service, workMinutes]);

  /* 2 · a membership wash is covered when the plan is active AND washes remain */
  const washCovered = !!service
    && service.category === 'Washing'
    && !!membership
    && membership.status === 'active'
    /* One subtraction, one place (§22.2). The server decides this again and
       authoritatively; this only decides what the sheet SAYS. */
    && washesLeftOf(membership) > 0;

  /**
   * 3 · THE MEMBERSHIP DISCOUNT MUST NEVER DEPEND ON ANYTHING OPTIONAL.
   *
   * The promo call was already wrapped for exactly this reason — a promo
   * outage must not cost a member their rate — and then the whole effect was
   * gated on `user` from the client store, which reintroduced the same
   * failure by a different door. `ClientSession` (and with it `AuthProvider`)
   * is mounted only under `/admin`, `/store` and `/auth`; the customer rooms
   * render on the server and mount none of it, so `user` is ALWAYS null here.
   * Every member was quoted the full price and then charged the discounted
   * one — the server got it right, the screen did not, and being surprised
   * about money is not made acceptable by the surprise being pleasant.
   *
   * The membership is a SERVER-PROVIDED PROP and needs no session to read.
   * The uid is needed only to look up personal promos, so its absence costs
   * a promo, never the membership rate.
   */
  useEffect(() => {
    if (!open || !service || washCovered) { setDiscount(undefined); return; }
    let cancelled = false;

    void (async () => {
      const today = iso(new Date());
      const activeMember = membership?.status === 'active' && membership.endDate >= today
        ? membership
        : null;

      let promos: Awaited<ReturnType<typeof getEligiblePromos>> = [];
      const uid = user?.uid ?? await currentUid();
      if (uid) {
        try {
          promos = await getEligiblePromos({
            serviceId: service.id,
            category: service.category,
            userId: uid,
            date: today,
          });
        } catch {
          /* No promos reachable — the membership still stands. */
        }
      }

      if (cancelled) return;
      setDiscount(computeBestDiscount({
        price: service.price,
        membershipPlan: activeMember?.plan ?? null,
        eligiblePromos: promos,
      }));
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service?.id, user?.uid, washCovered, membership?.id]);

  const total = washCovered ? 0 : applyDiscount(service?.price ?? 0, discount);

  const slots = date && service
    ? generateTimeSlots(workMinutes).filter((t: string) => !(full.fullSlots[date] ?? []).includes(t))
    : [];

  /**
   * 4 · one key per intent, so a retry joins rather than duplicates.
   *
   * SANITISED, because the server's rule is `^[A-Za-z0-9_-]+$` and the time
   * this is built from contains a colon. Every appointment booked from the
   * customer application was refused `bad-idempotency-key` 400 — the studio
   * looked like it was declining work, and the sheet said "we couldn't arrange
   * that", which is the same sentence it uses for a genuine outage.
   *
   * The substitution is deterministic, so the key is still THE SAME KEY for
   * the same intent and a retry after a timeout still joins the first booking
   * rather than making a second one.
   */
  const idempotencyKey = () =>
    /* THE ESTIMATE IS PART OF THE INTENT. Two different quotes for the same
       car, service and slot — a full body, then a front end after thinking
       better of it — are two different bookings, and without this the second
       would be swallowed as a replay of the first and the customer would be
       given the coverage they had just rejected. */
    `${vehicleId ?? 'v'}_${service?.id ?? 's'}_${date ?? 'd'}_${time ?? 't'}_${estimate?.id ?? 'q'}`
      .replace(/[^A-Za-z0-9_-]/g, '-');

  const chosenVehicle = vehicles.find(v => v.id === vehicleId) ?? null;

  const ready = !!(vehicleId && service && date && time) && online && !busy;

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      /* THE REQUEST HAS TO SAY WHO IS MAKING IT.
         `/api/booking/create` authenticates with a Bearer ID token — the
         session cookie is for SERVER RENDERING and this route never reads it.
         Sent without one, every booking in the product came back 401 and the
         customer was told "we couldn't arrange that", which reads as the
         studio being full rather than as a request that never identified
         anybody. Every other client caller already did this; this one did not.
         The token is the same one `/api/session` was given — minted by the
         client SDK, refreshed by it, and verified server-side. */
      const token = await idToken();
      if (!token) {
        setError('Your session has expired. Sign in again and we’ll hold the slot.');
        return;
      }

      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicleId,
          serviceId: service!.id,
          scheduledDate: date,
          scheduledTime: time,
          paymentMethod: 'cash',
          useMembershipWash: washCovered,
          /* THE ID, NEVER THE AMOUNT. The server reads the estimate it wrote
             and prices the booking from that; a total sent from here has no
             name on the route and could not be read if it did. */
          ...(estimate ? { estimateId: estimate.id } : {}),
          idempotencyKey: idempotencyKey(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.error === 'slot-taken'
            ? 'That slot has just gone. Choose another and we’ll hold it.'
            : 'We couldn’t arrange that. Try again in a moment.',
        );
        return;
      }
      /* THE REFERENCE. Derived from the booking id rather than stored — a new
         field would need a migration and a second source of truth for the same
         fact. Six characters is enough to read down a phone. */
      const created = await res.json().catch(() => ({}));
      const id: string = created?.id ?? '';
      setDone({
        reference: id.slice(-6).toUpperCase(),
        when: `${dayLabel(date!)} at ${time}`,
        service: service!.name,
        bookingId: id,
      });
      /* The rooms render on the server, so they only show the new visit once
         the server has been asked again. Refreshed here, not on close, so Home,
         Garage and History are already correct behind the receipt. */
      router.refresh();
    } catch {
      setError('That didn’t reach us. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="Arrange a visit">
      <div style={{ paddingInline: INSET, maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
        {done ? (
          /* THE RECEIPT. §20.1 — a customer who has just committed to something
             is told plainly what the studio now holds, in the studio's words. */
          <div aria-live="polite">
            <Heading level="title">The studio has it.</Heading>
            <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
              {done.service}, {done.when}. We&rsquo;ll confirm shortly.
            </Text>
            <div style={{ marginTop: space.gap }}>
              <Text role="whisper" tone="ink3">Reference</Text>
              <Text role="data" tone="ink" style={{ marginTop: space.hair }}>{done.reference}</Text>
            </div>
            <Text role="whisper" tone="ink3" style={{ marginTop: space.gap }}>
              Pending &mdash; you can change or cancel it until the studio starts work.
            </Text>
            <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
              {/* DESIGN 08 → 09. The confirmation is a screen of its own, with
                  the calendar export and the way to change it; this sheet has
                  said what it can and the booking takes over. */}
              {done.bookingId ? (
                <Button tier="primary" href={`/booking/${done.bookingId}`}>See the booking</Button>
              ) : null}
              <Button tier="quiet" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
        <>
        {/* Design 1f — the label names WHAT is being arranged and for which
            car, and the display says only the act. The two were one line
            before, which made the sheet read as a form title rather than as
            the studio setting a bay aside. */}
        <span className="am-label" style={{ letterSpacing: '0.3em' }}>
          {[service?.name, chosenVehicle?.name].filter(Boolean).join(' · ') || 'The studio'}
        </span>
        <h2
          className="am-display"
          style={{ margin: `${space.hair}px 0 0`, fontSize: 29 }}
        >
          Reserve the bay
        </h2>

        <OfflineNote inline caption="You’re offline. We can’t hold a slot until you’re back." />

        {/* NO CAR AT ALL — THE DEAD END THIS SHEET USED TO BE.
            With an empty garage `vehicleId` stayed null, the picker below
            never rendered (it needs TWO cars to appear), and `ready` could
            never become true — so a customer chose a service, chose a day,
            chose an hour, and then found "Arrange it" greyed out with nothing
            anywhere saying why. Three separate invitations lead here from
            empty rooms, so it was the first thing a new customer met.
            §10.5 — the way out is a control, not an explanation. */}
        {vehicles.length === 0 ? (
          <div style={{ marginTop: space.rest }}>
            <Text role="body" tone="ink">Which car is this for?</Text>
            <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
              Add it once and it stays &mdash; every visit after this one
              remembers it.
            </Text>
            <div style={{ marginTop: space.gap }}>
              <Button tier="primary" href="/garage?add=1">Add your car</Button>
            </div>
          </div>
        ) : null}

        {/* WHICH CAR — only when there is a choice to make. */}
        {vehicles.length > 1 ? (
          <Group label="Which car">
            <Row>
              {vehicles.map(v => (
                <Chip key={v.id} on={vehicleId === v.id} onClick={() => setVehicleId(v.id)}>
                  {v.name}
                </Chip>
              ))}
            </Row>
          </Group>
        ) : null}

        {vehicles.length === 0 ? null : (
        <>
        {/* WHAT — grouped by category, never a flat list.
            THE CHOICE IS LEGIBLE NOW. These were bare name chips: a customer
            picked a ₹64,000 service from a single word, with no idea what it
            cost or how long their car would be gone, and found out only after
            committing. §22.1 keeps prices out of the Studio's PROSE — this is
            the booking sheet, which has always had to state the figure, and
            stating it at the moment of choosing is the difference between a
            menu and a guess. */}
        <Group label="What it needs">
          {menu.map(([category, list]) => (
            <div key={category} style={{ marginTop: space.gap }}>
              <Text role="whisper" tone="ink3">{category}</Text>
              <div style={{ display: 'grid', gap: space.breath, marginTop: space.breath }}>
                {list.map(s => (
                  <ServiceChoice
                    key={s.id}
                    service={s}
                    on={service?.id === s.id}
                    covered={
                      s.category === 'Washing'
                      && !!membership
                      && membership.status === 'active'
                      && washesLeftOf(membership) > 0
                    }
                    onClick={() => { setService(s); setDate(null); setTime(null); }}
                  />
                ))}
              </div>
            </div>
          ))}
        </Group>

        {/* WHEN — the day, then the hour, and the hour says when the car is
            back. A full day is said to be full rather than merely being
            unpressable, which is the difference between an answer and a dead
            control (§10.5). */}
        {service ? (
          <Group label="When">
            <div style={{
              display: 'flex',
              gap: space.breath,
              marginTop: space.breath,
              overflowX: 'auto',
              paddingBottom: space.hair,
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}>
              {nextDays().map(d => {
                const gone = full.fullDates.includes(d);
                const on = date === d;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    disabled={gone}
                    onClick={() => { setDate(d); setTime(null); }}
                    className="am-tap"
                    style={{
                      flex: '0 0 auto',
                      minWidth: 62,
                      minHeight: TARGET_MIN + 20,
                      paddingBlock: space.line,
                      paddingInline: space.breath + 2,
                      borderRadius: radius.card - 2,
                      /* Design 1f — the chosen day is LIT rather than
                         inverted. An inverted tile is a selection control; a
                         lit one is the day the studio has set aside, which is
                         what it actually is. */
                      border: `${HAIRLINE}px solid ${on ? 'rgba(224,164,92,0.4)' : 'transparent'}`,
                      background: on
                        ? 'linear-gradient(160deg, rgba(224,164,92,0.28), rgba(224,164,92,0.1))'
                        : 'rgba(255,255,255,0.04)',
                      boxShadow: on ? '0 0 24px -6px rgba(224,164,92,0.6)' : undefined,
                      color: on ? color.ink : gone ? color.ink3 : color.ink2,
                      cursor: gone ? 'default' : 'pointer',
                      opacity: gone ? 0.4 : 1,
                      display: 'grid',
                      gap: 4,
                      justifyItems: 'center',
                      fontFamily: typeScale.body.family,
                    }}
                  >
                    <span
                      className="am-label"
                      style={{ fontSize: 9, letterSpacing: '0.14em', color: 'inherit', opacity: 0.75 }}
                    >
                      {dayName(d)}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 400, lineHeight: 1 }}>{dayNumeral(d)}</span>
                    {gone ? (
                      <span className="am-label" style={{ fontSize: 8, color: 'inherit' }}>full</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {date ? (
              slots.length ? (
                <div style={{ marginTop: space.gap, display: 'grid', gap: space.line }}>
                  {PART_OF_DAY.map(([label, within]) => {
                    const band = slots.filter(t => within(Number(t.split(':')[0])));
                    if (!band.length) return null;
                    return (
                      <div key={label}>
                        <Text role="whisper" tone="ink3">{label}</Text>
                        <Row>
                          {band.map((t: string) => {
                            const back = endTime(t, workMinutes);
                            return (
                              <Chip key={t} on={time === t} onClick={() => setTime(t)}>
                                {back ? `${t} – ${back}` : t}
                              </Chip>
                            );
                          })}
                        </Row>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
                  Nothing left that day. Try another.
                </Text>
              )
            ) : null}
          </Group>
        ) : null}

        {/* WHAT YOU ARE ARRANGING — the whole intent in one place, before it
            is committed rather than after. The sheet used to end on a bare
            figure: the car, the work, the day and the hour had each been
            chosen several screens of scrolling apart and were never once
            stated back together. A booking nobody can check is a booking
            people make wrong.

            The figure remains a PREVIEW — `/api/booking/create` recomputes
            every rupee and ignores anything sent from here. */}
        {service && date && time ? (
          <div
            className="am-glass"
            style={{
              marginTop: space.rest,
              padding: space.gap + 2,
              borderRadius: radius.pane,
            }}
          >
            <Text role="whisper" tone="ink3">You&rsquo;re arranging</Text>
            <div style={{ marginTop: space.breath, display: 'grid', gap: space.breath }}>
              <SummaryLine
                label={chosenVehicle?.name ?? 'Your car'}
                said={estimate ? `${service.name} · ${estimate.scopeLine}` : service.name}
              />
              <SummaryLine
                label={dayLabel(date)}
                said={[
                  endTime(time, workMinutes)
                    ? `${time} – ${endTime(time, workMinutes)}`
                    : time,
                  estimate?.bay ?? spokenDuration(workMinutes),
                ].filter(Boolean).join(' · ')}
              />
              <div
                style={{
                  marginTop: space.hair,
                  paddingTop: space.line,
                  borderTop: `${HAIRLINE}px solid ${color.edge}`,
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: space.line,
                }}
              >
                <Text role="body" tone="ink2">
                  {estimate ? 'Estimate'
                    : washCovered ? 'Membership wash'
                    : discount ? discount.label : 'Total'}
                </Text>
                <span
                  style={{
                    fontFamily: typeScale.display.family,
                    fontSize: 24,
                    fontWeight: 300,
                    letterSpacing: '-0.01em',
                    color: color.ink,
                  }}
                >
                  {/* THE FROZEN FIGURE WINS. When the customer arrived from
                      the scope screen, the estimate is what the studio wrote
                      and what the booking will be made at; recomputing a
                      preview beside it could only ever disagree. */}
                  {estimate ? estimate.total : washCovered ? 'Covered' : spokenPrice(total) ?? '\u2014'}
                </span>
              </div>
            </div>
            <Text role="whisper" tone="ink3" style={{ marginTop: space.line }}>
              {washCovered
                ? 'Taken from this month\u2019s washes. Nothing to settle.'
                : 'Nothing is charged now. You approve the final figure at handover.'}
            </Text>
          </div>
        ) : service ? (
          /* Chosen the work but not yet the hour — say what it costs and how
             long it takes anyway, so the next choice is made knowing both. */
          <div style={{ marginTop: space.rest }}>
            {washCovered ? (
              <Text role="body" tone="ink">Covered by your membership.</Text>
            ) : (
              <>
                <Text role="body" tone="ink">
                  {[spokenPrice(total), discount?.label, spokenDuration(service.duration)]
                    .filter(Boolean).join(' \u00b7 ')}
                </Text>
                <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
                  Settled at the studio &mdash; UPI or cash.
                </Text>
              </>
            )}
          </div>
        ) : null}

        </>
        )}

        {error ? (
          <Text role="body" tone="ink2" aria-live="polite" style={{ marginTop: space.gap }}>
            {error}
          </Text>
        ) : null}

        <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
          {/* Offered only once it can succeed. A permanently disabled primary
              is a control that never explains itself (§10.5). */}
          {vehicles.length > 0 ? (
            <Button tier="primary" onClick={confirm} loading={busy} disabled={!ready}>
              Arrange it
            </Button>
          ) : null}
          <Button tier="quiet" onClick={onClose}>Not now</Button>
        </div>
        </>
        )}
      </div>
    </BottomSheet>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: space.rest }}>
      <span className="am-label" style={{ letterSpacing: '0.24em', fontSize: 9.5 }}>{label}</span>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.breath, marginTop: space.breath }}>
      {children}
    </div>
  );
}

/** A figure we actually have, or nothing at all. Never `₹NaN`. */
const spokenPrice = (n: number): string | null =>
  Number.isFinite(n) ? formatCurrency(n) : null;

/** One line of the summary: what it is, and what it says. */
function SummaryLine({ label, said }: { label: string; said: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space.line }}>
      <Text role="body" tone="ink">{label}</Text>
      <Text role="body" tone="ink2" style={{ textAlign: 'right' }}>{said}</Text>
    </div>
  );
}

/**
 * ONE SERVICE, AS A DECISION RATHER THAN A WORD.
 *
 * What a customer needs in order to choose is the name, what it costs, and how
 * long their car is gone — and the third is the one nobody ever puts on the
 * control, which is why people book a full-day job for a morning they do not
 * have. A membership wash says it is covered here, at the point of choosing,
 * rather than surprising somebody pleasantly two steps later.
 */
function ServiceChoice({
  service, on, covered, onClick,
}: {
  service: Service;
  on: boolean;
  covered: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: '100%',
        textAlign: 'left',
        minHeight: TARGET_MIN,
        padding: space.line,
        borderRadius: radius.card,
        border: `${HAIRLINE}px solid ${on ? color.ink : color.edge}`,
        background: on ? 'rgba(244,245,246,0.06)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: space.line,
        fontFamily: typeScale.body.family,
      }}
    >
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: space.breath, flexWrap: 'wrap' }}>
          <span style={{ fontSize: typeScale.body.size, fontWeight: on ? 640 : 560, color: color.ink }}>
            {service.name}
          </span>
          {service.popular ? (
            <span style={{
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: color.ink3,
              border: `${HAIRLINE}px solid ${color.edge}`,
              borderRadius: radius.pill,
              padding: '2px 7px',
            }}>
              Most asked for
            </span>
          ) : null}
        </span>
        <span style={{ fontSize: typeScale.whisper.size, color: color.ink3 }}>
          {[spokenDuration(service.duration), service.warranty || null]
            .filter(Boolean).join(' \u00b7 ') || 'Ask the studio'}
        </span>
      </span>
      <span style={{
        flexShrink: 0,
        fontSize: typeScale.body.size,
        fontWeight: 620,
        color: covered ? color.assent : color.ink,
      }}>
        {covered ? 'Covered' : spokenPrice(service.price) ?? '—'}
      </span>
    </button>
  );
}

/** One choice. §21.3 — a real target; §21.6 — its state is in `aria-pressed`. */
function Chip({
  on, disabled, onClick, children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      style={{
        minHeight: TARGET_MIN,
        paddingInline: space.gap,
        borderRadius: radius.card,
        /* Design 1f — a drop-off hour is champagne, not amber. The DAY is the
           studio setting time aside (amber, it is doing something); the hour
           within it is simply the one you picked. Two lights, two meanings. */
        border: `${HAIRLINE}px solid ${on ? 'rgba(232,217,190,0.32)' : color.edge}`,
        background: on
          ? 'linear-gradient(160deg, rgba(232,217,190,0.22), rgba(232,217,190,0.06))'
          : 'rgba(255,255,255,0.045)',
        color: on ? '#F3EADA' : disabled ? color.ink3 : color.ink2,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
