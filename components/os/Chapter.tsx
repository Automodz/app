'use client';
/**
 * THE CHAPTER (P2D1 §C5 · P2D3 C-13) - one completed visit as a document worth
 * keeping, read as an editorial spread: a full-frame masthead of the finished
 * car, an opening line, the evidence as full-bleed photography, a craft byline,
 * the promise, and - for the owner only - a receipt and the papers. No section
 * headings; the photography and the type carry the story.
 *
 * One layout serves both readings. `owner={false}` is the public share: it keeps
 * the beauty and drops the money, the phone number and anything internal.
 */
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { COMPANY } from '@/lib/company';
import { studioEase, scene } from '@/lib/os/motion';
import { vtName } from '@/lib/os/navigate';
import { timeInCare, type ChapterModel } from '@/lib/os/chapter';
import { PROTECTION_WORD, type Protection } from '@/lib/cx/protection';
import IdentityPlate from './IdentityPlate';
import DocumentCard, { DocumentGrid } from './DocumentCard';
import Action from './Action';
import { Emphasis, Body, Data, Whisper } from './text';
import Wordmark from '@/components/ui/Wordmark';

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

/** Cinematic scroll reveal - the editorial rises into frame, once, with depth. */
function Reveal({ children, y = 24 }: { children: React.ReactNode; y?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12%' }}
      transition={{ duration: scene, ease: studioEase }}
    >
      {children}
    </motion.div>
  );
}

/** A small mono kicker - the editorial device that replaces a section heading. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--st-data)', fontSize: 11, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: 'var(--st-ink-3)',
    }}>{children}</span>
  );
}

export default function Chapter({ chapter, protections, owner, shareUrl, onBack }: ChapterProps) {
  const [shared, setShared] = useState(false);
  const reduced = useReducedMotion();

  const share = async () => {
    if (!shareUrl) return;
    const data = { title: `${chapter.vehicleName} - ${chapter.title}`, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(shareUrl); setShared(true); }
    } catch { /* a cancelled share is not an error */ }
  };

  const heroBreath = reduced ? {} : {
    initial: { scale: 1.06, opacity: 0 }, animate: { scale: 1, opacity: 1 },
    transition: { duration: scene, ease: studioEase },
  };
  const [lead, ...rest] = chapter.work;

  return (
    <article style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--st-movement))', overflowX: 'clip' }}>
      {/* ── THE MASTHEAD: the finished car holds the whole frame ── */}
      <header style={{
        position: 'relative', minHeight: '100svh', display: 'flex', alignItems: 'flex-end',
        background: chapter.hero ? 'var(--st-stage)' : undefined, overflow: 'hidden',
        ...vtName('hero-vehicle'),
      }}>
        {chapter.hero ? (
          <>
            <motion.img
              src={chapter.hero} alt={`The finished ${chapter.vehicleName}`}
              {...heroBreath}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div aria-hidden style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, var(--st-scrim-strong) 0%, transparent 44%, transparent 82%, var(--st-scrim-soft) 100%)',
            }} />
          </>
        ) : (
          <IdentityPlate name={chapter.vehicleName} registration={chapter.registration} variant="band" />
        )}

        {/* back affordance, held quiet over the frame */}
        {onBack && (
          <button
            onClick={onBack} aria-label="Back to the car" className="st-tap"
            style={{
              position: 'absolute', top: 'calc(env(safe-area-inset-top) + 16px)', left: 'var(--st-gap)', zIndex: 2,
              width: 40, height: 40, borderRadius: 999, border: 'none', cursor: 'pointer',
              display: 'grid', placeItems: 'center',
              background: chapter.hero ? 'var(--st-glass-on-photo)' : 'var(--st-linen)',
              backdropFilter: 'var(--st-glass-blur)', WebkitBackdropFilter: 'var(--st-glass-blur)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M11 3.5 5.5 9 11 14.5" stroke={chapter.hero ? 'var(--st-over)' : 'var(--st-ink)'}
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: scene, ease: studioEase, delay: 0.12 }}
          style={{ position: 'relative', padding: 'var(--st-rest) var(--st-inset) var(--st-rest)', width: '100%' }}
        >
          <Data tone={chapter.hero ? 'over-2' : 'ink-2'} style={{ display: 'block', marginBottom: 'var(--st-line)' }}>
            {fmtLong(chapter.dateISO)} · {COMPANY.name} Studio
          </Data>
          <h1 style={{
            fontFamily: 'var(--st-display)', fontWeight: 660, letterSpacing: '-0.03em',
            fontSize: 'clamp(40px, 12vw, 76px)', lineHeight: 0.98,
            color: chapter.hero ? 'var(--st-over)' : 'var(--st-ink)', margin: 0,
          }}>
            {chapter.title}
          </h1>
        </motion.div>
      </header>

      {/* ── THE OPENING LINE: the work, no heading ── */}
      <Reveal>
        <section style={{ padding: 'var(--st-movement) var(--st-inset) 0' }}>
          {lead && (
            <p style={{
              fontFamily: 'var(--st-display)', fontWeight: 500, letterSpacing: '-0.01em',
              fontSize: 'clamp(22px, 6vw, 30px)', lineHeight: 1.3, color: 'var(--st-ink)', margin: 0,
            }}>
              {lead}
            </p>
          )}
          {rest.length > 0 && (
            <div style={{ display: 'grid', gap: 'var(--st-line)', marginTop: 'var(--st-inset)' }}>
              {rest.map((line, i) => <Body key={i} tone="ink-2">{line}</Body>)}
            </div>
          )}
        </section>
      </Reveal>

      {/* ── THE EVIDENCE: full-bleed photography, cinematic, figure-numbered ── */}
      {chapter.evidence.map((shot, i) => (
        <Reveal key={`${shot.url}-${i}`} y={40}>
          <figure style={{ margin: 'var(--st-movement) 0 0' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', background: 'var(--st-stage)', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.url} alt={`${shot.label} - the ${chapter.vehicleName}`} loading="lazy"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <figcaption style={{
              display: 'flex', alignItems: 'baseline', gap: 'var(--st-line)',
              padding: 'var(--st-gap) var(--st-inset) 0',
            }}>
              <Kicker>{String(i + 1).padStart(2, '0')}</Kicker>
              <Body tone="ink-2">{shot.label}</Body>
            </figcaption>
          </figure>
        </Reveal>
      ))}

      {/* ── THE BYLINE: the craft, as a bylined line, not a section ── */}
      {(chapter.lead || chapter.minutesInCare !== null) && (
        <section style={{ padding: '0 var(--st-inset)', marginTop: 'var(--st-movement)' }}>
          <div style={{ height: 1, background: 'var(--st-hairline)', marginBottom: 'var(--st-inset)' }} />
          {chapter.lead && (
            <Emphasis tone="ink" style={{ fontSize: 'clamp(19px, 5vw, 22px)' }}>
              Cared for by {chapter.lead}
              {chapter.helpers.length > 0 && ` · with ${chapter.helpers.join(' and ')}`}.
            </Emphasis>
          )}
          {chapter.minutesInCare !== null && (
            <Whisper style={{ marginTop: 'var(--st-breath)' }}>{timeInCare(chapter.minutesInCare)}.</Whisper>
          )}
        </section>
      )}

      {/* ── THE PROMISE: what protects the car now (the protection engine) ── */}
      {protections.length > 0 && (
        <section style={{ padding: '0 var(--st-inset)', marginTop: 'var(--st-movement)' }}>
          <div style={{ display: 'grid', gap: 'var(--st-line)' }}>
            {protections.map(p => (
              <div key={p.kind} style={{
                position: 'relative', overflow: 'hidden',
                background: 'var(--st-gallery-fill)', border: '1px solid var(--st-hairline)',
                borderRadius: 'var(--st-r-sheet)', padding: 'var(--st-inset)',
                boxShadow: 'var(--st-hold), var(--st-edge)',
              }}>
                <Kicker>The promise</Kicker>
                <p style={{
                  margin: 'var(--st-breath) 0 0', fontFamily: 'var(--st-display)', fontWeight: 560,
                  fontSize: 'clamp(22px, 6vw, 28px)', letterSpacing: '-0.01em', color: 'var(--st-ink)',
                }}>
                  {PROTECTION_WORD[p.kind]}
                </p>
                <Body tone="ink-2" style={{ marginTop: 'var(--st-hair)' }}>
                  {p.until
                    ? <>
                        <span style={{ color: p.active ? 'var(--st-assent)' : undefined }}>
                          {p.active ? 'Protected' : 'Ran its course'}
                        </span> until {fmtMonthYear(p.until)}.
                      </>
                    : 'Applied.'}
                </Body>
                {p.warranty && (
                  <Whisper style={{ marginTop: 'var(--st-breath)' }}>
                    {p.warranty} warranty, filed to the {chapter.vehicleName}’s papers.
                  </Whisper>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── THE RECEIPT: the owner's money and papers, as one kept object ── */}
      {owner && (
        <section style={{ padding: '0 var(--st-inset)', marginTop: 'var(--st-movement)' }}>
          <div style={{
            background: 'var(--st-card-fill)', border: '1px solid var(--st-hairline)',
            borderRadius: 'var(--st-r-sheet)', boxShadow: 'var(--st-hold), var(--st-edge)',
            padding: 'var(--st-inset)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              gap: 'var(--st-gap)', paddingBottom: 'var(--st-line)',
              borderBottom: '1px dashed var(--st-hairline)',
            }}>
              <Body>{chapter.coveredByClub ? 'Covered by the Club' : chapter.title}</Body>
              <span style={{ fontFamily: 'var(--st-data)', fontSize: 18, color: 'var(--st-ink)' }}>
                {chapter.coveredByClub ? '₹0' : `₹${chapter.amount.toLocaleString('en-IN')}`}
              </span>
            </div>
            <Whisper style={{ marginTop: 'var(--st-line)' }}>
              {chapter.paid
                ? `Paid${chapter.paymentMethod ? ` by ${chapter.paymentMethod === 'upi' ? 'UPI' : 'cash'}` : ''}.`
                : 'Payment pending at the studio.'}
            </Whisper>

            {chapter.documents.length > 0 && (
              <div style={{ marginTop: 'var(--st-inset)', paddingTop: 'var(--st-gap)', borderTop: '1px solid var(--st-hairline)' }}>
                <DocumentGrid>
                  {chapter.documents.map(doc => (
                    <DocumentCard key={doc.href} title={doc.title} detail={doc.detail} href={doc.href} />
                  ))}
                </DocumentGrid>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── THE CLOSE ── */}
      <section style={{ padding: '0 var(--st-inset)', marginTop: 'var(--st-movement)' }}>
        <div style={{ display: 'flex', gap: 'var(--st-inset)', flexWrap: 'wrap', alignItems: 'baseline' }}>
          {onBack && <Action onClick={onBack}>Back to the car</Action>}
          {shareUrl && <Action variant="forward" onClick={share}>{shared ? 'Link copied' : 'Share this chapter'}</Action>}
        </div>
        <span style={{ display: 'block', marginTop: 'var(--st-rest)' }}><Wordmark height={14} /></span>
        {owner && <Data tone="ink-3" style={{ display: 'block', marginTop: 'var(--st-breath)' }}>{COMPANY.address}</Data>}
      </section>
    </article>
  );
}
