import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { RESOURCE_DEFAULTS, type ResourceConfig } from '../availability';

/**
 * Studio resource configuration (studioConfig/resources). Read by staff
 * surfaces (BayStrip) and edited in Studio Settings; the availability API
 * reads the same doc server-side. BOTH capacities are physical and both are
 * configurable: the studio runs two wash bays and two protection bays, and the
 * protection figure used to be hard-coded to 1 in `availability.ts` where no
 * setting could reach it.
 */
export const getResourceConfig = async (): Promise<ResourceConfig> => {
  try {
    const snap = await getDoc(doc(db, 'studioConfig', 'resources'));
    return { ...RESOURCE_DEFAULTS, ...(snap.exists() ? snap.data() : {}) } as ResourceConfig;
  } catch {
    return RESOURCE_DEFAULTS;
  }
};

const bounded = (n: number) => Math.max(1, Math.min(10, Math.round(n)));

export const setWashCapacity = (washCapacity: number) =>
  setDoc(doc(db, 'studioConfig', 'resources'),
    { washCapacity: bounded(washCapacity), updatedAt: serverTimestamp() },
    { merge: true });

/** The other half of the floor, which had no setter because it had no field. */
export const setProtectionCapacity = (protectionCapacity: number) =>
  setDoc(doc(db, 'studioConfig', 'resources'),
    { protectionCapacity: bounded(protectionCapacity), updatedAt: serverTimestamp() },
    { merge: true });
