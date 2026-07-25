'use client';
/**
 * THE DOCK - the customer product's one piece of persistent navigation.
 *
 * A floating glass rail that never touches the edges of the screen: five slots,
 * with the studio's mark raised on a pedestal at the centre. It is chrome, so it
 * reads as machined - a hairline edge, a dark glass body, one accent for the
 * surface you are on and nothing else.
 *
 * It navigates to surfaces that already exist (the garage, the conversation,
 * the profile sheet); it invents no routes and owns no state.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { studioEase, tick } from '@/lib/os/motion';
import Wordmark from '@/components/ui/Wordmark';

type Slot = { key: string; label: string; href: string; icon: React.ReactNode };

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
const ProfileIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <circle {...stroke} cx="12" cy="8.4" r="3.6" />
    <path {...stroke} d="M4.8 20.3a7.4 7.4 0 0 1 14.4 0" />
  </svg>
);

export default function Dock() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sheet = params.get('sheet');

  // the live visit is a full-screen takeover - the dock steps aside for it
  if (pathname?.startsWith('/app/visit') || pathname?.startsWith('/app/welcome')) return null;

  const left: Slot[] = [
    { key: 'home', label: 'Home', href: '/app', icon: HomeIcon },
    { key: 'garage', label: 'Garage', href: '/app?sheet=car-form', icon: GarageIcon },
  ];
  const right: Slot[] = [
    { key: 'visits', label: 'Visits', href: '/app?sheet=desk', icon: VisitsIcon },
    { key: 'profile', label: 'Profile', href: '/app?sheet=you', icon: ProfileIcon },
  ];

  const activeKey =
    sheet === 'car-form' ? 'garage'
    : sheet === 'desk' ? 'visits'
    : sheet === 'you' ? 'profile'
    : pathname === '/app' && !sheet ? 'home'
    : '';

  const Item = ({ slot }: { slot: Slot }) => {
    const active = activeKey === slot.key;
    return (
      <motion.button
        onClick={() => router.replace(slot.href)}
        aria-label={slot.label}
        aria-current={active ? 'page' : undefined}
        whileTap={{ scale: 0.94 }}
        transition={{ duration: tick, ease: studioEase }}
        style={{
          flex: '1 1 0', minWidth: 0, background: 'transparent', border: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '8px 2px', cursor: 'pointer', minHeight: 52,
          color: active ? 'var(--st-info)' : 'var(--st-ink-3)',
        }}
      >
        {slot.icon}
        <span style={{
          fontFamily: 'var(--st-text)', fontSize: 11, lineHeight: 1.2,
          fontWeight: active ? 560 : 400, letterSpacing: '0.01em',
        }}>
          {slot.label}
        </span>
      </motion.button>
    );
  };

  return (
    <nav
      aria-label="AutoModz"
      style={{
        position: 'fixed', left: 0, right: 0, zIndex: 60,
        bottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        paddingLeft: 'max(var(--st-line), env(safe-area-inset-left))',
        paddingRight: 'max(var(--st-line), env(safe-area-inset-right))',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        pointerEvents: 'auto',
        margin: '0 auto', maxWidth: 520, position: 'relative',
        display: 'flex', alignItems: 'center',
        borderRadius: 26,
        background: 'var(--st-glass)',
        backdropFilter: 'var(--st-glass-blur)', WebkitBackdropFilter: 'var(--st-glass-blur)',
        border: '1px solid var(--st-hairline)',
        boxShadow: 'var(--st-lift), var(--st-edge)',
        padding: '4px 6px',
      }}>
        {left.map(s => <Item key={s.key} slot={s} />)}

        {/* the mark, raised on its own pedestal - the dock's centre of gravity */}
        <motion.button
          onClick={() => router.replace('/app')}
          aria-label="AutoModz — home"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: tick, ease: studioEase }}
          style={{
            flex: '0 0 auto', margin: '0 6px', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            // the island sizes itself from the mark: no fixed width - the
            // wordmark's own width plus an equal cushion of horizontal padding.
            // Swap the logo and the pedestal still fits it perfectly.
            height: 60, padding: '0 28px', borderRadius: 20,
            background: 'var(--st-linen)',
            border: '1px solid var(--st-hairline)',
            boxShadow: 'var(--st-hold)',
          }}
        >
          <Wordmark height={14} />
        </motion.button>

        {right.map(s => <Item key={s.key} slot={s} />)}
      </div>
    </nav>
  );
}
