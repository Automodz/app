import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { ClientSession } from '@/components/ClientSession';

/**
 * This tree runs a browser session, so it mounts the client providers that used
 * to sit in the root layout. See components/ClientSession.tsx for why they moved.
 */
/**
 * NOT INDEXED. This is the staff kiosk lock, and without its own entry it
 * inherited the root layout's `canonical: '/'` and `robots: { index: true }` —
 * so a PIN screen was being offered to search engines as the homepage.
 */
export const metadata: Metadata = {
  title: 'Studio',
  robots: { index: false, follow: false },
  alternates: { canonical: '/store' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return <ClientSession>{children}</ClientSession>;
}
