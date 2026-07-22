'use client';
/**
 * THE STAY — `/app/visit/[id]` (P2D1 §C4 · P2D3 C-12).
 *
 * The hero moment: while the car is in the studio, this surface answers
 * "where is my car and is it okay?" continuously, and turns waiting into
 * hospitality. Everything on it is the floor's own record — the act the job
 * is in, the note the craftsman wrote, the photograph they took, who has the
 * car, when it arrived. Nothing is estimated into a bar and nothing is said
 * when the studio has said nothing.
 *
 * Collapsing does not build a second surface: the Glance's Capsule *is* the
 * glass live header (it carries the act line and taps straight back in), so
 * putting the visit down simply returns to the car, exactly as specified.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { COMPANY } from '@/lib/company';
import { useAppStore } from '@/lib/store';
import { useVisitJob } from '@/components/cx/useVisitJob';
import { deriveStay, fmtClock } from '@/lib/os/stay';
import { scene, studioEase, rise } from '@/lib/os/motion';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import IdentityPlate from '@/components/os/IdentityPlate';
import MomentStage from '@/components/os/MomentStage';
import Action from '@/components/os/Action';
import { Display, Emphasis, Body, Data, Whisper } from '@/components/os/text';

/**
 * The takeover breath — the evidence settles from 1.04 as the stage fades up.
 * Under reduced motion the transform is dropped entirely (an `initial` scale
 * would otherwise stay applied, since framer holds transforms still).
 */
const breath = (reduced: boolean | null) =>
  reduced
    ? {}
    : {
        initial: { scale: 1.04 },
        animate: { scale: 1 },
        transition: { duration: scene, ease: studioEase },
      };

/** Where a finished visit lives. P4 moves this to `/app/chapter/[id]`. */
const recordHref = (bookingId: string) => `/dashboard/care/${bookingId}`;

export default function StayPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, bookings, vehicles } = useAppStore();
  const reduced = useReducedMotion();

  const booking = useMemo(() => bookings.find(b => b.id === id) ?? null, [bookings, id]);
  const job = useVisitJob(booking);
  const stay = useMemo(() => (booking ? deriveStay(booking, job) : null), [booking, job]);
  const vehicle = useMemo(
    () => vehicles.find(v => v.id === booking?.vehicleId) ?? null,
    [vehicles, booking?.vehicleId],
  );

  // a visit that is over belongs to its record, not to the Stay
  const isArchived = stay?.archived ?? false;
  const isCancelled = stay?.cancelled ?? false;
  useEffect(() => {
    if (isArchived) router.replace(recordHref(id));
    else if (isCancelled) router.replace('/app');
  }, [isArchived, isCancelled, id, router]);

  /** Put the visit down — the car (and the capsule's live line) is behind it. */
  const collapse = () => router.replace('/app');
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 500) collapse();
  };

  if (!user) return null;

  if (!booking || !stay) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--st-stage)', display: 'grid', placeItems: 'center', padding: 'var(--st-inset)' }}>
        <div style={{ textAlign: 'center' }}>
          <Body tone="over-2">That visit isn’t in this garage.</Body>
          <div style={{ marginTop: 'var(--st-gap)' }}>
            <Action variant="on-photo" onClick={collapse}>Back to the car</Action>
          </div>
        </div>
      </main>
    );
  }

  const name = vehicle?.name ?? booking.vehicleName;
  const registration = vehicle?.registrationNumber ?? booking.vehicleRegNo;

  /* the plate speaks the stage's rendering — the photo-less Stay is never a
     black box, and the identity language is not duplicated to achieve it */
  const plate = (
    <div style={{
      position: 'absolute', inset: 0,
      ['--st-gallery' as string]: 'var(--st-stage)',
      ['--st-linen' as string]: 'rgba(247,247,245,0.10)',
      ['--st-hairline' as string]: 'rgba(247,247,245,0.10)',
      ['--st-ink' as string]: 'var(--st-over)',
      ['--st-ink-2' as string]: 'var(--st-over-2)',
      ['--st-ink-3' as string]: 'var(--st-over-2)',
    }}>
      <IdentityPlate name={name} registration={registration} variant="band" />
    </div>
  );

  const isReveal = stay.act === 'ready';

  return (
    <motion.main
      // the takeover breath: the stage fades up as the evidence settles
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: scene, ease: studioEase }}
      drag={reduced ? false : 'y'}
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      onDragEnd={onDragEnd}
      style={{ background: 'var(--st-stage)', minHeight: '100dvh', position: 'relative' }}
    >
      {isReveal
        ? <Reveal
            name={name} stay={stay}
            covered={!!booking.usedMembershipWash}
            fallback={plate}
          />
        : (
          <motion.div {...breath(reduced)}>
            <MomentStage
              act={stay.act}
              acts={stay.acts}
              narration={stay.narration}
              photo={stay.latestPhoto}
              photoAlt={`The ${name} at the studio — ${stay.acts.find(a => a.state === 'current')?.title.toLowerCase()}`}
              fallback={plate}
              timing={stay.timing}
              meta={<Facts stay={stay} name={name} />}
            />
          </motion.div>
        )}

      {/* the visible equivalent of the drag (accessibility law); the stage
          gathers under it so scrolling text never collides with the control */}
      <div aria-hidden style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, height: 120, zIndex: 1,
        background: 'linear-gradient(transparent, var(--st-stage))', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', left: 'var(--st-inset)',
        bottom: 'calc(env(safe-area-inset-bottom) + var(--st-gap))', zIndex: 2,
      }}>
        <Action variant="on-photo" onClick={collapse}>Put it down</Action>
      </div>
    </motion.main>
  );
}

/** The quiet facts: who has the car, and since when. Silent when unknown. */
function Facts({ stay, name }: { stay: NonNullable<ReturnType<typeof deriveStay>>; name: string }) {
  const lines: string[] = [];
  if (stay.craftsman) lines.push(`${stay.craftsman} has the ${name}.`);
  if (stay.arrivedAt) lines.push(`Arrived ${fmtClock(stay.arrivedAt)}.`);
  if (!lines.length) return null;
  return <Whisper tone="over-2">{lines.join(' ')}</Whisper>;
}

/**
 * THE REVEAL (act 5). The finished car holds the screen alone, and only then
 * does the rest rise: the word, the change, the person, the amount, and how
 * to collect. Nothing is sold beside a finished car.
 */
function Reveal({
  name, stay, covered, fallback,
}: {
  name: string;
  stay: NonNullable<ReturnType<typeof deriveStay>>;
  covered: boolean;
  fallback: React.ReactNode;
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
      <div style={{ position: 'relative', flex: '0 0 60%', minHeight: '56vh' }}>
        {finished
          ? <motion.img
              src={finished} alt={`The finished ${name}`}
              {...breath(reduced)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          : fallback}
        <div aria-hidden style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
          background: 'linear-gradient(transparent, var(--st-stage))',
        }} />
      </div>

      {!held && (
        <motion.div
          {...rise}
          style={{
            padding: '0 var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-movement))',
            marginTop: -24, position: 'relative',
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
              ? 'Paid — thank you.'
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
