'use client';
/**
 * THE CHAPTER - one sealed Visit, kept.
 * (Constitution Art. 3 · docs/VISIT-OBJECT.md · AUTOMODZ-OS-DESIGN-LANGUAGE.md)
 *
 * The permanent, shareable reading of work that is finished. It is the same
 * object the live Visit shows, at rest - so it is built from exactly the same
 * materials, and reads as Home continued rather than as a document viewer:
 *
 *   HeroVehicle · Section · Panel · StageRail · MediaGrid · MediaViewer · StateCard
 *
 * ONE LAYOUT, TWO READINGS. `owner={false}` is the public share: it keeps the
 * car, the work and the evidence, and drops the money, the papers and anything
 * internal. There is no second Chapter component.
 *
 * STRICTLY READ-ONLY. Nothing here mutates: no renew, no rebook, no edit. A
 * record that can be changed from the surface that displays it is not a
 * record. Sharing and opening a document are reads.
 *
 * What it deletes: a bespoke masthead, a hand-rolled evidence figure, a
 * hand-rolled promise card, a hand-rolled receipt, its own kicker and its own
 * scroll-reveal - the last of which gated content on `whileInView` opacity and
 * so violated the motion law (Design Language §5).
 */
import { useMemo, useState } from 'react';
import { COMPANY } from '@/lib/company';
import { timeInCare, type ChapterModel } from '@/lib/os/chapter';
import type { LiveProtection } from '@/lib/os/protection';
import HeroVehicle from './HeroVehicle';
import Section from './Section';
import Panel from './Panel';
import StageRail, { type RailStep } from './StageRail';
import MediaGrid, { type MediaFrame } from './MediaGrid';
import MediaViewer from './MediaViewer';
import StateCard from './StateCard';
import Action from './Action';
import Wordmark from '@/components/ui/Wordmark';
import { Emphasis, Body, Data, Whisper } from './text';

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

interface ChapterProps {
  chapter: ChapterModel;
  /** what protects the car because of this visit - the one protection engine */
  protections: LiveProtection[];
  owner: boolean;
  shareUrl?: string;
  onBack?: () => void;
}

export default function Chapter({ chapter, protections, owner, shareUrl, onBack }: ChapterProps) {
  const [shared, setShared] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const share = async () => {
    if (!shareUrl) return;
    const data = { title: `${chapter.vehicleName} - ${chapter.title}`, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(shareUrl); setShared(true); }
    } catch { /* a cancelled share is not an error */ }
  };

  const frames = useMemo<MediaFrame[]>(
    () => chapter.evidence.map((s, i) => ({ id: `${s.url}_${i}`, url: s.url, caption: s.label })),
    [chapter.evidence],
  );
  const viewerFrames = useMemo(
    () => frames.map(f => ({ url: f.url, caption: f.caption })),
    [frames],
  );

  /* The transformation this visit can PROVE. A sealed visit shows only the
     acts it actually recorded - never greyed placeholders implying work was
     skipped that probably wasn't (JOURNEY-STAGES.md §7, Art. 1.6). */
  const steps = useMemo<RailStep[]>(() => {
    const seen = new Map<string, string>();
    chapter.evidence.forEach(s => { if (!seen.has(s.act)) seen.set(s.act, s.label); });
    return [...seen.entries()].map(([act, title]) => ({ key: act, title, state: 'done' as const }));
  }, [chapter.evidence]);

  const [lead, ...rest] = chapter.work;

  return (
    <article style={{ paddingBottom: 'var(--st-content-floor)' }}>
      {/* ── THE CAR - the same hero every surface uses ── */}
      <HeroVehicle
        name={chapter.vehicleName}
        registration={chapter.registration}
        photo={chapter.hero}
        priority
      >
        <Data tone="ink-2" style={{ display: 'block', marginBottom: 'var(--st-breath)' }}>
          {fmtLong(chapter.dateISO)} · {COMPANY.name}
        </Data>
        <h1 style={{
          margin: 0, fontFamily: 'var(--st-display)', fontWeight: 700,
          fontSize: 'clamp(34px, 10vw, 56px)', lineHeight: 0.96,
          letterSpacing: '-0.03em', color: 'var(--st-ink)',
        }}>
          {chapter.title}
        </h1>
      </HeroVehicle>

      {/* ── WHAT WAS DONE, AND HOW FAR IT WENT ── */}
      <Section rhythm="line">
        <Panel>
          <div style={{ display: 'grid', gap: 'var(--st-gap)' }}>
            {lead && <Emphasis>{lead}</Emphasis>}
            {rest.map((line, i) => <Body key={i} tone="ink-2">{line}</Body>)}

            {steps.length > 1 && <StageRail steps={steps} tone="ink" label="What this visit went through" />}

            {chapter.minutesInCare !== null && (
              <Whisper tone="ink-2">
                Cared for at {COMPANY.name} · {timeInCare(chapter.minutesInCare)}.
              </Whisper>
            )}
          </div>
        </Panel>
      </Section>

      {/* ── THE EVIDENCE ── */}
      {frames.length > 0 && (
        <Section title="The evidence" rhythm="rest">
          <MediaGrid frames={frames} onOpen={setViewing} label="Photographs from this visit" />
        </Section>
      )}

      {/* ── THE PROMISE - the one card, read-only ── */}
      {protections.length > 0 && (
        <Section title="The promise" rhythm="rest">
          <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
            {protections.map(p => <StateCard key={p.id} protection={p} />)}
          </div>
        </Section>
      )}

      {/* ── THE RECEIPT - the owner's reading only ── */}
      {owner && (
        <Section title="The receipt" rhythm="rest">
          <Panel>
            <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                gap: 'var(--st-gap)',
              }}>
                <Body>{chapter.coveredByClub ? 'Covered by the Club' : chapter.title}</Body>
                <Data tone="ink" style={{ fontSize: 18 }}>
                  {chapter.coveredByClub ? '₹0' : `₹${chapter.amount.toLocaleString('en-IN')}`}
                </Data>
              </div>
              <Whisper tone="ink-2">
                {chapter.paid
                  ? `Paid${chapter.paymentMethod ? ` by ${chapter.paymentMethod === 'upi' ? 'UPI' : 'cash'}` : ''}.`
                  : 'Payment pending at the studio.'}
              </Whisper>

              {/* the papers are one tap behind the record, never the record
                  itself (Constitution Art. 10 - never show documents) */}
              {chapter.documents.length > 0 && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 'var(--st-inset)',
                  paddingTop: 'var(--st-line)', borderTop: '1px solid var(--st-hairline)',
                }}>
                  {chapter.documents.map(doc => (
                    <Action key={doc.href} variant="external" scale="inline"
                      onClick={() => window.open(doc.href, '_blank', 'noopener,noreferrer')}>
                      {doc.title}
                    </Action>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </Section>
      )}

      {/* ── THE CLOSE ── */}
      <Section rhythm="rest">
        <div style={{ display: 'flex', gap: 'var(--st-inset)', flexWrap: 'wrap', alignItems: 'baseline' }}>
          {onBack && <Action onClick={onBack}>Back to the car</Action>}
          {shareUrl && (
            <Action variant="forward" onClick={share}>
              {shared ? 'Link copied' : 'Share this chapter'}
            </Action>
          )}
        </div>
        <span style={{ display: 'block', marginTop: 'var(--st-rest)' }}><Wordmark height={14} /></span>
        {/* a letterhead sign-off is still read, so it takes ink-2 - ink-3
            fails AA at this size (Design Language §7.5) */}
        {owner && (
          <Data tone="ink-2" style={{ display: 'block', marginTop: 'var(--st-breath)' }}>
            {COMPANY.address}
          </Data>
        )}
      </Section>

      <MediaViewer
        frames={viewerFrames}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
      />
    </article>
  );
}
