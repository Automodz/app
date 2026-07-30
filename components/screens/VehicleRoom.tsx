'use client';
/**
 * §11.3 — the composition point, and the only reason the Vehicle needs a client
 * boundary at all: a `VehicleRendering` carries a COMPONENT, and a component
 * cannot cross the server boundary. So the server sends the serialisable
 * `PhotographSource` and this resolves it.
 *
 * Memoised on the source's identity because rebuilding a rendering hands React a
 * new component type and remounts the car underneath the customer.
 */
import { useMemo } from 'react';
import { VehicleScreen } from './VehicleScreen';
import type { VehicleModel } from './VehicleScreen';
import { photograph } from '@/components/vehicle';
import type { PhotographSource } from '@/components/vehicle';

export function VehicleRoom(
  { model, source }: { model: VehicleModel; source: PhotographSource },
) {
  /* Keyed on the whole source: it arrives from the server as a fresh object on
     every request, so a field-by-field dependency list would be both wrong and
     unenforceable. One rendering per source object is exactly right. */
  const rendering = useMemo(() => photograph(source), [source]);
  return <VehicleScreen model={model} rendering={rendering} />;
}
