'use client';
/**
 * THE REVEAL (Stay, act 5) and the quiet FACTS line - the Stay's presentation,
 * lifted out of the screen so the route only wires data in. Both compose the
 * design system's own primitives (HeroMedia, the text scale, the motion and
 * spacing tokens); neither invents a value of its own.
 *
 * The finished car holds the screen alone, and only then does the rest rise:
 * the word, the change, the person, the amount, and how to collect. Nothing is
 * sold beside a finished car.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { COMPANY } from '@/lib/company';
import { rise, breath } from '@/lib/os/motion';
import { vtName } from '@/lib/os/navigate';
import { fmtClock, type deriveStay } from '@/lib/os/stay';
import HeroMedia from './HeroMedia';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import { Display, Emphasis, Body, Data, Whisper } from './text';

type Stay = NonNullable<ReturnType<typeof deriveStay>>;

/** The quiet facts under a Stay: who has the car, and since when. Silent when unknown. */
export function StayFacts({ stay, name }: { stay: Stay; name: string }) {
  const lines: string[] = [];
  if (stay.craftsman) lines.push(`${stay.craftsman} has the ${name}.`);
  if (stay.arrivedAt) lines.push(`Arrived ${fmtClock(stay.arrivedAt)}.`);
  if (!lines.length) return null;
  return <Whisper tone="over-2">{lines.join(' ')}</Whisper>;
}

export default function StayReveal({
  name, stay, covered, heroPhoto, fallback,
}: {
  name: string;
  stay: Stay;
  covered: boolean;
  heroPhoto?: string;
  fallback: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [held, setHeld] = useState(!reduced);

  useEffect(() => {
    if (!held) return;
    const t = setTimeout(() => setHeld(false), 1200);
    return () => clearTimeout(t);
  }, [held]);

  const finished = stay.finishedPhoto;
  const arrival = stay.arrivalPhoto;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* the finished car holds the screen - the same hero component, crop and
          scrim as the Glance (HeroMedia), so the reveal reads as the same product */}
      <motion.div
        {...breath(reduced)}
        style={{
          position: 'relative', height: '68vh', minHeight: 440, overflow: 'hidden',
          background: 'var(--st-stage)', ...vtName('hero-vehicle'),
        }}
      >
        <HeroMedia photo={heroPhoto} fallback={fallback} alt={`The finished ${name}`} priority scrimTo="var(--st-stage)" />
      </motion.div>

      {!held && (
        <motion.div
          {...rise}
          style={{
            padding: '0 var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-movement))',
            marginTop: 'calc(-1 * var(--st-inset))', position: 'relative',
          }}
        >
          <Display tone="over" aria-live="polite">Ready.</Display>

          {finished && arrival && (
            <div style={{ marginTop: 'var(--st-inset)', borderRadius: 'var(--st-r-sheet)', overflow: 'hidden' }}>
              <BeforeAfterSlider
                before={arrival} after={finished} showLabels={false}
                alt={`The ${name} on arrival and finished`}
              />
            </div>
          )}

          {stay.craftsman && (
            <Emphasis tone="over" style={{ marginTop: 'var(--st-inset)' }}>
              {stay.craftsman} finished the {name}.
            </Emphasis>
          )}

          <Body tone="over-2" style={{ marginTop: 'var(--st-line)' }}>
            {covered
              ? 'Covered by the Club.'
              : stay.paid
              ? 'Paid - thank you.'
              : <>Pay at the desk · <Data tone="over-2">₹{stay.amount.toLocaleString('en-IN')}</Data></>}
          </Body>

          <Body tone="over" style={{ marginTop: 'var(--st-inset)' }}>
            Collect any time before {COMPANY.hours.close}.
          </Body>
        </motion.div>
      )}
    </div>
  );
}
