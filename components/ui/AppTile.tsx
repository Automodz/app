'use client';
import { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import HeroMedia from './HeroMedia';

/**
 * Aston "app-card" tile: liquid-glass surface with an optional photographic
 * backdrop and an expand affordance in the corner. Interactive when `onClick`
 * is passed (renders as a button-like card with hover lift).
 */
export default function AppTile({
  title,
  eyebrow,
  photo,
  photoAlt,
  icon,
  footer,
  onClick,
  expand = true,
  className = '',
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  photo?: string;
  photoAlt?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  expand?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      className={`card-ember glass relative overflow-hidden p-4 flex flex-col min-h-[132px] transition-transform duration-300 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${className}`}
      style={{ borderRadius: 20 }}
    >
      {photo && (
        <div className="absolute inset-0 -z-0 opacity-90">
          <HeroMedia src={photo} alt={photoAlt ?? ''} scrim="full" />
        </div>
      )}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
          {eyebrow && <span className="data-label">{eyebrow}</span>}
        </div>
        {expand && (
          <span
            className="grid place-items-center shrink-0"
            style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--ash)', color: 'var(--fg-dim)' }}
          >
            <ArrowUpRight size={15} />
          </span>
        )}
      </div>
      <div className="relative z-10 mt-auto">
        <div className="font-display font-700 text-lg leading-tight" style={{ color: 'var(--fg)' }}>{title}</div>
        {children && <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{children}</div>}
        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </div>
  );
}
