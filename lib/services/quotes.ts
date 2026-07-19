import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COMPANY as BUSINESS } from '../company';
import type { Quote, QuoteStatus, QuoteLineItem } from '../types';

/** Customer "get me a price" request - lands in the admin pipeline. */
export const requestQuote = async (data: {
  customerName: string; customerPhone: string; customerId?: string;
  vehicleName: string; serviceCategory: string; customerMessage?: string;
}): Promise<string> => {
  const r = await addDoc(collection(db, 'quotes'), {
    customerName: data.customerName,
    customerPhone: data.customerPhone.replace(/\D/g, '').slice(-10),
    ...(data.customerId ? { customerId: data.customerId } : {}),
    vehicleName: data.vehicleName,
    serviceCategory: data.serviceCategory,
    ...(data.customerMessage ? { customerMessage: data.customerMessage } : {}),
    items: [], total: 0, status: 'requested' as QuoteStatus,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return r.id;
};

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

export const getQuote = async (id: string): Promise<Quote | null> => {
  const snap = await getDoc(doc(db, 'quotes', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Quote) : null;
};

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
