'use client';
/**
 * THE PALETTE, EVERYWHERE.
 *
 * Source: docs/AUTOMODZ-OS-ARCHITECTURE.md §5 · docs/AUTOMODZ-OS.md §21.4
 *
 * The Desk was mounted inside `HomeScreen`, which meant ⌘K worked at `/` and
 * nowhere else. A customer reading their History, looking at a car or halfway
 * through the Club could not summon it — so it was a feature of one screen
 * rather than the way the product is navigated.
 *
 * It is mounted here instead: once, in the chrome, above every room. Three
 * pieces, because the data and the layer live on opposite sides of the server
 * boundary:
 *
 *   PaletteProvider — holds the items. Mounted in `CustomerChrome`.
 *   PaletteFeed     — publishes them. Rendered by `ServerRoom`, which is the
 *                     one place every room already loads the picture. Nothing
 *                     per-page to remember, and the items are re-projected on
 *                     every navigation rather than going stale in a layout
 *                     that does not re-render.
 *   PaletteHost     — the layer itself, plus ⌘K and the address.
 *
 * ADDRESSABLE, like every other expansion (§6.4): `?open=desk` at whatever
 * room you are in, so it can be linked and survives a reload, and the back
 * button closes it because it is a real history entry.
 */
import {
  createContext, useContext, useState, useEffect, useMemo, Suspense, type ReactNode,
} from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Desk } from '@/components/system';
import type { PaletteModel } from '@/lib/customer/palette';

const EMPTY: PaletteModel = { items: [], log: [] };

const PaletteContext = createContext<{
  model: PaletteModel;
  publish: (m: PaletteModel) => void;
}>({ model: EMPTY, publish: () => {} });

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<PaletteModel>(EMPTY);
  const value = useMemo(() => ({ model, publish: setModel }), [model]);
  return (
    <PaletteContext.Provider value={value}>
      {children}
      <Suspense fallback={null}><PaletteHost /></Suspense>
    </PaletteContext.Provider>
  );
}

/**
 * Hands the room's projection up to the provider.
 *
 * Renders nothing. Serialising the model through props is what lets a server
 * component decide what is findable while the layer that shows it stays a
 * client component mounted once, higher up.
 */
export function PaletteFeed({ model }: { model: PaletteModel }) {
  const { publish } = useContext(PaletteContext);
  /* Keyed on the projection itself: a new room re-projects and republishes,
     and an unchanged one does not loop. */
  const key = JSON.stringify(model);
  useEffect(() => { publish(model); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
  return null;
}

/** Opens the palette from anywhere. Used by a room's own "Find" control. */
export function useOpenPalette(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return () => {
    const next = new URLSearchParams(params.toString());
    next.set('open', 'desk');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

function PaletteHost() {
  const { model } = useContext(PaletteContext);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get('open') === 'desk';

  const setOpen = (want: boolean) => {
    const next = new URLSearchParams(params.toString());
    if (want) next.set('open', 'desk');
    else next.delete('open');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  /* §21.4 — every control reachable by keyboard alone. ⌘K is the one shortcut
     the product has, and it now answers at every address. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(params.get('open') !== 'desk');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname]);

  return (
    <Desk
      open={open}
      onOpenChange={setOpen}
      items={model.items}
      log={model.log}
      truth={model.truth}
    />
  );
}
