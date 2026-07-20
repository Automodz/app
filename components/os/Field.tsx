'use client';
/**
 * The one input (design system §7.11): caption label above value,
 * hairline underline, no boxes. Error = concierge line, not red chrome.
 */
interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  kind?: 'text' | 'phone' | 'data';
  error?: string;
  autoFocus?: boolean;
}

export default function Field({
  label, value, onChange, placeholder, kind = 'text', error, autoFocus,
}: FieldProps) {
  const mono = kind !== 'text';
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
        inputMode={kind === 'phone' ? 'tel' : undefined}
        style={{
          width: '100%', border: 'none', outline: 'none', background: 'transparent',
          borderBottom: '1px solid var(--st-hairline)',
          fontFamily: mono ? 'var(--st-data)' : 'var(--st-text)',
          fontSize: 19, fontWeight: mono ? 400 : 520, color: 'var(--st-ink)',
          padding: '6px 0', borderRadius: 0,
          textTransform: kind === 'data' ? 'uppercase' : undefined,
        }}
        onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--st-ink)'; }}
        onBlur={e => { e.currentTarget.style.borderBottomColor = 'var(--st-hairline)'; }}
      />
      {error && (
        <span style={{
          display: 'block', fontFamily: 'var(--st-text)', fontSize: 14,
          color: 'var(--st-ink-2)', marginTop: 6,
        }}>
          {error}
        </span>
      )}
    </label>
  );
}
