'use client';
/**
 * THE CHAPTER (P2D1 §C5 · P2D3 C-13) — one completed visit as a document
 * worth keeping. The invoice reborn as a keepsake: the finished car, the
 * work, the evidence, the people, the promise, and — for the owner only —
 * the money and the papers.
 *
 * One layout serves both readings. `owner={false}` is the public share: it
 * carries the beauty and drops the money, the phone number and anything
 * internal. There is no second page and no second layout.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { COMPANY } from '@/lib/company';
import { rise } from '@/lib/os/motion';
import { timeInCare, type ChapterModel } from '@/lib/os/chapter';
import { PROTECTION_WORD, type Protection } from '@/lib/cx/protection';
import IdentityPlate from './IdentityPlate';
import Layer from './Layer';
import PhotoBand from './PhotoBand';
import DocumentCard, { DocumentGrid } from './DocumentCard';
import Action from './Action';
import { Display, Emphasis, Body, Data, Whisper } from './text';

const fmtLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonthYear = (d: Date) =>
  d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

interface ChapterProps {
  chapter: ChapterModel;
  /** what protects the car because of this visit (the protection engine's own facts) */
  protections: Protection[];
  owner: boolean;
  /** the share link, when this reading can produce one */
  shareUrl?: string;
  onBack?: () => void;
}

export default function Chapter({ chapter, protections, owner, shareUrl, onBack }: ChapterProps) {
  const [shared, setShared] = useState(false);

  const share = async () => {
    if (!shareUrl) return;
    const data = { title: `${chapter.vehicleName} — ${chapter.title}`, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(shareUrl); setShared(true); }
    } catch { /* a cancelled share is not an error */ }
  };

  return (
    <article style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--st-movement))' }}>
      {/* ── the hero: the finished car, or the car's own plate ── */}
      <header style={{
        position: 'relative', minHeight: '52vh', display: 'flex', alignItems: 'flex-end',
        background: chapter.hero ? 'var(--st-stage)' : undefined, overflow: 'hidden',
      }}>
        {chapter.hero ? (
          <>
            <motion.img
              src={chapter.hero} alt={`The finished ${chapter.vehicleName}`}
              {...rise}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div aria-hidden style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
              background: 'linear-gradient(transparent, var(--st-scrim-strong))',
            }} />
          </>
        ) : (
          <IdentityPlate name={chapter.vehicleName} registration={chapter.registration} variant="band" />
        )}
        <div style={{ position: 'relative', padding: 'var(--st-rest) var(--st-inset) var(--st-inset)', width: '100%' }}>
          <Display tone={chapter.hero ? 'over' : 'ink'}>{chapter.title}</Display>
          <Data tone={chapter.hero ? 'over-2' : 'ink-2'} style={{ display: 'block', marginTop: 'var(--st-breath)' }}>
            {fmtLong(chapter.dateISO)} · {COMPANY.name} Studio
          </Data>
        </div>
      </header>

      {/* ── the work ── */}
      <Layer title="The work">
        <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
          {chapter.work.map((line, i) => <Body key={i} tone={i === 0 ? 'ink' : 'ink-2'}>{line}</Body>)}
        </div>
      </Layer>

      {/* ── the evidence, in the order it happened ── */}
      {chapter.evidence.length > 0 && (
        <Layer title="The evidence">
          <div style={{ display: 'grid', gap: 'var(--st-rest)' }}>
            {chapter.evidence.map((shot, i) => (
              <PhotoBand
                key={`${shot.url}-${i}`}
                src={shot.url}
                alt={`${shot.label} — the ${chapter.vehicleName}`}
                ratio="memory"
                caption={shot.label}
              />
            ))}
          </div>
        </Layer>
      )}

      {/* ── the people and the time ── */}
      {(chapter.lead || chapter.minutesInCare !== null) && (
        <Layer title="The craft">
          {chapter.lead && (
            <Body tone="ink-2">
              Cared for by {chapter.lead}
              {chapter.helpers.length > 0 && ` · with ${chapter.helpers.join(' and ')}`}.
            </Body>
          )}
          {chapter.minutesInCare !== null && (
            <Whisper style={{ marginTop: 'var(--st-breath)' }}>
              {timeInCare(chapter.minutesInCare)}.
            </Whisper>
          )}
        </Layer>
      )}

      {/* ── the promise: what protects the car now (the protection engine) ── */}
      {protections.length > 0 && (
        <Layer title="The promise">
          <div style={{ display: 'grid', gap: 'var(--st-gap)' }}>
            {protections.map(p => (
              <div key={p.kind} style={{
                background: 'var(--st-gallery)', borderRadius: 'var(--st-r-sheet)', padding: 'var(--st-inset)',
              }}>
                <Body>
                  {PROTECTION_WORD[p.kind]} — {p.until
                    ? <><span style={{ color: p.active ? 'var(--st-assent)' : undefined }}>
                        {p.active ? 'protected' : 'ran its course'}
                      </span> until {fmtMonthYear(p.until)}</>
                    : 'applied'}.
                </Body>
                {p.warranty && (
                  <Whisper style={{ marginTop: 'var(--st-hair)' }}>
                    {p.warranty} warranty, filed to the {chapter.vehicleName}’s papers.
                  </Whisper>
                )}
              </div>
            ))}
          </div>
        </Layer>
      )}

      {/* ── the money and the papers: the owner's reading only ── */}
      {owner && (
        <>
          <Layer title="The amount">
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              gap: 'var(--st-gap)', paddingBottom: 'var(--st-line)',
              borderBottom: '1px solid var(--st-hairline)',
            }}>
              <Body>{chapter.coveredByClub ? 'Covered by the Club' : chapter.title}</Body>
              <Data>
                {chapter.coveredByClub ? '₹0' : `₹${chapter.amount.toLocaleString('en-IN')}`}
              </Data>
            </div>
            <Whisper style={{ marginTop: 'var(--st-line)' }}>
              {chapter.paid
                ? `Paid${chapter.paymentMethod ? ` by ${chapter.paymentMethod === 'upi' ? 'UPI' : 'cash'}` : ''}.`
                : 'Payment pending at the studio.'}
            </Whisper>
          </Layer>

          {chapter.documents.length > 0 && (
            <Layer title="The papers">
              <DocumentGrid>
                {chapter.documents.map(doc => (
                  <DocumentCard key={doc.href} title={doc.title} detail={doc.detail} href={doc.href} />
                ))}
              </DocumentGrid>
            </Layer>
          )}
        </>
      )}

      {/* ── the close ── */}
      <Layer>
        <div style={{ display: 'flex', gap: 'var(--st-inset)', flexWrap: 'wrap', alignItems: 'baseline' }}>
          {onBack && <Action onClick={onBack}>Back to the car</Action>}
          {shareUrl && <Action onClick={share}>{shared ? 'Link copied' : 'Share this chapter'}</Action>}
        </div>
        <Whisper style={{ marginTop: 'var(--st-inset)', fontFamily: 'var(--st-display)', letterSpacing: '0.08em' }}>
          AUTOMODZ
        </Whisper>
        {owner && <Data tone="ink-3" style={{ display: 'block', marginTop: 'var(--st-breath)' }}>{COMPANY.address}</Data>}
      </Layer>
    </article>
  );
}
