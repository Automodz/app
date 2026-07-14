'use client';
import { InputHTMLAttributes, useId } from 'react';

/** Labeled input on the token input style, with inline error slot. */
export default function Input({
  label,
  error,
  hint,
  className = '',
  ...rest
}: {
  label?: string;
  error?: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="data-label block mb-2">{label}</label>
      )}
      <input
        id={id}
        className="input"
        aria-invalid={!!error}
        style={error ? { borderColor: 'var(--danger)' } : undefined}
        {...rest}
      />
      {error ? (
        <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{error}</p>
      ) : hint ? (
        <p className="text-xs mt-1.5" style={{ color: 'var(--faint)' }}>{hint}</p>
      ) : null}
    </div>
  );
}
