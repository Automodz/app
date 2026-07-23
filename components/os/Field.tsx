'use client';
/**
 * The one input (design system §7.11): caption label above value,
 * hairline underline, no boxes. Error = concierge line, not red chrome.
 *
 * The error is announced (aria-live) and bound to the input (aria-describedby /
 * aria-invalid), and the input carries the right mobile-keyboard hints for what
 * it holds - a name capitalises words, a plate capitalises every letter.
 */
import { useId } from 'react';

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  kind?: 'text' | 'phone' | 'data';
  error?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  autoCapitalize?: 'none' | 'words' | 'characters';
  enterKeyHint?: 'next' | 'go' | 'done' | 'send';
  maxLength?: number;
}

export default function Field({
  label, value, onChange, placeholder, kind = 'text', error, autoFocus,
  autoComplete, autoCapitalize, enterKeyHint, maxLength,
}: FieldProps) {
  const mono = kind !== 'text';
  const errorId = useId();
  return (
    <label style={{ display: 'block' }}>
      <span style={{
        fontFamily: 'var(--st-text)', fontSize: 14, color: 'var(--st-ink-2)',
        display: 'block', marginBottom: 4,
      }}>
        {label}
      </span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        enterKeyHint={enterKeyHint}
        maxLength={maxLength}
        inputMode={kind === 'phone' ? 'tel' : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        style={{
          width: '100%', border: 'none', outline: 'none', background: 'transparent',
          borderBottom: `1px solid ${error ? 'var(--st-ink-2)' : 'var(--st-hairline)'}`,
          fontFamily: mono ? 'var(--st-data)' : 'var(--st-text)',
          fontSize: 19, fontWeight: mono ? 400 : 520, color: 'var(--st-ink)',
          padding: '6px 0', borderRadius: 0,
          textTransform: kind === 'data' ? 'uppercase' : undefined,
        }}
        onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--st-ink)'; }}
        onBlur={e => { e.currentTarget.style.borderBottomColor = error ? 'var(--st-ink-2)' : 'var(--st-hairline)'; }}
      />
      {error && (
        <span
          id={errorId}
          role="status"
          aria-live="polite"
          style={{
            display: 'block', fontFamily: 'var(--st-text)', fontSize: 14,
            color: 'var(--st-ink-2)', marginTop: 6,
          }}
        >
          {error}
        </span>
      )}
    </label>
  );
}
