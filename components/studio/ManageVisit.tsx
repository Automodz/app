'use client';
/**
 * MANAGING A VISIT — move it, or let it go.
 *
 * Source: reference/customer-old/app/app/page.tsx:654-810 (ManageVisitSheet)
 *
 * WHERE THE BUSINESS RULE ACTUALLY LIVES. Not here. `firestore.rules` allows a
 * customer to touch their own booking only while its status is `pending` or
 * `confirmed`, only on `scheduledDate`, `scheduledTime`, `status`, `cancelledAt`
 * and `updatedAt`, and only to move it to `cancelled` — never to any other
 * status. This sheet mirrors that rule so the customer is not offered something
 * the server will refuse; it does not enforce it, because a rule enforced in a
 * renderer is a rule a fetch can walk past.
 *
 * The three modes are ported: idle, reschedule, confirm-cancel. Cancelling is
 * behind a confirmation because it is the one act here that cannot be undone.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelBooking, rescheduleBooking } from '@/lib/services/bookings';
import { generateTimeSlots } from '@/lib/utils';
import { BottomSheet, Heading, Text, Button, OfflineNote, useOnline } from '@/components/system';
import {
  color, space, INSET, MEASURE, HAIRLINE, TARGET_MIN, radius,
  type as typeScale,
} from '@/design';

const iso = (d: Date) => d.toISOString().slice(0, 10);

const nextDays = (n = 14) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return iso(d);
  });

const dayLabel = (i: string) =>
  new Date(`${i}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export interface ManageVisitModel {
  id: string;
  service: string;
  vehicleName: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  /**
   * Whether the customer may still change it. Projected from the booking's
   * status, mirroring `firestore.rules` — see the note above.
   */
  changeable: boolean;
}

type Mode = 'idle' | 'reschedule' | 'confirmCancel';

export function ManageVisit({
  open, onClose, visit,
}: {
  open: boolean;
  onClose: () => void;
  visit: ManageVisitModel | null;
}) {
  const router = useRouter();
  const online = useOnline();

  const [mode, setMode] = useState<Mode>('idle');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('idle');
    setDate(visit?.scheduledDate ?? null);
    setTime(visit?.scheduledTime ?? null);
    setError(null);
  }, [open, visit]);

  if (!visit) return null;

  const slots = date ? generateTimeSlots(visit.durationMinutes) : [];

  const move = async () => {
    if (!date || !time) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleBooking(visit.id, date, time);
      onClose();
      router.refresh();
    } catch {
      setError('That didn’t move. The studio may have taken the slot — try another.');
    } finally {
      setBusy(false);
    }
  };

  const drop = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelBooking(visit.id);
      onClose();
      router.refresh();
    } catch {
      setError('That didn’t cancel. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} label="Manage the visit">
      <div style={{ paddingInline: INSET, maxWidth: MEASURE + INSET * 2, marginInline: 'auto', width: '100%' }}>
        <Heading level="title">{visit.service}</Heading>
        <Text role="body" tone="ink2" style={{ marginTop: space.line }}>
          {visit.vehicleName} · {dayLabel(visit.scheduledDate)} at {visit.scheduledTime}
        </Text>

        {!visit.changeable ? (
          /* §20.2 — say why, in the customer's terms, rather than showing a
             control that will be refused. */
          <Text role="body" tone="ink2" style={{ marginTop: space.gap }}>
            The studio has started on this one, so it can no longer be changed
            here. Call us and we&rsquo;ll sort it.
          </Text>
        ) : !online ? (
          <OfflineNote inline caption="You’re offline. Changes need a connection." />
        ) : mode === 'idle' ? (
          <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
            <Button tier="primary" onClick={() => setMode('reschedule')}>Move it</Button>
            <Button tier="quiet" onClick={() => setMode('confirmCancel')}>Cancel the visit</Button>
          </div>
        ) : mode === 'reschedule' ? (
          <>
            <div style={{ marginTop: space.rest }}>
              <Text role="data" tone="ink3">A different day</Text>
              <Row>
                {nextDays().map(d => (
                  <Chip key={d} on={date === d} onClick={() => { setDate(d); setTime(null); }}>
                    {dayLabel(d)}
                  </Chip>
                ))}
              </Row>
            </div>
            {date ? (
              <div style={{ marginTop: space.gap }}>
                <Text role="data" tone="ink3">A time</Text>
                <Row>
                  {slots.map((t: string) => (
                    <Chip key={t} on={time === t} onClick={() => setTime(t)}>{t}</Chip>
                  ))}
                </Row>
              </div>
            ) : null}
            <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
              <Button tier="primary" onClick={move} loading={busy} disabled={!date || !time || busy}>
                Move it
              </Button>
              <Button tier="quiet" onClick={() => setMode('idle')}>Back</Button>
            </div>
          </>
        ) : (
          <>
            <Text role="body" tone="ink" style={{ marginTop: space.gap }}>
              Cancel this visit? The slot goes back to the studio straight away.
            </Text>
            <div style={{ marginTop: space.rest, display: 'flex', gap: space.gap, flexWrap: 'wrap' }}>
              <Button tier="primary" onClick={drop} loading={busy}>Yes, cancel it</Button>
              <Button tier="quiet" onClick={() => setMode('idle')}>Keep it</Button>
            </div>
          </>
        )}

        {error ? (
          <Text role="body" tone="ink2" aria-live="polite" style={{ marginTop: space.gap }}>
            {error}
          </Text>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.breath, marginTop: space.breath }}>
      {children}
    </div>
  );
}

function Chip({
  on, onClick, children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        minHeight: TARGET_MIN,
        paddingInline: space.gap,
        borderRadius: radius.pill,
        border: `${HAIRLINE}px solid ${on ? color.ink : color.edge}`,
        background: on ? color.ink : 'transparent',
        color: on ? color.paper : color.ink2,
        fontFamily: typeScale.body.family,
        fontSize: typeScale.data.size,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
