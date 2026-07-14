import { HTMLAttributes, ReactNode } from 'react';

/**
 * Liquid-glass surface card. `accent` adds the chrome-mist wash + stronger
 * border (use for the one card on screen that should pop).
 */
export default function GlassCard({
  children,
  accent = false,
  padding = 'md',
  className = '',
  ...rest
}: {
  children: ReactNode;
  accent?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
} & HTMLAttributes<HTMLDivElement>) {
  const pad =
    padding === 'none' ? '' :
    padding === 'sm' ? 'p-3' :
    padding === 'lg' ? 'p-6' : 'p-4';
  return (
    <div
      className={`${accent ? 'card-ember' : 'card'} glass ${pad} ${className}`}
      style={{ borderRadius: 20 }}
      {...rest}
    >
      {children}
    </div>
  );
}
