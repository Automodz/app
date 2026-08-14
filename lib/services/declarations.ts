/**
 * THE DECLARATION COLLECTION - read only, from any browser.
 *
 * There is no `create`, `update` or `delete` in this file and there never will
 * be one: `firestore.rules` refuses every client write to `declarations`, and
 * the only door is `/api/protection/puc/declare` (the customer's half) and
 * `/api/protection/puc/verify` (the studio's). A writer here would be a second
 * door to the most consequential state in the protection machine, which is
 * precisely what `declareProtection()` was.
 */
import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Declaration } from '../types';

const rows = (snap: { docs: { id: string; data: () => unknown }[] }): Declaration[] =>
  snap.docs.map(d => ({ ...(d.data() as object), id: d.id }) as Declaration);

/** Every paper sent for one car. Owner-scoped by the rules, keyed by the car. */
export const getDeclarations = async (vehicleId: string): Promise<Declaration[]> => {
  const snap = await getDocs(
    query(collection(db, 'declarations'), where('vehicleId', '==', vehicleId)),
  );
  return rows(snap);
};

/**
 * The studio's queue - everything anybody has sent, newest first.
 *
 * ONE `orderBy` AND NO `where`, deliberately: a composite index is a
 * deployment step, and the studio's own screen can group by status in memory
 * for a list this size. The same reasoning the marketplace read uses.
 */
export const listDeclarations = async (max = 100): Promise<Declaration[]> => {
  const snap = await getDocs(
    query(collection(db, 'declarations'), orderBy('submittedAt', 'desc'), limit(max)),
  );
  return rows(snap);
};
