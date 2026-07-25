'use client';
/**
 * HOME V2 - the customer's home surface, as a pure view.
 *
 * This component owns no state, no effects, no data and no decisions. Every
 * value it renders and every callback it fires is handed to it by
 * `app/app/page.tsx`, which remains the controller: Firebase, the session, the
 * ownership engine, bookings, memberships, referrals and every sheet stay
 * exactly where they were.
 *
 * The composition is fixed and deliberately short:
 *
 *   hero → status pills → priority card → two quick actions → studio card
 *
 * Nothing else belongs on this screen.
 */
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { studioEase, move, tick } from '@/lib/os/motion';
import type { Tone } from '@/components/os/Chip';
import IdentityPlate from '@/components/os/IdentityPlate';
import HeroMedia from '@/components/os/HeroMedia';
import { getHeroImage } from '@/lib/os/hero';
import { glass } from '@/lib/os/surfaces';

/* ── the shapes the controller feeds in ─────────────────────────────────── */

export interface HeroVehicle {
  id: string;
  name: string;
  registration?: string;
  photo?: string;
}

export interface StatusPill {
  key: string;
  tone: Tone;
  label: string;
  onTap?: () => void;
}

export interface PriorityCard {
  /** the colour the whole card is speaking in */
  tone: Tone;
  /** the small line above the headline - "A note from the studio" */
  kicker: string;
  /** the state, in the chip on the right - "Not accepted" */
  chip: string;
  /** the one sentence that matters */
  headline: string;
  /** the supporting facts - "Llumar Platinum · 09:00" */
  detail?: string;
  /** the studio's own words, when there are any */
  note?: string;
  ctaLabel: string;
  onCta: () => void;
  icon: ReactNode;
}

export interface QuickAction {
  key: string;
  title: string;
  subtitle: string;
  tone: Tone;
  icon: ReactNode;
  onTap: () => void;
}

export interface StudioInfo {
  name: string;
  area: string;
  address: string;
  hours: string;
  photo?: string;
  onDirections: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
}

export interface HomeV2Props {
  vehicles: HeroVehicle[];
  page: number;
  onPage: (i: number) => void;
  /** the invitation that lives after the last car */
  onAddCar: () => void;
  /** the ownership state, in one word - "Cared for", "In care", "Ready" */
  stateWord: string;
  onStateTap: () => void;
  pills: StatusPill[];
  priority: PriorityCard | null;
  quickActions: QuickAction[];
  studio: StudioInfo;
  unread?: number;
  onNotifications: () => void;
}

/* ── tone → ink, the one place colour is resolved for this screen ───────── */
const INK: Record<Tone, string> = {
  ok: 'var(--st-ok)', warn: 'var(--st-warn)', info: 'var(--st-info)',
  urgent: 'var(--st-urgent)', neutral: 'var(--st-ink-3)',
};
const TINT: Record<Tone, string> = {
  ok: 'var(--st-ok-bg)', warn: 'var(--st-warn-bg)', info: 'var(--st-info-bg)',
  urgent: 'var(--st-urgent-bg)', neutral: 'var(--st-neutral-bg)',
};

/** the shared glass material - every panel across the product is cut from it
 *  (lib/os/surfaces), so the Glance and the Stay read as one surface */

const BellIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none"
    stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8.6a6 6 0 1 0-12 0c0 5-2.2 6.4-2.2 6.4h16.4S18 13.6 18 8.6" />
    <path d="M13.7 19a2 2 0 0 1-3.4 0" />
  </svg>
);

const ArrowGlyph = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h13M12.5 6l6 6-6 6" />
  </svg>
);

export default function HomeV2({
  vehicles, page, onPage, onAddCar,
  stateWord, onStateTap, pills, priority, quickActions, studio,
  unread = 0, onNotifications,
}: HomeV2Props) {
  const reduced = useReducedMotion();

  /** the standard entrance: content lifts once, never bounces */
  const rise = (delay = 0) => reduced ? {} : {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: move, ease: studioEase, delay },
  };

  return (
    <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--st-dock-clear, 78px) + var(--st-rest))' }}>

      {/* ── HERO ───────────────────────────────────────────────────────────
          The car fills the top of the screen; the state it is in is the only
          headline. Swiping the hero moves between cars - everything below is
          fed from whichever one is in view. */}
      <section style={{ position: 'relative' }}>
        <div
          onScroll={e => {
            const el = e.currentTarget;
            const next = Math.round(el.scrollLeft / el.clientWidth);
            if (next !== page) onPage(next);
          }}
          style={{
            display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
          }}
        >
          {vehicles.map(v => (
            <div key={v.id} style={{
              minWidth: '100%', scrollSnapAlign: 'start',
              position: 'relative', height: '52vh', minHeight: 340, overflow: 'hidden',
              background: 'var(--st-stage)',
            }}>
              {/* the shared hero image - identical logic, fallback and scrim to
                  the Stay (components/os/HeroMedia · lib/os/hero) */}
              <HeroMedia
                photo={getHeroImage(v)}
                fallback={<IdentityPlate name={v.name} registration={v.registration} variant="band" />}
                alt={v.name}
                priority
                scrimTo="var(--st-paper)"
              />
            </div>
          ))}

          {/* the invitation after the last car */}
          <button
            onClick={onAddCar}
            style={{
              minWidth: '100%', scrollSnapAlign: 'start', height: '52vh', minHeight: 340,
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              background: 'var(--st-gallery)', border: 'none',
              fontFamily: 'var(--st-display)', fontWeight: 600, fontSize: 20,
              color: 'var(--st-ink-2)',
            }}
          >
            Add a car
          </button>
        </div>

        {/* the bell - floating glass, top right */}
        <motion.button
          onClick={onNotifications}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          whileTap={reduced ? undefined : { scale: 0.94 }}
          transition={{ duration: tick, ease: studioEase }}
          style={{
            ...glass, position: 'absolute', zIndex: 2,
            top: 'calc(env(safe-area-inset-top) + 14px)', right: 'var(--st-inset)',
            width: 44, height: 44, borderRadius: 999, cursor: 'pointer',
            display: 'grid', placeItems: 'center', color: 'var(--st-ink)',
          }}
        >
          {BellIcon}
          {unread > 0 && (
            <span aria-hidden style={{
              position: 'absolute', top: 10, right: 11, width: 7, height: 7,
              borderRadius: 999, background: 'var(--st-warn)',
            }} />
          )}
        </motion.button>

        {/* the headline sits over the hero's floor, reading as one frame */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1,
          padding: '0 var(--st-inset)',
        }}>
          <motion.button
            onClick={onStateTap}
            {...rise(0.04)}
            whileTap={reduced ? undefined : { scale: 0.99 }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              fontFamily: 'var(--st-display)', fontWeight: 700,
              fontSize: 'clamp(44px, 12vw, 60px)', lineHeight: 0.94,
              letterSpacing: '-0.04em', color: 'var(--st-ink)',
            }}
          >
            {stateWord}
          </motion.button>

          {/* ── STATUS PILLS ─────────────────────────────────────────── */}
          {pills.length > 0 && (
            <motion.div
              {...rise(0.08)}
              style={{
                display: 'flex', gap: 'var(--st-breath)', flexWrap: 'wrap',
                marginTop: 'var(--st-gap)',
              }}
            >
              {pills.map(p => (
                <motion.button
                  key={p.key}
                  onClick={p.onTap}
                  disabled={!p.onTap}
                  whileTap={p.onTap && !reduced ? { scale: 0.96 } : undefined}
                  transition={{ duration: tick, ease: studioEase }}
                  style={{
                    ...glass, display: 'inline-flex', alignItems: 'center', gap: 8,
                    borderRadius: 999, padding: '9px 15px', minHeight: 38,
                    cursor: p.onTap ? 'pointer' : 'default',
                    fontFamily: 'var(--st-data)', fontSize: 12, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: INK[p.tone],
                  }}
                >
                  <span aria-hidden style={{
                    width: 7, height: 7, borderRadius: 999, background: INK[p.tone],
                  }} />
                  {p.label}
                  {p.onTap && <span aria-hidden style={{ opacity: 0.6, fontSize: 11 }}>↗</span>}
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>
      </section>

      {/* ── PRIORITY CARD ──────────────────────────────────────────────── */}
      {priority && (
        <motion.section {...rise(0.12)} style={{ padding: '0 var(--st-inset)', marginTop: 'var(--st-inset)' }}>
          <div style={{
            ...glass, position: 'relative', borderRadius: 'var(--st-r-sheet)',
            padding: 'var(--st-inset)', overflow: 'hidden',
          }}>
            {/* the accent edge - the card's whole state in one stroke */}
            <span aria-hidden style={{
              position: 'absolute', left: 0, top: 18, bottom: 18, width: 3,
              borderRadius: 999, background: INK[priority.tone],
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--st-line)' }}>
              <span aria-hidden style={{
                width: 42, height: 42, borderRadius: 13, flex: '0 0 auto',
                display: 'grid', placeItems: 'center',
                background: TINT[priority.tone], color: INK[priority.tone],
              }}>
                {priority.icon}
              </span>
              <span style={{
                flex: 1, minWidth: 0, fontFamily: 'var(--st-text)', fontSize: 15,
                color: 'var(--st-ink-2)',
              }}>
                {priority.kicker}
              </span>
              <span style={{
                flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6,
                background: TINT[priority.tone], color: INK[priority.tone],
                borderRadius: 999, padding: '5px 11px',
                fontFamily: 'var(--st-text)', fontSize: 12.5, whiteSpace: 'nowrap',
              }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />
                {priority.chip}
              </span>
            </div>

            <p style={{
              margin: 'var(--st-inset) 0 0', fontFamily: 'var(--st-display)', fontWeight: 620,
              fontSize: 'clamp(20px, 5.4vw, 25px)', lineHeight: 1.22,
              letterSpacing: '-0.01em', color: 'var(--st-ink)',
            }}>
              {priority.headline}
            </p>

            {priority.detail && (
              <p style={{
                margin: '8px 0 0', fontFamily: 'var(--st-text)', fontSize: 15,
                color: 'var(--st-ink-3)',
              }}>
                {priority.detail}
              </p>
            )}

            {priority.note && (
              <p style={{
                margin: 'var(--st-line) 0 0', fontFamily: 'var(--st-text)', fontSize: 15,
                lineHeight: 1.5, color: 'var(--st-ink-2)',
              }}>
                {priority.note}
              </p>
            )}

            <motion.button
              onClick={priority.onCta}
              whileTap={reduced ? undefined : { scale: 0.98 }}
              transition={{ duration: tick, ease: studioEase }}
              style={{
                marginTop: 'var(--st-inset)', background: 'transparent', border: 'none',
                padding: 0, cursor: 'pointer', minHeight: 44,
                display: 'inline-flex', alignItems: 'center', gap: 10,
                fontFamily: 'var(--st-text)', fontWeight: 560, fontSize: 17,
                color: INK[priority.tone],
              }}
            >
              {priority.ctaLabel}
              {ArrowGlyph}
            </motion.button>
          </div>
        </motion.section>
      )}

      {/* ── QUICK ACTIONS ──────────────────────────────────────────────── */}
      {quickActions.length > 0 && (
        <motion.section
          {...rise(0.16)}
          style={{
            padding: '0 var(--st-inset)', marginTop: 'var(--st-line)',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--st-line)',
          }}
        >
          {quickActions.slice(0, 2).map(a => (
            <motion.button
              key={a.key}
              onClick={a.onTap}
              whileTap={reduced ? undefined : { scale: 0.985 }}
              transition={{ duration: tick, ease: studioEase }}
              style={{
                ...glass, borderRadius: 'var(--st-r-sheet)', padding: 'var(--st-gap)',
                cursor: 'pointer', textAlign: 'left', minWidth: 0,
                display: 'flex', flexDirection: 'column', gap: 'var(--st-line)',
              }}
            >
              <span aria-hidden style={{
                width: 40, height: 40, borderRadius: 12,
                display: 'grid', placeItems: 'center',
                background: TINT[a.tone], color: INK[a.tone],
              }}>
                {a.icon}
              </span>
              <span style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                gap: 8, minWidth: 0,
              }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontFamily: 'var(--st-display)', fontWeight: 620,
                    fontSize: 17, lineHeight: 1.2, color: 'var(--st-ink)',
                  }}>
                    {a.title}
                  </span>
                  <span style={{
                    display: 'block', marginTop: 3, fontFamily: 'var(--st-text)',
                    fontSize: 13.5, color: 'var(--st-ink-3)',
                  }}>
                    {a.subtitle}
                  </span>
                </span>
                <span aria-hidden style={{
                  flex: '0 0 auto', width: 32, height: 32, borderRadius: 999,
                  display: 'grid', placeItems: 'center', color: 'var(--st-ink-2)',
                  border: '1px solid var(--st-hairline)',
                }}>
                  {ArrowGlyph}
                </span>
              </span>
            </motion.button>
          ))}
        </motion.section>
      )}

      {/* ── STUDIO CARD ────────────────────────────────────────────────── */}
      <motion.section {...rise(0.2)} style={{ padding: '0 var(--st-inset)', marginTop: 'var(--st-line)' }}>
        <div style={{ ...glass, borderRadius: 'var(--st-r-sheet)', padding: 'var(--st-gap)' }}>
          <div style={{ display: 'flex', gap: 'var(--st-gap)', alignItems: 'stretch' }}>
            <div style={{
              position: 'relative', flex: '0 0 38%', maxWidth: 168, minHeight: 132,
              borderRadius: 'var(--st-r-card)', overflow: 'hidden',
              background: 'var(--st-gallery)',
            }}>
              {studio.photo && (
                <Image src={studio.photo} alt="" fill sizes="40vw" loading="lazy"
                  style={{ objectFit: 'cover' }} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{
                margin: 0, fontFamily: 'var(--st-display)', fontWeight: 620, fontSize: 18,
                lineHeight: 1.25, color: 'var(--st-ink)',
              }}>
                {studio.name} <span style={{ color: 'var(--st-ink-3)' }}>· {studio.area}</span>
              </p>
              <p style={{
                margin: 0, fontFamily: 'var(--st-text)', fontSize: 13.5, lineHeight: 1.45,
                color: 'var(--st-ink-3)',
              }}>
                {studio.address}
              </p>
              <p style={{
                margin: '2px 0 0', fontFamily: 'var(--st-data)', fontSize: 13,
                color: 'var(--st-info)',
              }}>
                {studio.hours}
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--st-breath)',
            marginTop: 'var(--st-gap)',
          }}>
            {[
              { key: 'directions', label: 'Directions', tone: 'info' as Tone, onTap: studio.onDirections, icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round"><path d="M21 3 10.5 21l-2-8.5L0 10.5z" transform="translate(1.5 0)" /></svg>
              ) },
              { key: 'call', label: 'Call', tone: 'ok' as Tone, onTap: studio.onCall, icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 16.9v2.8a1.9 1.9 0 0 1-2.1 1.9 18.6 18.6 0 0 1-8.1-2.9 18.3 18.3 0 0 1-5.6-5.6A18.6 18.6 0 0 1 2.8 5a1.9 1.9 0 0 1 1.9-2.1h2.8a1.9 1.9 0 0 1 1.9 1.6c.1 1 .4 1.9.7 2.8a1.9 1.9 0 0 1-.4 2l-1.2 1.2a15 15 0 0 0 5.6 5.6l1.2-1.2a1.9 1.9 0 0 1 2-.4c.9.3 1.8.6 2.8.7a1.9 1.9 0 0 1 1.6 1.9z" /></svg>
              ) },
              { key: 'whatsapp', label: 'WhatsApp', tone: 'ok' as Tone, onTap: studio.onWhatsApp, icon: (
                <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3.2 20.8 4.5 16A8.5 8.5 0 1 1 8 19.5z" /><path d="M8.9 8.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.3 0 .5-.1.6l-.4.5c-.1.2-.2.3 0 .6a7 7 0 0 0 2.8 2.4c.3.1.5.1.6 0l.5-.6c.2-.2.4-.2.6-.1l1.6.8c.3.2.4.3.4.5a1.7 1.7 0 0 1-1.6 1.6 6.9 6.9 0 0 1-5-2.6 6.6 6.6 0 0 1-1.7-3.5 2.7 2.7 0 0 1 .8-1.9z" /></svg>
              ) },
            ].map(b => (
              <motion.button
                key={b.key}
                onClick={b.onTap}
                whileTap={reduced ? undefined : { scale: 0.96 }}
                transition={{ duration: tick, ease: studioEase }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  padding: '13px 4px', cursor: 'pointer', minWidth: 0,
                  borderRadius: 'var(--st-r-card)',
                  background: 'transparent', border: '1px solid var(--st-hairline)',
                }}
              >
                <span aria-hidden style={{
                  width: 36, height: 36, borderRadius: 11,
                  display: 'grid', placeItems: 'center',
                  background: TINT[b.tone], color: INK[b.tone],
                }}>
                  {b.icon}
                </span>
                <span style={{
                  fontFamily: 'var(--st-text)', fontSize: 12.5, color: 'var(--st-ink-2)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                }}>
                  {b.label}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.section>
    </div>
  );
}
