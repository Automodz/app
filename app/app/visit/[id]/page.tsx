'use client';
/**
 * THE STAY - `/app/visit/[id]` (P2D1 §C4 · P2D3 C-12).
 *
 * The hero moment: while the car is in the studio, this surface answers
 * "where is my car and is it okay?" continuously, and turns waiting into
 * hospitality. Everything on it is the floor's own record - the act the job
 * is in, the note the craftsman wrote, the photograph they took, who has the
 * car, when it arrived. Nothing is estimated into a bar and nothing is said
 * when the studio has said nothing.
 *
 * Collapsing does not build a second surface: the Glance's Capsule *is* the
 * glass live header (it carries the act line and taps straight back in), so
 * putting the visit down simply returns to the car, exactly as specified.
 */
import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useVisitJob } from '@/components/os/useVisitJob';
import { deriveStay } from '@/lib/os/stay';
import { scene, studioEase, breath } from '@/lib/os/motion';
import { useStudioRouter } from '@/lib/os/navigate';
import IdentityPlate from '@/components/os/IdentityPlate';
import { getHeroImage } from '@/lib/os/hero';
import MomentStage from '@/components/os/MomentStage';
import StayReveal, { StayFacts } from '@/components/os/StayReveal';
import Action from '@/components/os/Action';
import { Body } from '@/components/os/text';

/** A finished visit is a Chapter - the Stay hands it straight over. */
const chapterHref = (bookingId: string) => `/app/chapter/${bookingId}`;

export default function StayPage() {
  const router = useRouter();
  const nav = useStudioRouter();
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
    if (isArchived) nav.replace(chapterHref(id));
    else if (isCancelled) router.replace('/app');
  }, [isArchived, isCancelled, id, router, nav]);

  /** Put the visit down - the car (and the capsule's live line) is behind it. */
  const collapse = () => nav.replace('/app');
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

  /* the hero image, resolved by the one shared rule every surface uses
     (lib/os/hero → getHeroImage): the studio's latest progress photo, else the
     car's cover, else the branded plate below - never a black box. */
  const heroPhoto = getHeroImage(vehicle, stay);

  /* the photo-less fallback: the identical band plate HomeV2 uses (a designed
     monument, never solid black). No per-surface token override - the two heroes
     fall back the same way. */
  const plate = (
    <IdentityPlate name={name} registration={registration} variant="band" />
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
      // transparent so the Stay floats on the shared environment (the shell's
      // Ambient), never a separate black page
      style={{ background: 'transparent', minHeight: '100dvh', position: 'relative' }}
    >
      {isReveal
        ? <StayReveal
            name={name} stay={stay}
            covered={!!booking.usedMembershipWash}
            heroPhoto={heroPhoto}
            fallback={plate}
          />
        : (
          <motion.div {...breath(reduced)}>
            <MomentStage
              act={stay.act}
              acts={stay.acts}
              narration={stay.narration}
              photo={heroPhoto}
              photoAlt={`The ${name} at the studio - ${stay.acts.find(a => a.state === 'current')?.title.toLowerCase()}`}
              fallback={plate}
              timing={stay.timing}
              meta={<StayFacts stay={stay} name={name} />}
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

