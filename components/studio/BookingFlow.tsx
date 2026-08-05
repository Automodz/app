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
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
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

export interface BookingFlowProps {
  open: boolean;
  onClose: () => void;
  services: Service[];
  vehicles: Vehicle[];
  membership: Subscription | null;
  /** The category the proposal named, when one sent the customer here. */
  prefillCategory?: string | null;
}

export function BookingFlow({
  open, onClose, services, vehicles, membership, prefillCategory = null,
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
  const [done, setDone] = useState<{ reference: string; when: string; service: string } | null>(null);

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

  /* Opening resets, and honours the category the proposal named. */
  useEffect(() => {
    if (!open) return;
    setVehicleId(vehicles[0]?.id ?? null);
    const active = services.filter(s => s.active !== false);
    setService(prefillCategory ? active.find(s => s.category === prefillCategory) ?? null : null);
    setDate(null);
    setTime(null);
    setError(null);
    setDone(null);
  }, [open, prefillCategory, services, vehicles]);

  /* Which days and slots are already taken. */
  useEffect(() => {
    if (!open || !service) return;
    let cancelled = false;
    void fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dates: nextDays(),
        category: service.category,
        durationMinutes: service.duration,
      }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setFull({ fullDates: d.fullDates ?? [], fullSlots: d.fullSlots ?? {} }); })
      .catch(() => { /* the studio may still take it; the server decides */ });
    return () => { cancelled = true; };
  }, [open, service]);

  /* 2 · a membership wash is covered when the plan is active AND washes remain */
  const washCovered = !!service
    && service.category === 'Washing'
    && !!membership
    && membership.status === 'active'
    /* One subtraction, one place (§22.2). The server decides this again and
       authoritatively; this only decides what the sheet SAYS. */
    && washesLeftOf(membership) > 0;

  /* 3 · the membership discount must never depend on the promo lookup */
  useEffect(() => {
    if (!open || !service || !user || washCovered) { setDiscount(undefined); return; }
    let cancelled = false;

    void (async () => {
      const today = iso(new Date());
      const activeMember = membership?.status === 'active' && membership.endDate >= today
        ? membership
        : null;

      let promos: Awaited<ReturnType<typeof getEligiblePromos>> = [];
      try {
        promos = await getEligiblePromos({
          serviceId: service.id,
          category: service.category,
          userId: user.uid,
          date: today,
        });
      } catch {
        /* No promos reachable — the membership still stands. This wrapping is
           the whole point: a promo outage must not cost a member their rate. */
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
    ? generateTimeSlots(service.duration).filter((t: string) => !(full.fullSlots[date] ?? []).includes(t))
    : [];

  /* 4 · one key per intent, so a retry joins rather than duplicates */
  const idempotencyKey = () =>
    `${vehicleId ?? 'v'}_${service?.id ?? 's'}_${date ?? 'd'}_${time ?? 't'}`;

  const ready = !!(vehicleId && service && date && time) && online && !busy;

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          serviceId: service!.id,
          scheduledDate: date,
          scheduledTime: time,
          paymentMethod: 'cash',
          useMembershipWash: washCovered,
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
            <div style={{ marginTop: space.rest }}>
              <Button tier="primary" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
        <>
        <Heading level="title">Arrange a visit</Heading>

        <OfflineNote inline caption="You’re offline. We can’t hold a slot until you’re back." />

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

        {/* WHAT — grouped by category, never a flat list */}
        <Group label="What it needs">
          {menu.map(([category, list]) => (
            <div key={category} style={{ marginTop: space.line }}>
              <Text role="whisper" tone="ink3">{category}</Text>
              <Row>
                {list.map(s => (
                  <Chip
                    key={s.id}
                    on={service?.id === s.id}
                    onClick={() => { setService(s); setDate(null); setTime(null); }}
                  >
                    {s.name}
                  </Chip>
                ))}
              </Row>
            </div>
          ))}
        </Group>

        {/* WHEN */}
        {service ? (
          <Group label="When">
            <Row>
              {nextDays().map(d => (
                <Chip
                  key={d}
                  on={date === d}
                  disabled={full.fullDates.includes(d)}
                  onClick={() => { setDate(d); setTime(null); }}
                >
                  {dayLabel(d)}
                </Chip>
              ))}
            </Row>
            {date ? (
              slots.length ? (
                <Row>
                  {slots.map((t: string) => (
                    <Chip key={t} on={time === t} onClick={() => setTime(t)}>{t}</Chip>
                  ))}
                </Row>
              ) : (
                <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
                  Nothing left that day. Try another.
                </Text>
              )
            ) : null}
          </Group>
        ) : null}

        {/* WHAT IT COMES TO — a preview; the server decides the real figure. */}
        {service ? (
          <div style={{ marginTop: space.rest }}>
            {washCovered ? (
              <Text role="body" tone="ink">
                Covered by your membership.
              </Text>
            ) : (
              <>
                <Text role="body" tone="ink">
                  {formatCurrency(total)}
                  {discount ? ` · ${discount.label}` : ''}
                </Text>
                <Text role="whisper" tone="ink3" style={{ marginTop: space.hair }}>
                  Settled at the studio — UPI or cash.
                </Text>
              </>
            )}
          </div>
        ) : null}

        {error ? (
          <Text role="body" tone="ink2" aria-live="polite" style={{ marginTop: space.gap }}>
            {error}
          </Text>
        ) : null}

        <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
          <Button tier="primary" onClick={confirm} loading={busy} disabled={!ready}>
            Arrange it
          </Button>
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
      <Text role="data" tone="ink3">{label}</Text>
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
        borderRadius: radius.pill,
        border: `${HAIRLINE}px solid ${on ? color.ink : color.edge}`,
        background: on ? color.ink : 'transparent',
        color: on ? color.paper : disabled ? color.ink3 : color.ink2,
        fontFamily: typeScale.body.family,
        fontSize: typeScale.data.size,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
