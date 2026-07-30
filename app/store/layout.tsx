import type { ReactNode } from 'react';
import { ClientSession } from '@/components/ClientSession';

/**
 * This tree runs a browser session, so it mounts the client providers that used
 * to sit in the root layout. See components/ClientSession.tsx for why they moved.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return <ClientSession>{children}</ClientSession>;
}
