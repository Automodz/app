'use client';
import { WifiOff, RefreshCw, Zap } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-dots"
      style={{ background: 'var(--void)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: 'var(--accent-grad)', boxShadow: '0 8px 24px var(--accent-haze)' }}>
        <Zap size={24} style={{ color: 'var(--on-accent)' }} />
      </div>
      <WifiOff size={28} className="mb-4" style={{ color: 'var(--steel)' }} />
      <h1 className="font-display font-800 text-xl mb-2" style={{ color: 'var(--chrome)' }}>
        YOU&apos;RE OFFLINE
      </h1>
      <p className="font-body text-sm mb-8 max-w-xs" style={{ color: 'var(--steel)' }}>
        No internet connection. Reconnect to book services, track jobs, and manage your garage.
      </p>
      <button onClick={() => window.location.reload()}
        className="btn-ember flex items-center gap-2 px-6 py-3">
        <RefreshCw size={15} /> Try Again
      </button>
    </div>
  );
}
