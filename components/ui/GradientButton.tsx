'use client';
import { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Primary action button on the chrome accent gradient.
 * variant="ghost" for secondary actions. `loading` disables + shows ring.
 */
export default function GradientButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeCls =
    size === 'sm' ? 'text-xs !px-4 !py-2.5' :
    size === 'lg' ? 'text-base !px-8 !py-4' : 'text-sm';
  return (
    <button
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} ${sizeCls} ${fullWidth ? 'w-full' : ''} gap-2 ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="loader-ring inline-block w-4 h-4" aria-hidden />}
      {children}
    </button>
  );
}
