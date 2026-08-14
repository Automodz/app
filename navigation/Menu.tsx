'use client';
/**
 * THE MENU - everywhere the dock cannot reach.
 *
 * Source: docs/AUTOMODZ-OS.md §6.2, §6.3, §8.5, §10.4, §20.2, §21.3, §21.5, §21.6
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────
 * The dock has five slots and the product has more than five places. Home
 * carried a "Find" control for the overflow - a word that named a mechanism
 * (§21.8 forbids exactly that), opened a command palette a customer had no
 * reason to expect, and existed on ONE screen, so every other room's extra
 * addresses had nowhere to live at all. They ended up as rows on `/you`,
 * which is the room about the PERSON and is not a site map.
 *
 * This is that overflow, in one place, reachable from every room.
 *
 * ── WHAT IS IN IT, AND WHAT IS DELIBERATELY NOT ──────────────────────────
 * Only what the dock cannot hold. The five slots are NOT repeated here: a menu
 * that lists the navigation sitting six inches below it teaches a customer that
 * the two disagree about which is the real one. §6.2 - the bar always shows
 * where the customer is, and it keeps that job.
 *
 * Leaving is not here either. §15.6 puts sign-out quiet and alone at the end of
 * `/you`, and a sign-out inside a navigation sheet is a mis-tap away from every
 * other address in the product.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  color, space, radius, INSET, HAIRLINE, TARGET_MIN, elevation, type as typeScale,
} from '@/design';

/**
 * The addresses the five slots cannot carry.
 *
 * `said` is not a description of the page - it is the reason a customer would
 * go there, which is what §21.8 means by the customer's own word.
 */
const ELSEWHERE = [
  { href: '/cars', label: 'Cars for sale', said: 'Every car the studio is selling' },
  { href: '/dashboard/sell-car', label: 'Sell your car', said: 'We photograph and vet it' },
  { href: '/history', label: 'Every visit', said: 'The whole record, car by car' },
] as const;

const PAPERS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export function Menu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  /* Any navigation closes it. The sheet is a way OUT of the room, so a room
     that has changed underneath an open sheet is a sheet nobody dismissed. */
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    /* §21.5 - escape leaves, and the focus goes back where it came from rather
       than to the top of the document. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={open ? 'Close menu' : 'Menu'}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
        className="am-tap"
        style={{
          position: 'fixed',
          top: `calc(env(safe-area-inset-top, 0px) + ${space.line}px)`,
          insetInlineEnd: INSET,
          zIndex: elevation.nav.z,
          width: TARGET_MIN, height: TARGET_MIN,
          display: 'grid', placeItems: 'center',
          borderRadius: radius.pill,
          border: `${HAIRLINE}px solid ${color.edge}`,
          background: 'rgba(255,255,255,0.055)',
          backdropFilter: 'blur(24px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
          cursor: 'pointer',
        }}
      >
        {/* THREE RULES, AND THE TOP ONE MOVES. Drawn rather than imported:
            the customer product draws its own marks on one 1.4px stroke, and
            an icon set here would be a second language on every room. */}
        <span aria-hidden style={{ display: 'grid', gap: 4, width: 17 }}>
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                height: 1.4, borderRadius: 1, background: color.ink,
                transition: 'transform 180ms ease, opacity 180ms ease',
                transform: open
                  ? i === 0 ? 'translateY(5.4px) rotate(45deg)'
                    : i === 2 ? 'translateY(-5.4px) rotate(-45deg)' : 'none'
                  : 'none',
                opacity: open && i === 1 ? 0 : 1,
              }}
            />
          ))}
        </span>
      </button>

      {open ? (
        <div
          ref={panel}
          role="menu"
          aria-label="Elsewhere in AutoModz"
          style={{
            position: 'fixed',
            top: `calc(env(safe-area-inset-top, 0px) + ${space.line + TARGET_MIN + space.breath}px)`,
            insetInlineEnd: INSET,
            zIndex: elevation.nav.z,
            width: `min(320px, calc(100vw - ${INSET * 2}px))`,
            padding: space.breath,
            display: 'flex', flexDirection: 'column', gap: 2,
            borderRadius: radius.sheet,
            border: `${HAIRLINE}px solid ${color.edge}`,
            background: 'rgba(18,19,22,0.86)',
            backdropFilter: 'blur(28px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
            boxShadow: elevation.takeover.shadow,
          }}
        >
          {ELSEWHERE.map(e => (
            <Link
              key={e.href}
              href={e.href}
              role="menuitem"
              className="am-tap"
              style={{
                display: 'flex', flexDirection: 'column', gap: 1,
                minHeight: TARGET_MIN, justifyContent: 'center',
                padding: `${space.breath}px ${space.line}px`,
                borderRadius: radius.chip, textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: 15, color: color.ink }}>{e.label}</span>
              <span style={{ fontSize: typeScale.whisper.size, color: color.ink3 }}>{e.said}</span>
            </Link>
          ))}

          <span
            aria-hidden
            style={{
              height: HAIRLINE, background: color.edge,
              marginBlock: space.breath, marginInline: space.line,
            }}
          />

          {/* The papers. Quieter, because nobody comes here for them - but
              §15.x wants them reachable from inside the product rather than
              only from the public footer. */}
          <div style={{ display: 'flex', gap: space.line, paddingInline: space.line, paddingBottom: space.hair }}>
            {PAPERS.map(p => (
              <Link
                key={p.href}
                href={`${p.href}?from=${encodeURIComponent(pathname ?? '/')}`}
                role="menuitem"
                className="am-tap"
                style={{
                  display: 'inline-flex', alignItems: 'center', minHeight: TARGET_MIN,
                  fontSize: typeScale.whisper.size, color: color.ink3, textDecoration: 'none',
                }}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
