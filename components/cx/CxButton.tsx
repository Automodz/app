'use client';
/**
 * CxButton — the customer app's button. Three intents, one size discipline:
 * primary actions are full-width, bottom-anchored, 52px. Press feedback is
 * a 150ms scale — never a bounce.
 */
import { ButtonHTMLAttributes, ReactNode } from 'react';

const INTENTS = {
  primary: {
    background: 'var(--accent-grad)', color: 'var(--on-accent)',
    border: '1px solid transparent', boxShadow: '0 6px 24px var(--accent-glow)',
  },
  secondary: {
    background: 'var(--cavern)', color: 'var(--chrome)',
    border: '1px solid var(--border-2)', boxShadow: 'none',
  },
  danger: {
    background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)',
    border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)', boxShadow: 'none',
  },
} as const;

export default function CxButton({ intent = 'primary', children, className = '', style, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { intent?: keyof typeof INTENTS; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`w-full rounded-2xl flex items-center justify-center gap-2 font-display transition-transform duration-150 active:scale-[0.98] disabled:opacity-50 cursor-pointer ${className}`}
      style={{
        minHeight: 52, fontSize: 14.5, fontWeight: 700, letterSpacing: '0.02em',
        ...INTENTS[intent], ...style,
      }}>
      {children}
    </button>
  );
}
