'use client';
/**
 * The customer error boundary. Contains any runtime fault inside the /app
 * experience so a single failure never drops the owner onto a dark, off-brand
 * crash screen or ejects them to the marketing site. It speaks the studio's
 * language - paper, ink, one calm sentence - stays recoverable, and returns to
 * the car, never to the homepage.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Action from '@/components/os/Action';
import { Display, Body, Whisper } from '@/components/os/text';

export default function AppError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // surfaced for logs/diagnostics, never shown to the customer
  useEffect(() => { console.error('[app] boundary caught:', error); }, [error]);

  return (
    <div
      className="studio"
      style={{
        minHeight: '100vh', background: 'var(--st-paper)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        padding: 'calc(env(safe-area-inset-top) + var(--st-rest)) var(--st-inset) calc(env(safe-area-inset-bottom) + var(--st-rest))',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Whisper tone="ink-3" style={{ fontFamily: 'var(--st-display)', letterSpacing: '0.08em' }}>
          AUTOMODZ
        </Whisper>
        <Display style={{ marginTop: 'var(--st-gap)' }}>A quiet hiccup.</Display>
        <Body tone="ink-2" style={{ marginTop: 'var(--st-line)' }}>
          Something didn’t load as it should. Your car and its history are safe.
        </Body>
        <div style={{ marginTop: 'var(--st-rest)', display: 'grid', gap: 'var(--st-line)', justifyItems: 'center' }}>
          <Action variant="primary" onClick={reset}>Try again</Action>
          <Action variant="quiet" onClick={() => { reset(); router.replace('/app'); }}>Back to the car</Action>
        </div>
      </div>
    </div>
  );
}
