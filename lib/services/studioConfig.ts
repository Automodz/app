import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { RESOURCE_DEFAULTS, type ResourceConfig } from '../availability';

/**
 * Studio resource configuration (studioConfig/resources). Read by staff
 * surfaces (BayStrip) and edited in Studio Settings; the availability API
 * reads the same doc server-side. Bay capacities are physical (1 each) -
 * only wash concurrency is configurable.
 */
export const getResourceConfig = async (): Promise<ResourceConfig> => {
  try {
    const snap = await getDoc(doc(db, 'studioConfig', 'resources'));
    return { ...RESOURCE_DEFAULTS, ...(snap.exists() ? snap.data() : {}) } as ResourceConfig;
  } catch {
    return RESOURCE_DEFAULTS;
  }
};

export const setWashCapacity = (washCapacity: number) =>
  setDoc(doc(db, 'studioConfig', 'resources'),
    { washCapacity: Math.max(1, Math.min(10, Math.round(washCapacity))), updatedAt: serverTimestamp() },
    { merge: true });
