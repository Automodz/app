'use client';
/**
 * THE BROWSER-SESSION PROVIDERS, for the trees that still need one.
 *
 * `AuthProvider`, `ThemeProvider` and `Toaster` used to live in the root layout,
 * so every route in the application — including every customer room — carried
 * the Firebase client SDK, the Zustand store and react-hot-toast in its first
 * load. The customer rooms now read on the server and import none of the three.
 *
 * So they moved here, and this is mounted by the trees that genuinely run a
 * browser session: the operations application, the kiosk, and sign-in. Those
 * surfaces behave exactly as before — the same three providers, one level lower.
 */
import type { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';

export function ClientSession({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        {children}
        <Toaster
          position="top-center"
          containerStyle={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--glass-2)',
              color: 'var(--fg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '14px',
              fontSize: '14px',
              fontFamily: 'var(--font-body)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              padding: '12px 16px',
            },
            success: { iconTheme: { primary: '#5FBF8F', secondary: '#111214' } },
            error: { iconTheme: { primary: '#E06C75', secondary: '#111214' } },
          }}
        />
      </ThemeProvider>
    </AuthProvider>
  );
}
