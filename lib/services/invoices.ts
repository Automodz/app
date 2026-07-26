import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  runTransaction, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { formatInvoiceNumber, randomToken, formatCurrency } from '../utils';
import { INVOICE_PREFIX, GST_ENABLED, GST_RATE, GSTIN } from '../config/storeConfig';
import { COMPANY as BUSINESS } from '../company';
import { applyDiscount } from './pricing';
import type { Invoice, InvoiceLineItem, Job, Booking } from '../types';

/**
 * Create an invoice from a job or booking inside a transaction:
 * increments counters/invoices, writes the invoice, backlinks invoiceId on the source doc.
 */
const createInvoice = async (data: {
  jobId?: string; bookingId?: string; customerId?: string;
  customerName: string; customerPhone: string;
  vehicleName: string; vehicleRegNo: string;
  lineItems: InvoiceLineItem[];
  discount?: { label: string; amount: number };
  paymentMethod: 'upi' | 'cash';
  paymentStatus: 'pending' | 'paid';
  photos?: import('../types').JobPhoto[];
  byEmployee?: { id: string; name: string };
}): Promise<Invoice> => {
  const subtotal = data.lineItems.reduce((s, i) => s + i.amount, 0);
  /* Through the one engine, not a second `Math.max(0, x - y)`. The invoice
     RESTATES a price the Booking Service already decided (the discount arrives
     on the job/booking); GST is the only arithmetic that is genuinely the
     invoice's own. */
  const afterDiscount = applyDiscount(subtotal, data.discount
    ? { source: 'promo', label: data.discount.label, amount: data.discount.amount }
    : undefined);
  const gst = GST_ENABLED
    ? { rate: GST_RATE, amount: Math.round(afterDiscount * GST_RATE / 100), ...(GSTIN ? { gstin: GSTIN } : {}) }
    : undefined;
  const total = afterDiscount + (gst?.amount ?? 0);
  const publicToken = randomToken();
  const year = new Date().getFullYear();

  const invoiceId = await runTransaction(db, async (t) => {
    const counterRef = doc(db, 'counters', 'invoices');
    const counterSnap = await t.get(counterRef);
    let seq = 1;
    if (counterSnap.exists()) {
      const c = counterSnap.data() as { current: number; year: number };
      seq = c.year === year ? c.current + 1 : 1;
    }
    t.set(counterRef, { current: seq, year });

    const invoiceRef = doc(collection(db, 'invoices'));
    const invoice: Record<string, unknown> = {
      invoiceNumber: formatInvoiceNumber(INVOICE_PREFIX, year, seq),
      customerName: data.customerName, customerPhone: data.customerPhone,
      vehicleName: data.vehicleName, vehicleRegNo: data.vehicleRegNo,
      lineItems: data.lineItems, subtotal, total,
      paymentMethod: data.paymentMethod, paymentStatus: data.paymentStatus,
      publicToken, createdAt: serverTimestamp(),
    };
    if (data.jobId) invoice.jobId = data.jobId;
    if (data.bookingId) invoice.bookingId = data.bookingId;
    if (data.customerId) invoice.customerId = data.customerId;
    if (data.discount) invoice.discount = data.discount;
    if (data.photos?.length) invoice.photos = data.photos;
    if (gst) invoice.gst = gst;
    if (data.byEmployee) {
      invoice.createdByEmployeeId = data.byEmployee.id;
      invoice.createdByEmployeeName = data.byEmployee.name;
    }
    t.set(invoiceRef, invoice);
    if (data.jobId) t.update(doc(db, 'jobs', data.jobId), { invoiceId: invoiceRef.id });
    if (data.bookingId) t.update(doc(db, 'bookings', data.bookingId), { invoiceId: invoiceRef.id });
    return invoiceRef.id;
  });

  const snap = await getDoc(doc(db, 'invoices', invoiceId));
  return { id: invoiceId, ...snap.data() } as Invoice;
};

export const createInvoiceForJob = (job: Job, byEmployee?: { id: string; name: string }) =>
  createInvoice({
    jobId: job.id, customerId: job.customerId,
    customerName: job.customerName, customerPhone: job.customerPhone,
    vehicleName: job.vehicleName, vehicleRegNo: job.vehicleRegNo,
    lineItems: job.serviceItems.map(s => ({ name: s.serviceName, qty: 1, unitPrice: s.price, amount: s.price })),
    discount: job.discount ? { label: job.discount.label, amount: job.discount.amount } : undefined,
    paymentMethod: job.paymentMethod ?? 'cash',
    paymentStatus: job.paymentStatus === 'collected' ? 'paid' : 'pending',
    photos: job.photos,
    byEmployee,
  });

export const createInvoiceForBooking = (b: Booking) =>
  createInvoice({
    bookingId: b.id, customerId: b.userId,
    customerName: b.userName, customerPhone: b.userPhone,
    vehicleName: b.vehicleName, vehicleRegNo: b.vehicleRegNo,
    lineItems: [
      { name: b.serviceName, qty: 1, unitPrice: b.serviceBasePrice, amount: b.serviceBasePrice },
      ...(b.pickupDropFee ? [{ name: 'Pickup & Drop', qty: 1, unitPrice: b.pickupDropFee, amount: b.pickupDropFee }] : []),
    ],
    discount: b.discount ? { label: b.discount.label, amount: b.discount.amount } : undefined,
    paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus === 'verified' ? 'paid' : 'pending',
  });

export const getInvoice = async (id: string): Promise<Invoice | null> => {
  const snap = await getDoc(doc(db, 'invoices', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Invoice) : null;
};

export const getRecentInvoices = async (max = 100): Promise<Invoice[]> => {
  const snap = await getDocs(query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
};

export const getInvoicesForCustomer = async (customerId: string): Promise<Invoice[]> => {
  const snap = await getDocs(query(collection(db, 'invoices'), where('customerId', '==', customerId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Invoice))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const markInvoicePaid = (id: string, method: 'upi' | 'cash') =>
  updateDoc(doc(db, 'invoices', id), { paymentStatus: 'paid', paymentMethod: method });

/** Public shareable link for an invoice (token-gated page) */
export const invoicePublicUrl = (invoice: Invoice) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/invoice/${invoice.id}?t=${invoice.publicToken}`;
};

/** wa.me deep link sending the invoice to the customer's WhatsApp */
export const buildInvoiceWhatsAppLink = (invoice: Invoice) => {
  const phone = `91${invoice.customerPhone.replace(/\D/g, '').slice(-10)}`;
  const msg =
`*${BUSINESS.name} - Invoice ${invoice.invoiceNumber}*

Vehicle: ${invoice.vehicleName} (${invoice.vehicleRegNo})
Amount: ${formatCurrency(invoice.total)}
Status: ${invoice.paymentStatus === 'paid' ? 'PAID ✓' : 'Payment pending'}

View & download your invoice:
${invoicePublicUrl(invoice)}

Thank you for choosing ${BUSINESS.name}!
Loved the work? A quick Google review means the world to us 🙏
${BUSINESS.googleReviewUrl}

${BUSINESS.address}
${BUSINESS.phone}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
};

/** "Ask for a review" WhatsApp message for a completed job/booking. */
export const buildReviewAskLink = (customerName: string, customerPhone: string) => {
  const phone = `91${customerPhone.replace(/\D/g, '').slice(-10)}`;
  const msg =
`Hi ${customerName.split(' ')[0]}! Thanks for trusting ${BUSINESS.name} with your car today. 🚗✨

If you're happy with the finish, a quick Google review helps our small Maninagar studio more than you know:
${BUSINESS.googleReviewUrl}

- Team ${BUSINESS.name}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
};
