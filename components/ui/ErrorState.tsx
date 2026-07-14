'use client';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Shared error state for failed loads - pairs with the MASTER_PLAN rule that
 * every async load has loading/success/error states and a working Retry.
 */
export default function ErrorState({
  message = "Couldn't load this - check your connection.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card text-center py-14">
      <WifiOff size={26} className="mx-auto mb-3" style={{ color: 'var(--faint)' }} />
      <p className="font-body text-sm mb-5" style={{ color: 'var(--muted)' }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost inline-flex items-center gap-2 px-6 py-3 text-sm">
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}
