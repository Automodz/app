import {
  collection, doc, addDoc, updateDoc, setDoc, getDoc, getDocs,
  query, where, orderBy, limit, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { InventoryItem, InventoryTxn, InventoryUnit, InventoryCategory } from '../types';

// ── Items ────────────────────────────────────────────────────────────────────

export const createInventoryItem = async (data: {
  name: string; category: InventoryCategory; unit: InventoryUnit;
  stockQty: number; lowStockThreshold: number; costPerUnit: number;
}) => {
  const r = await addDoc(collection(db, 'inventoryItems'), {
    ...data, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return r.id;
};

export const updateInventoryItem = (id: string, data: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>) =>
  updateDoc(doc(db, 'inventoryItems', id), { ...data, updatedAt: serverTimestamp() });

export const listInventoryItems = async (includeInactive = false): Promise<InventoryItem[]> => {
  const base = collection(db, 'inventoryItems');
  const snap = includeInactive
    ? await getDocs(base)
    : await getDocs(query(base, where('active', '==', true)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as InventoryItem))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const getLowStockItems = async (): Promise<InventoryItem[]> => {
  const items = await listInventoryItems();
  return items.filter(i => i.stockQty <= i.lowStockThreshold);
};

// ── Stock movements (all transactional: item qty + ledger entry) ────────────

const applyStockDelta = async (
  itemId: string,
  qtyDelta: number,
  txn: Omit<InventoryTxn, 'id' | 'itemId' | 'itemName' | 'qtyDelta' | 'createdAt'>,
) => {
  await runTransaction(db, async (t) => {
    const itemRef = doc(db, 'inventoryItems', itemId);
    const snap = await t.get(itemRef);
    if (!snap.exists()) throw new Error('Inventory item not found');
    const item = snap.data() as InventoryItem;
    const newQty = Math.max(0, (item.stockQty ?? 0) + qtyDelta);
    const update: Record<string, unknown> = { stockQty: newQty, updatedAt: serverTimestamp() };
    // Purchases reprice the item at weighted-average cost, so consumption is
    // costed at what the shelf actually cost - not a stale manual number.
    if (txn.type === 'purchase' && txn.costTotal != null && qtyDelta > 0) {
      const oldValue = (item.stockQty ?? 0) * (item.costPerUnit ?? 0);
      update.costPerUnit = Math.round(((oldValue + txn.costTotal) / newQty) * 100) / 100;
    }
    t.update(itemRef, update);
    const txnRef = doc(collection(db, 'inventoryTxns'));
    t.set(txnRef, {
      itemId, itemName: item.name, qtyDelta, ...txn, createdAt: serverTimestamp(),
    });
  });
};

export const recordPurchase = (itemId: string, qty: number, costTotal?: number, note?: string) =>
  applyStockDelta(itemId, Math.abs(qty), { type: 'purchase', ...(costTotal != null ? { costTotal } : {}), ...(note ? { note } : {}) });

export const adjustStock = (itemId: string, qtyDelta: number, note: string) =>
  applyStockDelta(itemId, qtyDelta, { type: 'adjustment', note });

export const getInventoryTxns = async (itemId?: string, max = 100): Promise<InventoryTxn[]> => {
  const base = collection(db, 'inventoryTxns');
  const q = itemId
    ? query(base, where('itemId', '==', itemId))
    : query(base, orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as InventoryTxn))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

// ── Recipes (consumption per service) ────────────────────────────────────────

/* ── SERVICE RECIPES STOOD HERE, AND THE STOCK THEY MOVED ────────────────
   `saveServiceRecipe`, `getServiceRecipe`, `listServiceRecipes`,
   `consumeForService`, `getRecipePrefill` and `consumeActuals`: a mapping from
   each service to the consumables it uses, so finishing a job decremented
   stock automatically.

   The owner's decision is that inventory is the PRODUCT INVENTORY and nothing
   else - what is on the shelf, what was bought, what was adjusted. A recipe is
   a model of how work consumes stock, and modelling it means every quantity is
   an estimate that silently drifts from what was actually used on a car whose
   size nobody told it about. Stock moves through `recordPurchase` and
   `adjustStock`, which are things a person did and can vouch for. */

