'use client';
/**
 * THE VISIT, WHILE IT IS HAPPENING.
 *
 * Source: reference/customer-old/app/app/visit/[id]/page.tsx
 *         docs/AUTOMODZ-OS.md §13.2, §19.2 · ARCHITECTURE §1
 *         design "AutoModz App.dc.html" — screen 1g, "live, without noise"
 *
 * The completed visit is a record and lives in `VisitScreen`. This is the car
 * HERE, now, and the surface has to say so while it changes.
 *
 * §13.2 — a live visit is a takeover: it earns the whole surface and the
 * navigation stands down. Everything on it is `os/stay`'s derivation; not one
 * value is computed here.
 *
 * ── "WITHOUT NOISE" IS THE WHOLE BRIEF ───────────────────────────────────
 * The design's own title for this screen. Four things are on it: what is being
 * done, the bay, the acts in order, and two ways to reach the studio. There is
 * no progress percentage, no ETA counting down by the second, no activity
 * feed. §19.2 — one honest line about time, or nothing at all. A customer
 * watching their car being worked on wants to know it is being worked on;
 * everything beyond that is the product performing busyness.
 *
 * ── THE TIMELINE IS DRAWN HERE, NOT BY `Timeline` ────────────────────────
 * The system `Timeline` is a horizontal rail of steps. The design's is
 * vertical, with a lit dot on the current act and a hairline running between
 * them — it reads as a record accruing rather than as progress being made,
 * which is the difference between a workshop and a delivery tracker. §22.2 is
 * satisfied by there being ONE of each: the rail for horizontal steps, this
 * for the visit's own ledger.
 */
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { color, space, INSET, MEASURE, radius, stack, imageSizes } from '@/design';
import { Modal, OfflineNote, LiveRefresh } from '@/components/system';
import { Pane, Label, Statement, Pulse, Action } from '@/components/os';

export interface LiveVisitFrame {
  id: string;
  url: string;
  caption?: string;
}

export interface LiveVisitModel {
  id: string;
  /** The car this is happening to. */
  vehicleName: string;
  /** The act, in the customer's words — `os/visit`'s ACT_TITLE. */
  word: string;
  /** The studio's sentence when it left one, else the act's own line. */
  line: string;
  /** One honest line about time, or nothing at all. §19.2 */
  timing?: string;
  /** What was asked for. */
  service: string;
  /** The acts, in order, with where we are among them. */
  acts: readonly { label: string; done: boolean; current: boolean }[];
  /** The evidence, as far as it exists. */
  frames: readonly LiveVisitFrame[];
  /** The newest photograph of any kind — what the stage shows. */
  hero?: string;
  /** Back to the car. */
  backHref: string;
  /** The studio, reachable. §20.1 */
  messageHref?: string;
}

export function LiveVisitScreen({ model }: { model: LiveVisitModel }) {
  const [viewing, setViewing] = useState<string | null>(null);
  const viewed = model.frames.find(f => f.id === viewing);
  const { vehicleName, word, line, timing, service, acts, frames, hero, backHref, messageHref } = model;

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100svh',
        background: 'transparent',
        /* A takeover carries no dock, so it reserves only the safe area — but
           it still needs room for its own two controls at the foot. */
        paddingBottom: `calc(${space.movement}px + env(safe-area-inset-bottom, 0px))`,
        paddingTop: `calc(${stack.top} + ${space.gap}px)`,
      }}
    >
      <OfflineNote />
      {/* The page re-reads itself while the customer is actually looking, and
          stops the moment they are not. See LiveRefresh. */}
      <LiveRefresh />

      <div
        style={{
          paddingInline: INSET,
          maxWidth: MEASURE + INSET * 2,
          marginInline: 'auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: space.gap,
        }}
      >
        {/* ── WHAT IS BEING DONE ────────────────────────────────────────
            §9.5 — the one Display. The label above it names the visit and the
            car, which is the only place either appears on this screen. */}
        <Statement eyebrow={`${vehicleName} · in the studio`} lit size={29}>
          {service}
        </Statement>

        {/* ── THE BAY ───────────────────────────────────────────────────
            The newest photograph of any kind, with the studio's own sentence
            under it. §13.2 — the evidence is the point of a live visit; a
            status word with no picture behind it is a claim. */}
        {hero ? (
          <div
            style={{
              position: 'relative', borderRadius: radius.sheet, overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 24px 50px -24px rgba(0,0,0,0.95)',
            }}
          >
            <Image
              src={hero}
              alt={`${vehicleName}, in the studio`}
              width={780} height={392}
              sizes={imageSizes.inMeasure}
              priority
              style={{ width: '100%', height: 196, objectFit: 'cover', display: 'block' }}
            />
            <span
              aria-hidden
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(8,9,10,0.25), rgba(8,9,10,0.6))',
              }}
            />
            {/* The one live mark in the product: a breathing point of amber
                and three words. Never a red dot, never the word "LIVE" in a
                pill — this is a workshop, not a broadcast. */}
            <span
              className="am-glass"
              style={{
                position: 'absolute', top: 14, left: 14,
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 11px', borderRadius: radius.chip,
              }}
            >
              <Pulse size={6} />
              <span className="am-label" style={{ fontSize: 9.5, letterSpacing: '0.2em' }}>
                Live from the bay
              </span>
            </span>
            <span
              style={{
                position: 'absolute', bottom: 14, left: 16, right: 16,
                fontSize: 13, color: color.over,
              }}
            >
              {line}
            </span>
          </div>
        ) : (
          <Pane tone="lit" live style={{ padding: `${space.gap}px ${space.gap + 2}px`, display: 'flex', alignItems: 'center', gap: space.line }}>
            <Pulse />
            <span style={{ fontSize: 14, color: color.ink }}>{line}</span>
          </Pane>
        )}

        {/* ── THE ACTS ──────────────────────────────────────────────────
            In order, with the current one lit and the ones ahead at rest.
            §19.2 — the timing line hangs off the CURRENT act, because that is
            the only act a time can honestly be given for. */}
        <Pane
          as="section"
          aria-label="What has been done"
          style={{
            padding: space.gap + 4,
            display: 'flex', flexDirection: 'column', gap: 0,
          }}
        >
          {acts.map((a, i) => {
            const last = i === acts.length - 1;
            return (
              <div
                key={a.label}
                style={{ display: 'flex', gap: space.line + 2, alignItems: 'flex-start' }}
              >
                {/* The dot, and the hairline to the next one. Not drawn on
                    the last act: a line running off the bottom of the ledger
                    would promise a step that does not exist. */}
                <span
                  aria-hidden
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 4, paddingTop: 5, alignSelf: 'stretch',
                  }}
                >
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: a.current ? color.amber : a.done ? color.champagne : 'transparent',
                      border: a.done || a.current ? 'none' : '1px solid rgba(237,235,231,0.5)',
                      boxShadow: a.current ? '0 0 14px 3px rgba(224,164,92,0.55)' : undefined,
                    }}
                  />
                  {last ? null : (
                    <span
                      style={{
                        width: 1, flex: 1, minHeight: 26,
                        background: a.done ? 'rgba(232,217,190,0.4)' : 'rgba(255,255,255,0.12)',
                      }}
                    />
                  )}
                </span>

                <span
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                    paddingBottom: last ? 0 : space.gap,
                    opacity: a.done || a.current ? 1 : 0.45,
                  }}
                >
                  <span style={{ fontSize: 14, color: a.current ? color.amberHot : color.ink }}>
                    {a.label}
                  </span>
                  {a.current && timing ? (
                    <Label style={{ fontSize: 10, letterSpacing: '0.14em' }} >
                      Now · {timing}
                    </Label>
                  ) : null}
                </span>
              </div>
            );
          })}
        </Pane>

        {/* ── TODAY'S PHOTOGRAPHS ───────────────────────────────────────
            A strip, not a gallery: these arrive during one visit and there
            are rarely more than a handful. Tapping one opens it whole. */}
        {frames.length > 0 ? (
          <section aria-label="Photographs from this visit">
            <div
              style={{
                display: 'flex', gap: space.breath, overflowX: 'auto',
                marginInline: -INSET, paddingInline: INSET, paddingBottom: space.breath,
              }}
            >
              {frames.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setViewing(f.id)}
                  className="am-tap"
                  style={{
                    flex: '0 0 auto', padding: 0, border: 'none', background: 'none',
                    cursor: 'pointer', borderRadius: radius.chip, overflow: 'hidden',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={f.caption ?? `${vehicleName} during this visit`}
                    loading="lazy"
                    style={{
                      width: 108, height: 108, objectFit: 'cover', display: 'block',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── THE TWO WAYS OUT ──────────────────────────────────────────
            Neither is a commitment, so neither is filled. §20.1 — a way to
            reach a human, on the screen where a customer is most likely to
            want one. */}
        <div style={{ display: 'flex', gap: space.line, marginTop: space.breath }}>
          <Action href={backHref} quiet style={{ fontSize: 13.5 }}>Back to the car</Action>
          {messageHref ? (
            <Action href={messageHref} quiet style={{ fontSize: 13.5 }}>Message the studio</Action>
          ) : null}
        </div>
      </div>

      {/* One photograph, whole. */}
      <Modal
        open={viewed !== undefined}
        onClose={() => setViewing(null)}
        label="Photograph"
      >
        {viewed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.gap }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewed.url}
              alt={viewed.caption ?? `${vehicleName} during this visit`}
              style={{ width: '100%', borderRadius: radius.pane, display: 'block' }}
            />
            {viewed.caption ? (
              <p style={{ margin: 0, fontSize: 13.5, color: color.ink2 }}>{viewed.caption}</p>
            ) : null}
            <Link
              href="#"
              onClick={e => { e.preventDefault(); setViewing(null); }}
              className="am-tap"
              style={{ color: color.ink3, fontSize: 14, textDecoration: 'none' }}
            >
              Close
            </Link>
          </div>
        ) : null}
      </Modal>

      {/* `word` is the act in the customer's words and the takeover's
          accessible title; it is announced rather than drawn, because the
          Display already says what is being done and repeating it in two
          sizes is the flattening §3.5 warns about. */}
      <span className="sr-only" role="status" aria-live="polite">{word}</span>
    </main>
  );
}
