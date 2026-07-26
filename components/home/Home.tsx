'use client';
/**
 * HOME - the Garage. "Your Car."
 * (docs/AUTOMODZ-OS-IA.md §3 · AUTOMODZ-OS-DESIGN-LANGUAGE.md)
 *
 * The hierarchy is fixed and no surface may invert it:
 *
 *   1  their own car          the largest element on screen
 *   2  current state          "Being protected" · "Ready for pickup"
 *   3  latest transformation  the most recent finished work
 *   4  protection             living states, never documents
 *   5  journey                what happened
 *
 * ...and no employee anywhere (Constitution Art. 8).
 *
 * A PURE VIEW. It owns no state, no effects, no data and no decisions. Every
 * value and every callback is handed to it by `app/app/page.tsx`, which stays
 * the controller. It also mints no materials of its own: the car is
 * `HeroVehicle`, glass is `Panel`, a promise is `StateCard`, rhythm is
 * `Section`, and type is the text primitives. If something here needed a new
 * material, the design system would be wrong - not this screen.
 */
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { studioEase, move, tick } from '@/lib/os/motion';
import type { LiveProtection } from '@/lib/os/protection';
import HeroVehicle, { type HeroHotspot } from '@/components/os/HeroVehicle';
import StateCard, { StateChips } from '@/components/os/StateCard';
import Panel from '@/components/os/Panel';
import Section from '@/components/os/Section';
import Action from '@/components/os/Action';
import { type Tone } from '@/components/os/Chip';
import { Emphasis, Body, Data, Whisper } from '@/components/os/text';

/* ── what the controller hands in ───────────────────────────────────────── */

export interface HomeVehicle {
  id: string;
  name: string;
  registration?: string;
  photo?: string;
}

/** The one thing that matters right now, chosen by the ownership engine. */
export interface HomeState {
  /** the single Display of the screen - "In care", "Ready", "Cared for" */
  word: string;
  tone: Tone;
  /** one sentence: what is actually happening */
  line?: string;
  /** the studio's own words, when there are any */
  note?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface HomeTransformation {
  id: string;
  title: string;
  date: string;
  photo?: string;
  onOpen: () => void;
}

export interface HomeJourneyEntry {
  id: string;
  title: string;
  detail: string;
  onOpen: () => void;
}

export interface HomeStudio {
  name: string;
  area: string;
  hours: string;
  onDirections: () => void;
  onCall: () => void;
  onMessage: () => void;
}

export interface HomeProps {
  vehicles: HomeVehicle[];
  page: number;
  onPage: (i: number) => void;
  onAddCar: () => void;

  state: HomeState;
  protections: LiveProtection[];
  onOpenProtection: (p: LiveProtection) => void;
  latest: HomeTransformation | null;
  journey: HomeJourneyEntry[];
  onOpenJourney?: () => void;
  studio: HomeStudio;
}

/* ── the screen ─────────────────────────────────────────────────────────── */

export default function Home({
  vehicles, page, onPage, onAddCar,
  state, protections, onOpenProtection, latest, journey, onOpenJourney, studio,
}: HomeProps) {
  const reduced = useReducedMotion();
  const vehicle = vehicles[Math.min(page, vehicles.length - 1)];
  // the add-a-car page matches whatever height the heroes beside it stand at
  const hasPhoto = vehicles.some(v => v.photo);

  /* content lifts once and never bounces. Opacity is deliberately NOT part of
     this: the motion law forbids gating a payload on an animation, so a frame
     that never runs still shows a complete screen. */
  const rise = (delay = 0) => reduced ? {} : {
    initial: { y: 10 },
    animate: { y: 0 },
    transition: { duration: move, ease: studioEase, delay },
  };

  /* the car's own panels, tappable where a promise lives on them. A hotspot
     pulses only while its state is asking for something. */
  const hotspots: HeroHotspot[] = protections
    .filter(p => ZONE[p.kind])
    .map(p => ({
      key: p.kind,
      ...ZONE[p.kind]!,
      label: `${p.kind} — ${p.health}`,
      attention: p.health !== 'healthy',
      onTap: () => onOpenProtection(p),
    }));

  if (!vehicle) return null;

  return (
    <main style={{ paddingBottom: 'var(--st-content-floor)' }}>
      {/* ── 1 · THEIR OWN CAR ──────────────────────────────────────────── */}
      <div
        onScroll={e => {
          const el = e.currentTarget;
          const next = Math.round(el.scrollLeft / el.clientWidth);
          if (next !== page) onPage(next);
        }}
        style={{
          // non-static: the hero's parallax measures its offset against this
          // scroller, and framer cannot resolve a static container
          position: 'relative',
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}
      >
        {vehicles.map((v, i) => (
          <div key={v.id} style={{ minWidth: '100%', scrollSnapAlign: 'start' }}>
            <HeroVehicle
              name={v.name}
              registration={v.registration}
              photo={v.photo}
              priority={i === 0}
              hotspots={i === page ? hotspots : []}
            >
              {/* ── 2 · CURRENT STATE - the one Display of the screen ──── */}
              <motion.div {...rise(0.04)}>
                <h1 style={{
                  margin: 0,
                  fontFamily: 'var(--st-display)', fontWeight: 700,
                  fontSize: 'clamp(40px, 12vw, 60px)', lineHeight: 0.94,
                  letterSpacing: '-0.04em', color: 'var(--st-ink)',
                }}>
                  {state.word}
                </h1>
                {!v.photo && (
                  <Whisper as="p" tone="ink-2" style={{ marginTop: 'var(--st-breath)' }}>
                    Photographed at your first visit.
                  </Whisper>
                )}
              </motion.div>
            </HeroVehicle>
          </div>
        ))}

        {/* the invitation after the last car */}
        <button
          onClick={onAddCar}
          style={{
            minWidth: '100%', scrollSnapAlign: 'start',
            height: hasPhoto ? 'min(62svh, 560px)' : 'min(42svh, 380px)',
            display: 'grid', placeItems: 'center',
            background: 'var(--st-gallery)', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--st-display)', fontWeight: 600, fontSize: 20,
            color: 'var(--st-ink-2)',
          }}
        >
          Add a car
        </button>
      </div>

      {/* the living states, read at a glance - compliance rendered as care */}
      {protections.length > 0 && (
        <Section rhythm="line">
          <motion.div {...rise(0.08)}>
            <StateChips protections={protections.slice(0, 4)} onTap={onOpenProtection} />
          </motion.div>
        </Section>
      )}

      {/* what is happening, and the one thing to do about it */}
      {(state.line || state.actionLabel) && (
        <Section rhythm="line">
          <motion.div {...rise(0.12)}>
            <Panel>
              <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
                {state.line && <Emphasis>{state.line}</Emphasis>}
                {state.note && <Body tone="ink-2">{state.note}</Body>}
                {state.actionLabel && state.onAction && (
                  <div><Action variant="forward" onClick={state.onAction}>{state.actionLabel}</Action></div>
                )}
              </div>
            </Panel>
          </motion.div>
        </Section>
      )}

      {/* ── 3 · LATEST TRANSFORMATION ──────────────────────────────────── */}
      {latest && (
        <Section title="Latest" rhythm="rest">
          <motion.div {...rise(0.16)}>
            <TransformationCard t={latest} reduced={!!reduced} />
          </motion.div>
        </Section>
      )}

      {/* ── 4 · PROTECTION - living states, never documents ────────────── */}
      {protections.length > 0 && (
        <Section title="Protection" rhythm="rest">
          <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
            {protections.map(p => (
              <StateCard
                key={p.id}
                protection={p}
                onOpenChapter={p.visitId ? () => onOpenProtection(p) : undefined}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── 5 · JOURNEY ────────────────────────────────────────────────── */}
      {journey.length > 0 && (
        <Section
          title="Journey"
          rhythm="rest"
          actionLabel={onOpenJourney ? 'All of it' : undefined}
          onAction={onOpenJourney}
        >
          <Panel padding="var(--st-breath)">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {journey.map((j, i) => (
                <li key={j.id}>
                  <button
                    onClick={j.onOpen}
                    className="st-tap"
                    style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                      gap: 'var(--st-line)', width: '100%', minHeight: 52,
                      padding: 'var(--st-line) var(--st-breath)',
                      background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderTop: i === 0 ? 'none' : '1px solid var(--st-hairline)',
                    }}
                  >
                    <Body as="span" style={{ minWidth: 0 }}>{j.title}</Body>
                    <Data as="span" tone="ink-2" style={{ flex: '0 0 auto' }}>{j.detail}</Data>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}

      {/* the studio - a temporary bridge until the Studio entrance ships */}
      <Section title="The studio" rhythm="movement">
        <Panel>
          <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
            <div>
              <Emphasis>{studio.name} <span style={{ color: 'var(--st-ink-3)' }}>· {studio.area}</span></Emphasis>
              <Data tone="ink-2" style={{ display: 'block', marginTop: 'var(--st-hair)' }}>{studio.hours}</Data>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--st-inset)' }}>
              <Action variant="external" onClick={studio.onDirections}>Directions</Action>
              <Action variant="external" onClick={studio.onCall}>Call</Action>
              <Action variant="external" onClick={studio.onMessage}>WhatsApp</Action>
            </div>
          </div>
        </Panel>
      </Section>
    </main>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

/** The most recent finished work, as a photograph worth looking at. */
function TransformationCard({ t, reduced }: { t: HomeTransformation; reduced: boolean }) {
  return (
    <motion.button
      onClick={t.onOpen}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      transition={{ duration: tick, ease: studioEase }}
      className="st-tap"
      style={{
        position: 'relative', display: 'block', width: '100%', padding: 0,
        border: 'none', cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
        borderRadius: 'var(--st-r-card)', background: 'var(--st-gallery)',
        aspectRatio: '16 / 10',
        boxShadow: 'var(--st-raise), var(--st-edge)',
      }}
    >
      {t.photo && (
        <Image src={t.photo} alt="" fill sizes="100vw" style={{ objectFit: 'cover' }} />
      )}
      <span aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(transparent 42%, var(--st-scrim-strong))',
      }} />
      <span style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'var(--st-gap)',
      }}>
        <Emphasis as="span" tone="over" style={{ display: 'block' }}>{t.title}</Emphasis>
        <Whisper as="span" tone="over-2" style={{ display: 'block', marginTop: 2 }}>{t.date}</Whisper>
      </span>
    </motion.button>
  );
}

/** Where each promise lives on the car, as a fraction of the frame. */
const ZONE: Partial<Record<string, { x: number; y: number }>> = {
  ppf:      { x: 0.60, y: 0.52 },  // the bonnet
  ceramic:  { x: 0.42, y: 0.34 },  // the roof
  glass:    { x: 0.50, y: 0.42 },  // the windscreen
  interior: { x: 0.34, y: 0.50 },  // the cabin
};
