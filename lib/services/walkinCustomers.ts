import {
  collection, doc, getDocs, setDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Timestamp } from 'firebase/firestore';

/**
 * Phone-keyed CRM records for customers WITHOUT app accounts (the walk-in
 * majority). Doc id == 10-digit phone, so intake upserts are idempotent.
 * When the person later signs up, their app account matches by phone
 * (findCustomerByPhone) and this record stays as pre-signup history.
 */
export interface WalkinCustomer {
  id: string;                 // == phone
  name: string;
  phone: string;
  vehicleNames: string[];     // distinct vehicles seen at intake
  visits: number;             // jobs created
  totalSpent: number;         // Σ completed job totals
  lastVisit: string;          // YYYY-MM-DD
  firstVisit: string;
  updatedAt?: Timestamp;
}

const clean = (phone: string) => phone.replace(/\D/g, '').slice(-10);

/* The intake upsert lived here. It now happens inside the Booking Service's
   transaction (lib/server/bookingService.ts) so a walk-in and its CRM row are
   one commit rather than a fire-and-forget that could silently miss. */

/** Add revenue on job completion. */
export const recordWalkinSpend = async (phone: string, amount: number) => {
  const p = clean(phone);
  if (p.length < 10) return;
  await setDoc(doc(db, 'walkinCustomers', p), {
    totalSpent: increment(amount), updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const listWalkinCustomers = async (): Promise<WalkinCustomer[]> => {
  const snap = await getDocs(collection(db, 'walkinCustomers'));
  return snap.docs
    .map(d => ({ ...(d.data() as WalkinCustomer), id: d.id }))
    .sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
};
