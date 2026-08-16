import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COMPANY as BUSINESS } from '../company';
import type { Quote, QuoteStatus } from '../types';

/* `requestQuote` STOOD HERE - a customer "get me a price" that landed in the
   admin pipeline as a `requested` quote with no items and no total.
   The customer has a real path to a price already, and it is a better one:
   the scope screen prices the exact coverage on their own car through
   `priceVisit` and writes an ESTIMATE the studio can be held to, which the
   booking then spends. A second, vaguer ask that produces an empty document
   for somebody to fill in by hand is the same question answered worse. The
   studio's own quote tool (`createQuote`) is untouched - a quote it writes is
   for work the app cannot price, which is exactly what it is for. */


export const createQuote = async (data: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const r = await addDoc(collection(db, 'quotes'), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return r.id;
};

export const updateQuote = (id: string, data: Partial<Omit<Quote, 'id' | 'createdAt'>>) =>
  updateDoc(doc(db, 'quotes', id), { ...data, updatedAt: serverTimestamp() });

export const setQuoteStatus = (id: string, status: QuoteStatus) =>
  updateDoc(doc(db, 'quotes', id), { status, updatedAt: serverTimestamp() });

/* `getQuote` STOOD HERE - one quote by id, with no caller. The admin surface
   works from `listQuotes`, which is one read for the whole board rather than
   one per row. */

export const listQuotes = async (): Promise<Quote[]> => {
  const snap = await getDocs(collection(db, 'quotes'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Quote))
    .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
};

/** WhatsApp deep link carrying the quote to the customer. */
export const buildQuoteWhatsAppLink = (q: Quote) => {
  const lines = q.items.map(i => `• ${i.name}${i.detail ? ` (${i.detail})` : ''} - ₹${i.amount.toLocaleString('en-IN')}`).join('\n');
  const msg =
`*${BUSINESS.name} - Quotation*
${q.vehicleName} · ${q.serviceCategory}

${lines}

*Total: ₹${q.total.toLocaleString('en-IN')}*${q.validUntil ? `\nValid till ${q.validUntil}` : ''}

Reply here to confirm and we'll book your slot!`;
  return `https://wa.me/91${q.customerPhone}?text=${encodeURIComponent(msg)}`;
};
