'use client';
/**
 * THE DOCK - the customer product's one piece of persistent navigation.
 * (docs/AUTOMODZ-OS-IA.md §7 · AUTOMODZ-OS-DESIGN-LANGUAGE.md §4 · §8)
 *
 * Four entrances and one floating action. Book floats because it is a
 * CAPABILITY, not a concept (Constitution Art. 2) - the geometry says what the
 * constitution says, and when AI scheduling makes booking mostly disappear the
 * bar does not have a hole in it.
 *
 * WHAT THIS REBUILD FIXES, all measured in the audit:
 *   · the "Garage" slot opened a BLANK ADD-A-CAR FORM - the single worst
 *     interaction in the product. It now opens the Garage.
 *   · the wordmark pedestal took 199px of a 351px bar (57%) and squeezed four
 *     navigation targets to 31px each, below the 44px minimum, with labels
 *     colliding. Chrome never outranks function - the pedestal is gone.
 *   · it invented its own `bottom` offset. It now sits on the shared stacking
 *     contract, so nothing can collide with it again.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { studioEase, tick } from '@/lib/os/motion';

type Slot = { key: string; label: string; href: string; match: (p: string, sheet: string | null) => boolean; icon: React.ReactNode };

const stroke = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

const HomeIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path {...stroke} d="M3.5 10.4 12 3.8l8.5 6.6V19a1.5 1.5 0 0 1-1.5 1.5h-3.4v-5.3H8.4v5.3H5A1.5 1.5 0 0 1 3.5 19z" />
  </svg>
);
const GarageIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path {...stroke} d="M3.6 13.2 5.2 8.6A2 2 0 0 1 7.1 7.2h9.8a2 2 0 0 1 1.9 1.4l1.6 4.6" />
    <path {...stroke} d="M2.8 13.2h18.4v4.1H2.8zM6.4 17.3v1.6M17.6 17.3v1.6" />
    <circle {...stroke} cx="6.9" cy="15.2" r="0.9" /><circle {...stroke} cx="17.1" cy="15.2" r="0.9" />
  </svg>
);
const VisitsIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <rect {...stroke} x="3.5" y="5.2" width="17" height="15.3" rx="2.4" />
    <path {...stroke} d="M3.5 9.8h17M8.2 3.5v3.2M15.8 3.5v3.2" />
  </svg>
);
const YouIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <circle {...stroke} cx="12" cy="8.4" r="3.6" />
    <path {...stroke} d="M4.8 20.3a7.4 7.4 0 0 1 14.4 0" />
  </svg>
);
const BookIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path {...stroke} d="M12 5.2v13.6M5.2 12h13.6" />
  </svg>
);

/* Four entrances. Journey and Studio join this list when their routes exist;
   until then the Desk is the honest name for the visit index. */
const SLOTS: Slot[] = [
  { key: 'home', label: 'Home', href: '/app', icon: HomeIcon,
    match: (p, s) => p === '/app' && !s },
  { key: 'garage', label: 'Garage', href: '/app/garage', icon: GarageIcon,
    match: p => p.startsWith('/app/garage') },
  { key: 'visits', label: 'Visits', href: '/app?sheet=desk', icon: VisitsIcon,
    match: (p, s) => s === 'desk' || p.startsWith('/app/visit') || p.startsWith('/app/chapter') },
  { key: 'you', label: 'You', href: '/app/you', icon: YouIcon,
    match: p => p.startsWith('/app/you') },
];

export default function Dock() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const sheet = useSearchParams().get('sheet');
  const reduced = useReducedMotion();

  /* a full-screen takeover owns the screen; the dock steps aside for it */
  if (pathname.startsWith('/app/visit') || pathname.startsWith('/app/welcome')) return null;

  const active = SLOTS.find(s => s.match(pathname, sheet))?.key ?? '';

  return (
    <nav
      aria-label="AutoModz"
      style={{
        position: 'fixed', left: 0, right: 0,
        zIndex: 'var(--st-z-nav)' as unknown as number,
        // the shared stacking contract - no component invents its own offset
        bottom: 'calc(env(safe-area-inset-bottom) + var(--st-nav-gap))',
        paddingLeft: 'max(var(--st-line), env(safe-area-inset-left))',
        paddingRight: 'max(var(--st-line), env(safe-area-inset-right))',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        pointerEvents: 'auto',
        margin: '0 auto', maxWidth: 'var(--st-measure)',
        display: 'flex', alignItems: 'center', gap: 'var(--st-breath)',
      }}>
        {/* the bar */}
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch',
          height: 'var(--st-nav-h)',
          borderRadius: 'var(--st-r-sheet)',
          background: 'var(--st-glass)',
          backdropFilter: 'var(--st-glass-blur)', WebkitBackdropFilter: 'var(--st-glass-blur)',
          border: '1px solid var(--st-hairline)',
          boxShadow: 'var(--st-lift), var(--st-edge)',
          padding: '0 var(--st-hair)',
        }}>
          {SLOTS.map(slot => {
            const on = active === slot.key;
            return (
              <motion.button
                key={slot.key}
                onClick={() => router.replace(slot.href)}
                aria-label={slot.label}
                aria-current={on ? 'page' : undefined}
                whileTap={reduced ? undefined : { scale: 0.94 }}
                transition={{ duration: tick, ease: studioEase }}
                style={{
                  // four equal shares of the bar - never squeezed by chrome
                  flex: '1 1 0', minWidth: 0, minHeight: 44,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 3,
                  color: on ? 'var(--st-ink)' : 'var(--st-ink-3)',
                  transition: 'color var(--st-move) var(--st-ease)',
                }}
              >
                {slot.icon}
                <span style={{
                  fontFamily: 'var(--st-text)',
                  fontSize: 'clamp(9.5px, 2.8vw, 11px)', lineHeight: 1.2,
                  fontWeight: on ? 560 : 400,
                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {slot.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* BOOK - a capability, so it floats beside the bar rather than
            sitting in it as a fifth equal entrance (Art. 2) */}
        <motion.button
          onClick={() => router.replace('/app?sheet=arrange')}
          aria-label="Book a visit"
          whileTap={reduced ? undefined : { scale: 0.94 }}
          transition={{ duration: tick, ease: studioEase }}
          style={{
            flex: '0 0 auto',
            width: 'var(--st-nav-h)', height: 'var(--st-nav-h)',
            borderRadius: 'var(--st-r-sheet)',
            background: 'var(--st-ink)', color: 'var(--st-paper)',
            border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            boxShadow: 'var(--st-lift)',
          }}
        >
          {BookIcon}
        </motion.button>
      </div>
    </nav>
  );
}
