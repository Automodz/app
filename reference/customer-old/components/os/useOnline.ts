'use client';
/**
 * Connectivity awareness for the customer product. SSR-safe (assumes online
 * until the browser says otherwise), then tracks the browser's online/offline
 * events. The whole app reads cached truth, so offline is a calm state, not an
 * error - this hook lets the shell say so and lets write actions decline early.
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
