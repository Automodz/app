'use client';
/**
 * IS THERE A CONNECTION?
 *
 * Source: docs/AUTOMODZ-OS.md §20.3 — "distinguish ours from theirs."
 *
 * A customer who has lost signal must not be told the studio failed. This is
 * the one place the answer is read, so every surface agrees about it.
 *
 * It starts `true` and corrects after mount ON PURPOSE. `navigator` does not
 * exist on the server, and a component that rendered "offline" on the server
 * and "online" on the client would be a hydration mismatch — the exact class of
 * bug that `Loading` and `Hero` were both fixed for.
 */
import { useEffect, useState } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}
