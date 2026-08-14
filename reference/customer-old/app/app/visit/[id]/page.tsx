'use client';
/**
 * THE VISIT - `/app/visit/[id]`. Home, continued.
 * (docs/AUTOMODZ-OS-IA.md · AUTOMODZ-OS-DESIGN-LANGUAGE.md · JOURNEY-STAGES.md)
 *
 * While the car is with us this surface answers, continuously: where is it,
 * is it alright, and when can I have it back. It is not a separate product
 * with its own look - it is the Garage transformed by state, so it is built
 * from exactly the same materials Home is:
 *
 *   HeroVehicle · Section · Panel · StageRail · MediaGrid · MediaViewer
 *
 * Nothing here is bespoke. The one pattern this surface genuinely needed - a
 * rail of named steps - was extracted into `components/os/StageRail` first and
 * is consumed like everything else.
 *
 *   1  the car          the studio's latest photograph of it
 *   2  where it is      the act, in one word - the screen's single Display
 *   3  what we wrote    the floor's own sentence, unattributed (Art. 8)
 *   4  the rail         how far the work has got
 *   5  the evidence     every photograph from this visit, in the viewer
 *
 * THE MOTION LAW. The previous version wrapped the whole surface in
 * `initial={{ opacity: 0 }}`, so a throttled frame or a slow device left the
 * owner looking at a black screen where their car should be - reproduced in
 * the audit at ~2% opacity. Nothing here gates content on an animation: the
 * payload is opaque from the first frame and only transforms animate.
 *
 * `lib/os/stay.ts` is untouched - every value on screen is its derivation.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useVisitJob } from '@/components/os/useVisitJob';
import { deriveStay } from '@/lib/os/stay';
import { ACT_TITLE } from '@/lib/os/visit';
import { useStudioRouter } from '@/lib/os/navigate';
import { getHeroImage } from '@/lib/os/hero';
import { SHOT_CAPTION } from '@/lib/os/moment';
import { COMPANY } from '@/lib/company';
import HeroVehicle from '@/components/os/HeroVehicle';
import Panel from '@/components/os/Panel';
import Section from '@/components/os/Section';
import StageRail, { type RailStep } from '@/components/os/StageRail';
import MediaGrid, { type MediaFrame } from '@/components/os/MediaGrid';
import MediaViewer from '@/components/os/MediaViewer';
import BeforeAfterSlider from '@/components/ui/BeforeAfterSlider';
import Action from '@/components/os/Action';
import { Emphasis, Body, Data, Whisper } from '@/components/os/text';

const chapterHref = (bookingId: string) => `/app/chapter/${bookingId}`;

export default function VisitPage() {
  const router = useRouter();
  const nav = useStudioRouter();
  const { id } = useParams<{ id: string }>();
  const { user, bookings, vehicles } = useAppStore();
  const reduced = useReducedMotion();

  const [viewing, setViewing] = useState<number | null>(null);

  const booking = useMemo(() => bookings.find(b => b.id === id) ?? null, [bookings, id]);
  const job = useVisitJob(booking);
  const stay = useMemo(() => (booking ? deriveStay(booking, job) : null), [booking, job]);
  const vehicle = useMemo(
    () => vehicles.find(v => v.id === booking?.vehicleId) ?? null,
    [vehicles, booking?.vehicleId],
  );

  // a visit that is over belongs to its record, not here
  const isArchived = stay?.archived ?? false;
  const isCancelled = stay?.cancelled ?? false;
  useEffect(() => {
    if (isArchived) nav.replace(chapterHref(id));
    else if (isCancelled) router.replace('/app');
  }, [isArchived, isCancelled, id, router, nav]);

  /** Put the visit down - the car is behind it. */
  const collapse = () => nav.replace('/app');
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 500) collapse();
  };

  /* every photograph the floor took on this visit, newest last so the story
     reads forward. The captions are the evidence chain's own words. */
  const frames = useMemo<MediaFrame[]>(() => {
    const out: MediaFrame[] = [];
    (job?.photos ?? []).forEach((p, i) => {
      out.push({ id: `${p.path ?? p.url}_${i}`, url: p.url, caption: SHOT_CAPTION[p.kind] });
    });
    return out;
  }, [job?.photos]);

  const viewerFrames = useMemo(
    () => frames.map(f => ({ url: f.url, caption: f.caption })),
    [frames],
  );

  const steps = useMemo<RailStep[]>(
    () => (stay?.acts ?? []).map(a => ({ key: a.act, title: ACT_TITLE[a.act], state: a.state })),
    [stay?.acts],
  );

  if (!user) return null;

  if (!booking || !stay) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 'var(--st-inset)' }}>
        <div style={{ textAlign: 'center' }}>
          <Body tone="ink-2">That visit isn’t in this garage.</Body>
          <div style={{ marginTop: 'var(--st-gap)' }}>
            <Action onClick={collapse}>Back to the car</Action>
          </div>
        </div>
      </main>
    );
  }

  const name = vehicle?.name ?? booking.vehicleName;
  const registration = vehicle?.registrationNumber ?? booking.vehicleRegNo;
  const heroPhoto = getHeroImage(vehicle, stay);
  const ready = stay.act === 'ready';

  return (
    <motion.main
      /* the takeover is dismissible by gesture; the payload is NOT gated on
         an animation, so only drag lives on this element */
      drag={reduced ? false : 'y'}
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      onDragEnd={onDragEnd}
      style={{ minHeight: '100dvh', paddingBottom: 'var(--st-content-floor)' }}
    >
      {/* ── 1 · THE CAR - the same hero Home uses, same crop, same fallback ── */}
      <HeroVehicle name={name} registration={registration} photo={heroPhoto} priority>
        {/* ── 2 · WHERE IT IS - the screen's one Display ── */}
        <h1 style={{
          margin: 0, fontFamily: 'var(--st-display)', fontWeight: 700,
          fontSize: 'clamp(40px, 12vw, 60px)', lineHeight: 0.94,
          letterSpacing: '-0.04em', color: 'var(--st-ink)',
        }}>
          {ready ? 'Ready' : ACT_TITLE[stay.act]}
        </h1>
      </HeroVehicle>

      {/* ── 3 · WHAT WE WROTE, AND HOW FAR IT HAS GOT ── */}
      <Section rhythm="line">
        <Panel>
          <div style={{ display: 'grid', gap: 'var(--st-gap)' }}>
            {/* the studio's own sentence, unattributed - the truest line here */}
            <Emphasis aria-live="polite">{stay.narration}</Emphasis>

            {stay.arrivedAt && (
              <Whisper tone="ink-2">
                {/* once it is ready, "with us" is the wrong emphasis - the car
                    is waiting for its owner, not still in our hands */}
                {ready
                  ? `Arrived ${fmtClock(stay.arrivedAt)}.`
                  : `The ${name} is with us. Arrived ${fmtClock(stay.arrivedAt)}.`}
              </Whisper>
            )}

            <StageRail steps={steps} tone="ink" />

            {stay.timing && <Whisper tone="ink-2">{stay.timing}</Whisper>}
          </div>
        </Panel>
      </Section>

      {/* ── 4 · THE REVEAL - only when the car is actually finished ── */}
      {ready && (
        <Section title="Finished" rhythm="rest">
          <Panel>
            <div style={{ display: 'grid', gap: 'var(--st-gap)' }}>
              {stay.arrivalPhoto && stay.finishedPhoto && (
                <div style={{ borderRadius: 'var(--st-r-card)', overflow: 'hidden' }}>
                  <BeforeAfterSlider
                    before={stay.arrivalPhoto}
                    after={stay.finishedPhoto}
                    showLabels={false}
                    alt={`The ${name} on arrival and finished`}
                  />
                </div>
              )}
              <Body>
                {booking.usedMembershipWash
                  ? 'Covered by the Club.'
                  : stay.paid
                  ? 'Paid - thank you.'
                  : <>Pay at the desk · <Data tone="ink">₹{stay.amount.toLocaleString('en-IN')}</Data></>}
              </Body>
              {/* the studio's closing time, spoken the way the rest of the
                  product speaks time - 12-hour, never a 24-hour clock */}
              <Whisper tone="ink-2">Collect any time before {closingTime()}.</Whisper>
            </div>
          </Panel>
        </Section>
      )}

      {/* ── 5 · THE EVIDENCE - the visit's own photographs ── */}
      {frames.length > 0 && (
        <Section title="From the studio" rhythm="rest">
          <MediaGrid frames={frames} onOpen={setViewing} label="Photographs from this visit" />
        </Section>
      )}

      {/* the visible equivalent of the drag (accessibility law) */}
      <Section rhythm="rest">
        <Action variant="quiet" onClick={collapse}>Put it down</Action>
      </Section>

      <MediaViewer
        frames={viewerFrames}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
      />
    </motion.main>
  );
}

const fmtClock = (d: Date) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

/** COMPANY.hours.close is a 24-hour config value; the product speaks 12-hour. */
const closingTime = () => {
  const [h, m] = COMPANY.hours.close.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return fmtClock(d);
};
