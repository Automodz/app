'use client';
import Sheet from './Sheet';

/**
 * Confirmation prompt on Sheet. `danger` styles the confirm action with the
 * danger token for destructive operations.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {message && <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{message}</p>}
      <div className="flex gap-3">
        <button className="btn-ghost flex-1 py-3" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </button>
        <button
          className="btn-primary flex-1 py-3"
          onClick={onConfirm}
          disabled={loading}
          style={danger ? { background: 'var(--danger)', color: 'var(--bg)' } : undefined}
        >
          {loading ? '…' : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
