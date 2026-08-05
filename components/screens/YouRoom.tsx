'use client';
/**
 * The only reason You needs a client boundary: signing out is a HANDLER, and a
 * function cannot cross the server boundary.
 *
 * Both halves of the session are dropped — the client SDK's own, and the
 * httpOnly cookie the server reads. Missing either one leaves the customer
 * signed in somewhere: the cookie alone would keep every server-rendered room
 * showing their garage.
 */
import { useCallback, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AccountSettings } from '@/components/you/AccountSettings';
import type { SettingsPanel } from '@/components/you/AccountSettings';
import { YouScreen } from './YouScreen';
import type { YouModel } from './YouScreen';

const PANELS: SettingsPanel[] = ['profile', 'notifications', 'referral', 'delete'];

export function YouRoom({ model }: { model: YouModel }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [leaving, setLeaving] = useState(false);

  /* §6.4 — every sheet has an address, so each is linkable, restorable on
     reload and closed by the back button. */
  const raw = params.get('panel');
  const panel = PANELS.includes(raw as SettingsPanel) ? (raw as SettingsPanel) : null;

  const closePanel = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete('panel');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const onSignOut = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      /* The client SDK is no longer in this bundle, so its sign-out is imported
         only when the customer actually asks to leave. */
      const [{ signOut }, { auth }] = await Promise.all([
        import('firebase/auth'),
        import('@/lib/firebase'),
      ]);
      if (auth) await signOut(auth);
    } catch {
      /* Losing the client session is not worth blocking the cookie drop. */
    }
    try {
      await fetch('/api/session', { method: 'DELETE' });
    } finally {
      const { useAppStore } = await import('@/lib/store');
      useAppStore.getState().clearSession();
      router.replace('/auth/login');
      router.refresh();
    }
  }, [leaving, router]);

  return (
    <>
      <YouScreen model={model} onSignOut={onSignOut} />
      <AccountSettings panel={panel} onClose={closePanel} />
    </>
  );
}
