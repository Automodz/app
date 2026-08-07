'use client';
/**
 * THE VISIT, WHILE IT IS HAPPENING.
 *
 * Source: reference/customer-old/app/app/visit/[id]/page.tsx
 *         docs/AUTOMODZ-OS.md §13.2 · docs/AUTOMODZ-OS-ARCHITECTURE.md §1
 *
 * The completed visit is a record and lives in `VisitScreen`. This is the other
 * half the old application had and the rebuild lost: the car is HERE, now, and
 * the surface has to say so while it changes.
 *
 * §13.2 — a live visit is a takeover: it earns the whole surface and the
 * navigation stands down. Everything on it is `os/stay`'s derivation; not one
 * value is computed here. The rail is the system `Timeline`, so the product has
 * one implementation of "steps, and where we are among them" (§22.2) rather
 * than a second `StageRail`.
 */
import { useState } from 'react';
import Image from 'next/image';
import {
  color, space, INSET, MEASURE, radius, stack, imageSizes,
} from '@/design';
import {
  Hero, Heading, Text, Button, Timeline, Modal,
  OfflineNote,
  LiveRefresh,
} from '@/components/system';
import type { TimelineStep } from '@/components/system';

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
}

export function LiveVisitScreen({ model }: { model: LiveVisitModel }) {
  const [viewing, setViewing] = useState<string | null>(null);
  const viewed = model.frames.find(f => f.id === viewing);

  const steps: TimelineStep[] = model.acts.map((a, i) => ({
    id: String(i),
    label: a.label,
  }));
  /* `Timeline` takes the index rather than a flag per step, so there is exactly
     one place the current act can be — two steps could not both claim it. */
  const current = Math.max(0, model.acts.findIndex(a => a.current));

  return (
    <main
      style={{
        /* TRANSPARENT ON PURPOSE. The room stands in the ambient field,
           which is fixed behind everything (components/system/Ambient.tsx).
           Painting `color.paper` here would occlude it completely. The dark
           ground still exists — it is on `body` — so nothing loses contrast. */
        background: 'transparent',
        minHeight: '100svh',
        /* §13.2 — a takeover; the navigation stands down, so there is no bar
           to clear and the surface runs to the safe area instead. */
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${space.rest}px)`,
      }}
    >
      {/* THE ONE ROOM THAT HAS TO KEEP ITSELF CURRENT.
          Rendered on the server, this screen used to be frozen at the moment
          it was requested: the act it was in when the page loaded, and
          nothing after. New photographs never appeared and the rail never
          advanced — the one surface called "live" was the only one that never
          changed. It asks again now, quietly, and only while somebody is
          actually looking (see LiveRefresh).

          NO PREDICATE. `app/history/[id]` renders this room only while
          `toLiveVisit` still answers; the moment the visit is no longer in
          flight the same address renders the RECORD instead and this
          unmounts, which stops the polling for the right reason. Guessing at
          "finished" from the last act would stop one step early — a visit
          whose work is done but whose car has not been handed back is still
          live, and that hand-back is the transition the customer is waiting
          for. */}
      <LiveRefresh />

      {/* §20.3 — the visit so far was rendered on the server and is still
          true; only what happens NEXT needs a connection. Whoever is
          watching their car in the studio is the likeliest to be on a
          patchy connection, so this room says it too. */}
      <OfflineNote />

      <Hero
        state={model.hero ? 'media' : 'awaiting'}
        band="full"
        overlay={
          <div style={{ maxWidth: MEASURE, paddingBottom: stack.top }}>
            <Text role="data" tone="over" as="span">{model.vehicleName}</Text>

            {/* §21.7 — the act changes without the customer acting, so it is
                announced politely rather than interrupting them. */}
            <Heading level="display" tone="over" style={{ marginTop: space.hair }}>
              {model.word}
            </Heading>
            <Text
              role="body"
              tone="over"
              aria-live="polite"
              style={{ marginTop: space.line }}
            >
              {model.line}
            </Text>
            {model.timing ? (
              <Text role="data" tone="over" aria-live="polite" style={{ marginTop: space.breath }}>
                {model.timing}
              </Text>
            ) : null}
          </div>
        }
      >
        {model.hero ? (
          <Image
            src={model.hero}
            alt={`${model.vehicleName}, in the studio`}
            fill
            priority
            sizes={imageSizes.fullBleed}
            style={{ objectFit: 'cover' }}
          />
        ) : null}
      </Hero>

      {/* ── WHERE IT IS ─────────────────────────────────────────────────
          The rail. `Timeline` is the one implementation of steps-and-position
          in the product; a second `StageRail` would be a second answer. */}
      <section style={{ paddingTop: space.rest }}>
        <Timeline steps={steps} current={current} />
      </section>

      {/* ── WHAT WAS ASKED FOR ─────────────────────────────────────────── */}
      <section
        style={{
          paddingInline: INSET,
          maxWidth: MEASURE + INSET * 2,
          marginInline: 'auto',
          width: '100%',
          paddingTop: space.rest,
        }}
      >
        <Text role="data" tone="ink3">{model.service}</Text>
      </section>

      {/* ── THE EVIDENCE ────────────────────────────────────────────────
          §18.1 — before the studio has photographed anything there is nothing
          here, and nothing explains the absence. */}
      {model.frames.length > 0 ? (
        <section
          style={{
            paddingInline: INSET,
            maxWidth: MEASURE + INSET * 2,
            marginInline: 'auto',
            width: '100%',
            paddingTop: space.movement,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
              gap: space.breath,
            }}
          >
            {model.frames.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setViewing(f.id)}
                aria-label={f.caption ?? 'Open the photograph'}
                style={{
                  appearance: 'none',
                  border: 0,
                  padding: 0,
                  background: color.surface,
                  borderRadius: radius.card,
                  overflow: 'hidden',
                  aspectRatio: '1',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <Image
                  src={f.url}
                  alt={f.caption ?? `${model.vehicleName}, in the studio`}
                  fill
                  sizes="(max-width: 768px) 33vw, 160px"
                  style={{ objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── THE WAY BACK ───────────────────────────────────────────────
          §13.2 — a takeover has no navigation, so it must carry its own exit. */}
      <section
        style={{
          paddingInline: INSET,
          maxWidth: MEASURE + INSET * 2,
          marginInline: 'auto',
          width: '100%',
          paddingTop: space.movement,
        }}
      >
        <Button tier="quiet" href={model.backHref}>Back to the car</Button>
      </section>

      <Modal
        open={viewed !== undefined}
        onClose={() => setViewing(null)}
        label={viewed?.caption ?? 'Photograph'}
      >
        {viewed ? (
          <div
            style={{
              minHeight: '100svh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingInline: INSET,
            }}
          >
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
              <Image
                src={viewed.url}
                alt={viewed.caption ?? `${model.vehicleName}, in the studio`}
                fill
                sizes={imageSizes.fullBleed}
                style={{ objectFit: 'contain' }}
              />
            </div>
            {viewed.caption ? (
              <Text role="body" tone="ink2" style={{ marginTop: space.gap }}>
                {viewed.caption}
              </Text>
            ) : null}
            <div style={{ marginTop: space.gap }}>
              <Button tier="quiet" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
