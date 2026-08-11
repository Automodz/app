'use client';
/**
 * MANAGE BOOKING — design screen 10.
 *
 * Source: docs/DESIGN-PARITY-AUDIT.md screen 10
 *
 * ── WHY THIS IS A ROOM AND NOT A SHEET ───────────────────────────────────
 * It replaces `ManageVisit`, which was a bottom sheet over the Studio at
 * `/studio?manage=<id>`. Two things were wrong with that and only one of them
 * was cosmetic:
 *
 *   · A sheet has no address of its own worth sharing and no back
 *     navigation of its own, and the design draws screen 10 as a full screen
 *     with a title and a way back.
 *   · The sheet decided `changeable` for itself and offered "Move it" whenever
 *     the status looked right — with no notion of the 24-hour rule, no notion
 *     of whether the destination was free, and a `rescheduleBooking` behind it
 *     that wrote the new date straight to Firestore from the browser.
 *
 * The rule now lives in `lib/os/lifecycle` and is enforced by the Booking
 * Service. This screen ASKS the projection what may be done and renders the
 * answer, including the reason when the answer is no (§10.5 — a control that
 * cannot explain itself is worse than no control).
 *
 * ── THE OPENINGS ARE REAL ────────────────────────────────────────────────
 * The day chips are days the studio can actually take this work, computed
 * server-side from the same occupancy the writer accepts against, with this
 * booking excluded so it does not block its own move. There is no calendar of
 * every date with most of them refused on submit.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { rescheduleBooking, cancelBooking } from '@/lib/services/bookings';
import {
  color, space, HAIRLINE, TARGET_MIN, radius, type as typeScale,
} from '@/design';
import { Screen, Pane, Label, Statement, Rail, Action } from '@/components/os';
import { OfflineNote } from '@/components/system';

export interface ManageOpening {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  /** "Thu 12 Feb" — worded by the projection, never here. */
  label: string;
}

export interface ManageBookingModel {
  id: string;
  /** "CONFIRMED" · "AWAITING THE STUDIO" · "IN THE STUDIO" · "CANCELLED" */
  standing: string;
  /** The work. */
  headline: string;
  vehicleName: string;
  /** "Wednesday 12 February at 9:00 am", or a range across days. */
  when: string;
  /** "Free to change until Tuesday 11 February, 9:00 am", when it still is. */
  freeUntil?: string;
  /** May the customer still move it, and why not if not. */
  moveable: boolean;
  moveBlockedBecause?: string;
  cancellable: boolean;
  cancelBlockedBecause?: string;
  /** Days the studio can actually take this work. Empty is a real answer. */
  openings: ManageOpening[];
  /** Set once the concierge editor exists for this booking. */
  conciergeHref?: string;
  conciergeLine?: string;
  /** Set once the work can be re-scoped. */
  scopeHref?: string;
  scopeLine?: string;
  backHref: string;
  homeHref: string;
}

type Mode = 'idle' | 'move' | 'confirmCancel';

/** The studio's word for each refusal. Never a code, never a stack. */
const REFUSAL: Record<string, string> = {
  'inside-window': 'That is inside the last day before your slot, so the studio is already preparing for it. Call us and we will sort it.',
  'work-started': 'The studio has started on this one, so it can no longer be changed here.',
  'already-cancelled': 'This visit was already cancelled.',
  'already-expired': 'That day passed without us confirming it.',
  'already-completed': 'This visit is finished.',
  'slot-taken': 'That opening has just gone. Pick another and we will hold it.',
  'slot-in-the-past': 'That day has passed. Pick another.',
  'too-late': 'The studio has started on this one. Call us and we will sort it.',
  'not-signed-in': 'Your session has expired. Sign in again and we will hold the slot.',
};

const said = (code: string) =>
  REFUSAL[code] ?? 'That did not go through. Try again in a moment.';

export function ManageBooking({ model }: { model: ManageBookingModel }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [chosen, setChosen] = useState<ManageOpening | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = async () => {
    if (!chosen || busy) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleBooking(model.id, chosen.date, chosen.time);
      /* The rooms render on the server, so the new time only appears once the
         server has been asked again. Replaced rather than pushed: the old
         confirmation is about a slot that no longer exists. */
      router.replace(model.backHref);
      router.refresh();
    } catch (e) {
      setError(said((e as Error)?.message ?? ''));
    } finally {
      setBusy(false);
    }
  };

  const drop = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await cancelBooking(model.id);
      router.replace(model.homeHref);
      router.refresh();
    } catch (e) {
      setError(said((e as Error)?.message ?? ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen top={space.gap}>
      {/* Moving or cancelling needs a connection, and a control that silently
          fails is worse than one that says why it cannot act. */}
      <OfflineNote />
      <Statement eyebrow={model.standing} size={28}>{model.headline}</Statement>

      <Pane style={{
        marginTop: space.gap,
        padding: `${space.gap + 2}px ${space.gap + 4}px`,
        display: 'flex', flexDirection: 'column', gap: space.breath,
      }}>
        <span style={{ fontSize: 15, color: color.ink }}>{model.when}</span>
        <Label style={{ fontSize: 9.5, letterSpacing: '0.18em' }}>{model.vehicleName}</Label>
        {model.freeUntil ? (
          <p style={{ margin: `${space.breath}px 0 0`, fontSize: 13, lineHeight: 1.6, color: color.ink3 }}>
            {model.freeUntil}
          </p>
        ) : null}
      </Pane>

      {/* ── WHAT CAN BE DONE ────────────────────────────────────────────
          Each row states what it is and what it costs, in a sub-line. A row
          that cannot act says why instead of being greyed out in silence. */}
      <section
        aria-labelledby="manage-actions"
        style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="manage-actions" style={{ margin: 0 }}><Rail>Change it</Rail></h2>

        {mode === 'idle' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.line }}>
            {model.moveable ? (
              <Action onClick={() => setMode('move')}>Move to another date</Action>
            ) : (
              <Pane style={{ padding: `${space.gap}px ${space.gap + 2}px` }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
                  {model.moveBlockedBecause}
                </p>
              </Pane>
            )}

            {model.conciergeHref ? (
              <Action href={model.conciergeHref} quiet>
                {model.conciergeLine ?? 'Change the collection'}
              </Action>
            ) : null}

            {model.scopeHref ? (
              <Action href={model.scopeHref} quiet>
                {model.scopeLine ?? 'Edit the work'}
              </Action>
            ) : null}

            {model.cancellable ? (
              <Action onClick={() => setMode('confirmCancel')} quiet>Cancel the visit</Action>
            ) : model.cancelBlockedBecause ? (
              <Pane style={{ padding: `${space.gap}px ${space.gap + 2}px` }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
                  {model.cancelBlockedBecause}
                </p>
              </Pane>
            ) : null}
          </div>
        ) : mode === 'move' ? (
          <>
            {model.openings.length === 0 ? (
              <Pane style={{ padding: `${space.gap}px ${space.gap + 2}px` }}>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
                  The studio has nothing open for this work in the next three
                  weeks. Keep the slot you have, or call us.
                </p>
              </Pane>
            ) : (
              <>
                <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>Next openings</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.breath }}>
                  {model.openings.map(o => {
                    const on = chosen?.date === o.date && chosen?.time === o.time;
                    return (
                      <button
                        key={`${o.date}_${o.time}`}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setChosen(o)}
                        className="am-tap"
                        style={{
                          minHeight: TARGET_MIN,
                          paddingInline: space.gap,
                          borderRadius: radius.card,
                          border: `${HAIRLINE}px solid ${on ? 'rgba(224,164,92,0.4)' : color.edge}`,
                          background: on
                            ? 'linear-gradient(160deg, rgba(224,164,92,0.28), rgba(224,164,92,0.1))'
                            : 'rgba(255,255,255,0.045)',
                          color: on ? color.ink : color.ink2,
                          fontFamily: typeScale.body.family,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
                        }}
                      >
                        <span>{o.label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.75 }}>
                          {o.time}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ marginTop: space.line, display: 'flex', flexDirection: 'column', gap: space.line }}>
              <Action onClick={move} disabled={!chosen || busy}>
                {busy ? 'Moving it…' : 'Move it'}
              </Action>
              <Action onClick={() => { setMode('idle'); setChosen(null); setError(null); }} quiet>
                Back
              </Action>
            </div>
          </>
        ) : (
          <>
            <Pane style={{ padding: `${space.gap}px ${space.gap + 2}px` }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.ink }}>
                Cancel this visit? No charge &mdash; the bay goes back to the calendar.
              </p>
            </Pane>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space.line }}>
              <Action onClick={drop} disabled={busy}>
                {busy ? 'Cancelling…' : 'Yes, cancel it'}
              </Action>
              <Action onClick={() => { setMode('idle'); setError(null); }} quiet>Keep it</Action>
            </div>
          </>
        )}
      </section>

      {error ? (
        <p
          aria-live="polite"
          style={{ margin: `${space.gap}px 0 0`, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}
        >
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: space.rest / 2 }}>
        <Action href={model.backHref} quiet>Back to the booking</Action>
      </div>
    </Screen>
  );
}
