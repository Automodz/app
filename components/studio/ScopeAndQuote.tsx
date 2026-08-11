'use client';
/**
 * SCOPE & QUOTE — design screen 07.
 *
 * The screen where a customer decides HOW MUCH OF THE CAR, and learns what
 * that costs before committing to a day.
 *
 * ── NOTHING HERE DOES ARITHMETIC ─────────────────────────────────────────
 * Not one rupee is added up in this file. Every figure — the coverage price,
 * the extra stage, the member's rate, the total — comes back from
 * `POST /api/estimate`, which runs `priceVisit`, the single calculation the
 * booking and the invoice also run. A component that summed prices would be a
 * fifth implementation of the arithmetic, and the audit found four already
 * disagreeing.
 *
 * The consequence is visible in the code: choosing something asks the server
 * what it costs. That is a round trip per tap, and it is the right trade — the
 * alternative is a number on the screen that the server has never agreed to.
 *
 * ── PREVIEW, THEN COMMIT ─────────────────────────────────────────────────
 * Every tap asks for a PREVIEW, which stores nothing. Only "Choose a date"
 * writes the estimate, because that is the moment the figure starts having to
 * survive three more screens. Both go through the same function.
 *
 * ── "FINAL ON INSPECTION" IS NOT A DISCLAIMER ────────────────────────────
 * It is the studio's actual policy and the reason screen 12 exists: the figure
 * may only rise through an approval the customer grants. It is a constant here
 * so no state can produce a screen showing a total without it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/clientSession';
import { color, space, HAIRLINE, TARGET_MIN, radius, type as typeScale } from '@/design';
import { DOT } from '@/design';
import { Screen, Pane, Label, Rail, Action, RoomHeader } from '@/components/os';
import { OfflineNote, useOnline } from '@/components/system';

export interface ScopeOption {
  id: string;
  kind: 'front' | 'full' | 'custom';
  label: string;
  detail: string;
  /** "₹1,32,000", or "On quote" for a custom coverage. */
  price: string;
  /** Only a custom coverage carries these. */
  panels?: { id: string; label: string; price: string }[];
}

export interface AddOnOption {
  id: string;
  label: string;
  detail: string;
  price: string;
  /** The studio suggests it alongside these coverages. Advisory, never forced. */
  recommendedWith: string[];
}

export interface ScopeQuoteModel {
  serviceId: string;
  serviceName: string;
  /** "For the BMW M340i" */
  forCar: string;
  vehicleId: string;
  brandLine?: string;
  scopes: ScopeOption[];
  addOns: AddOnOption[];
  /** Where "Choose a date" goes, with the estimate id appended by this screen. */
  nextHrefBase: string;
  backHref: string;
  /** Said when the customer has no car at all — there is nothing to quote for. */
  noCarHref?: string;
}

/** What the server said the choice costs. Never computed here. */
interface Quoted {
  total: string;
  benefit?: string;
  bay: string;
  fees?: string;
}

const REFUSAL: Record<string, string> = {
  'custom-needs-panels': 'Choose the panels you want covered and we will price it.',
  'unknown-scope': 'That coverage is no longer offered. Pick another.',
  'unknown-add-on': 'That extra is no longer offered.',
  'service-not-offered': 'The studio has stopped offering this one.',
  'vehicle-not-yours': 'That car is not in your garage.',
  'not-signed-in': 'Your session has expired. Sign in again and we will price it.',
};

export function ScopeAndQuote({ model }: { model: ScopeQuoteModel }) {
  const router = useRouter();
  const online = useOnline();

  const [scopeId, setScopeId] = useState<string>(model.scopes[0]?.id ?? '');
  const [panelIds, setPanelIds] = useState<string[]>([]);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [quoted, setQuoted] = useState<Quoted | null>(null);
  const [pricing, setPricing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = model.scopes.find(s => s.id === scopeId) ?? null;
  const isCustom = chosen?.kind === 'custom';
  const complete = !!chosen && (!isCustom || panelIds.length > 0);

  /**
   * Ask the server what this costs.
   *
   * `seq` guards against an out-of-order answer: two taps in quick succession
   * produce two requests, and the slower one must not overwrite the newer
   * answer with a stale total. A price that flickers back to a previous choice
   * is a price nobody can trust.
   */
  const seq = useRef(0);
  const quote = useCallback(async (
    body: Record<string, unknown>, preview: boolean,
  ): Promise<{ id: string } | null> => {
    const mine = ++seq.current;
    
    const res = await authedFetch('/api/estimate', {
      method: 'POST',
      body: JSON.stringify({
        vehicleId: model.vehicleId,
        serviceId: model.serviceId,
        preview,
        ...body,
      }),
    });

    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      const code = (b as { error?: string }).error ?? '';
      if (mine === seq.current) {
        setError(REFUSAL[code] ?? 'We could not price that. Try again in a moment.');
        setQuoted(null);
      }
      return null;
    }

    const e = await res.json() as {
      id: string;
      scope: { bayDays: number };
      breakdown: {
        total: number; discount?: { label: string }; feesTotal: number; washCovered: boolean;
      };
    };
    if (mine !== seq.current) return null;   // a newer answer has already landed

    setError(null);
    setQuoted({
      total: e.breakdown.washCovered ? 'Covered' : rupees(e.breakdown.total),
      benefit: e.breakdown.washCovered
        ? 'Taken from this month’s washes'
        : e.breakdown.discount?.label,
      bay: e.scope.bayDays === 1 ? '1 day in the bay' : `${e.scope.bayDays} days in the bay`,
      fees: e.breakdown.feesTotal > 0 ? rupees(e.breakdown.feesTotal) : undefined,
    });
    return { id: e.id };
  }, [model.serviceId, model.vehicleId]);

  /* Re-price on every change of the choice. A custom coverage with no panels
     chosen has no price to show, and says so rather than showing a zero. */
  useEffect(() => {
    if (!online) return;
    if (!complete) { setQuoted(null); return; }
    let live = true;
    setPricing(true);
    void quote({ scopeId, panelIds, addOnIds }, true).finally(() => {
      if (live) setPricing(false);
    });
    return () => { live = false; };
  }, [scopeId, panelIds, addOnIds, complete, online, quote]);

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const proceed = async () => {
    if (!complete || committing) return;
    setCommitting(true);
    setError(null);
    try {
      /* THE REAL ONE. Written now, because from here the figure has to survive
         the date screen, the confirmation and the booking. */
      const made = await quote({ scopeId, panelIds, addOnIds }, false);
      if (made?.id) {
        router.push(`${model.nextHrefBase}${model.nextHrefBase.includes('?') ? '&' : '?'}estimate=${made.id}`);
      }
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Screen top={space.gap}>
      <OfflineNote />

      {/* MOVED UP FROM THE FOOT OF THE PAGE. It was a `quiet` Action after
          everything else, which is a footer link and not an escape route — a
          way out you reach by scrolling past the whole screen is one the
          customer has already given up looking for. One idiom, at the top,
          in every room. */}
      {/* One header: the way back, the eyebrow and the Display, at one
          scale. These five drew the same three elements by hand and disagreed
          on the size — 28, 29 and 30 — which nobody chose. */}
      <RoomHeader
        parent={{ href: model.backHref, name: 'The studio' }}
        eyebrow={model.forCar}
      >
        {model.serviceName}
      </RoomHeader>
      {model.brandLine ? (
        <Label style={{ marginTop: space.breath, fontSize: 9.5, letterSpacing: '0.18em' }}>
          {model.brandLine}
        </Label>
      ) : null}

      {/* ── HOW MUCH OF THE CAR ─────────────────────────────────────────
          One of three, always. A coverage with no price is "On quote" and
          says so — a zero would claim the studio does it for nothing. */}
      <section
        aria-labelledby="scope-coverage"
        style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
      >
        <h2 id="scope-coverage" style={{ margin: 0 }}><Rail>How much of the car</Rail></h2>
        <div role="radiogroup" aria-labelledby="scope-coverage" style={{ display: 'flex', flexDirection: 'column', gap: space.line - 1 }}>
          {model.scopes.map(s => (
            <Pane
              key={s.id}
              tone={scopeId === s.id ? 'lit' : 'plain'}
              as="button"
              role="radio"
              aria-checked={scopeId === s.id}
              onClick={() => { setScopeId(s.id); setPanelIds([]); }}
              className="am-tap"
              style={{
                padding: `${space.gap + 1}px ${space.gap + 3}px`,
                display: 'flex', flexDirection: 'column', gap: space.breath,
                textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%',
              }}
            >
              <span style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', gap: space.line,
              }}>
                <span style={{ fontSize: 16, color: color.ink }}>{s.label}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12, flexShrink: 0,
                  color: scopeId === s.id ? color.champagne : 'rgba(232,217,190,0.8)',
                }}>
                  {s.price}
                </span>
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: color.ink3 }}>{s.detail}</span>
            </Pane>
          ))}
        </div>
      </section>

      {/* ── WHICH PANELS — only for a custom coverage ───────────────────── */}
      {isCustom && chosen?.panels?.length ? (
        <section
          aria-labelledby="scope-panels"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="scope-panels" style={{ margin: 0 }}><Rail>Which panels</Rail></h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.breath }}>
            {chosen.panels.map(p => (
              <Toggle
                key={p.id}
                on={panelIds.includes(p.id)}
                onClick={() => setPanelIds(l => toggle(l, p.id))}
                label={p.label}
                aside={p.price}
              />
            ))}
          </div>
          {panelIds.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: color.ink3 }}>
              Pick the panels you want covered and we will price it.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ── EXTRA STAGES ────────────────────────────────────────────────── */}
      {model.addOns.length > 0 ? (
        <section
          aria-labelledby="scope-addons"
          style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}
        >
          <h2 id="scope-addons" style={{ margin: 0 }}><Rail>Worth adding</Rail></h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.line - 1 }}>
            {model.addOns.map(a => {
              const on = addOnIds.includes(a.id);
              return (
                <Pane
                  key={a.id}
                  tone={on ? 'lit' : 'plain'}
                  as="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setAddOnIds(l => toggle(l, a.id))}
                  className="am-tap"
                  style={{
                    padding: `${space.gap}px ${space.gap + 3}px`,
                    display: 'flex', flexDirection: 'column', gap: space.breath - 1,
                    textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%',
                  }}
                >
                  <span style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'baseline', gap: space.line,
                  }}>
                    <span style={{ fontSize: 15, color: color.ink }}>{a.label}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, flexShrink: 0,
                      color: on ? color.champagne : 'rgba(232,217,190,0.8)',
                    }}>
                      +{a.price}
                    </span>
                  </span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: color.ink3 }}>
                    {a.detail}
                    {a.recommendedWith.includes(scopeId) ? ' · Recommended' : ''}
                  </span>
                </Pane>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── THE ESTIMATE ────────────────────────────────────────────────
          Everything below is the server's answer, restated. A figure appears
          only once there is one; there is no zero standing in for a choice
          nobody has made. */}
      <Pane
        tone="warm"
        aria-live="polite"
        style={{
          marginTop: space.rest / 2,
          padding: `${space.gap + 2}px ${space.gap + 4}px`,
          display: 'flex', flexDirection: 'column', gap: space.breath,
        }}
      >
        <Label style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>Estimate</Label>
        {quoted ? (
          <>
            <span className="am-display" style={{ fontSize: 30, lineHeight: 1 }}>{quoted.total}</span>
            <span style={{ fontSize: 13, color: color.ink2 }}>
              {[quoted.benefit, quoted.bay].filter(Boolean).join(DOT)}
            </span>
            {quoted.fees ? (
              <span style={{ fontSize: 12.5, color: color.ink3 }}>
                Includes collection: {quoted.fees}
              </span>
            ) : null}
          </>
        ) : (
          <span style={{ fontSize: 14, color: color.ink3 }}>
            {pricing ? 'Pricing it…'
              : !online ? 'We can price it when you are back online.'
              : isCustom ? 'Choose the panels and we will price it.'
              : 'Choose a coverage and we will price it.'}
          </span>
        )}
        <span style={{ fontSize: 12.5, color: color.ink3 }}>Final on inspection.</span>
      </Pane>

      {error ? (
        <p aria-live="polite" style={{ margin: `${space.gap}px 0 0`, fontSize: 13.5, lineHeight: 1.6, color: color.ink2 }}>
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: space.rest / 2, display: 'flex', flexDirection: 'column', gap: space.line }}>
        <Action onClick={proceed} disabled={!complete || !quoted || committing || !online}>
          {committing ? 'One moment…' : 'Choose a date'}
        </Action>
      </div>
    </Screen>
  );
}

/** In rupees, in the grouping an Indian customer reads. */
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** One panel, chosen or not. §21.3 — a real target; §21.6 — state in aria. */
function Toggle(
  { on, onClick, label, aside }:
  { on: boolean; onClick: () => void; label: string; aside?: string },
) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="checkbox"
      aria-checked={on}
      className="am-tap"
      style={{
        minHeight: TARGET_MIN,
        paddingInline: space.gap,
        borderRadius: radius.card,
        border: `${HAIRLINE}px solid ${on ? 'rgba(232,217,190,0.32)' : color.edge}`,
        background: on
          ? 'linear-gradient(160deg, rgba(232,217,190,0.22), rgba(232,217,190,0.06))'
          : 'rgba(255,255,255,0.045)',
        color: on ? color.champagneHot : color.ink2,
        fontFamily: typeScale.body.family,
        fontSize: 13,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
      }}
    >
      <span>{label}</span>
      {aside ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.75 }}>{aside}</span>
      ) : null}
    </button>
  );
}
