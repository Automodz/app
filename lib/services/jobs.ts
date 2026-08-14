import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp, arrayUnion,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { authedFetch, idToken as token } from '../clientSession';
import { db } from '../firebase';
import { uploadImage } from './storage';
import type { Job, JobStatus, JobServiceItem, JobPhoto, JobAssignment, PaymentRecord, User, Booking } from '../types';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

/** Look up an existing customer account by phone (exact match). */
export const findCustomerByPhone = async (phone: string): Promise<User | null> => {
  const clean = phone.replace(/\D/g, '').slice(-10);
  if (clean.length < 10) return null;
  const snap = await getDocs(query(collection(db, 'users'), where('phone', '==', clean), limit(1)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() } as User;
};

/**
 * Open a walk-in at the counter.
 *
 * A WRAPPER around the one Booking Service. It used to compute `subtotal` and
 * `totalAmount` here, take the discount the kiosk had already worked out, and
 * write the job itself - then, separately, deduct the membership wash and count
 * the promo. Three writes, three failure points, and the discount arithmetic
 * duplicated from the customer app.
 *
 * Line prices still come from the counter, because a kiosk exists to sell at a
 * negotiated price. Everything a benefit is worth is now decided server-side
 * (`/api/booking/create` → lib/server/bookingService.ts) in the same commit as
 * the job.
 */
export const createWalkInJob = async (data: {
  customerId?: string; customerName: string; customerPhone: string;
  vehicleName: string; vehicleRegNo: string;
  serviceItems: JobServiceItem[];
  /** REQUEST to spend a membership wash - the server decides if it can. */
  useMembershipWash?: boolean;
  byEmployee: { id: string; name: string };
  /** Who works this job - defaults to the intake employee as lead. */
  assignees?: { id: string; name: string }[];
  idempotencyKey: string;
  /* Returns the id ONLY. The route also sends the stored job, but its
     Timestamps are admin-SDK ones that serialise to `{_seconds,...}` - no
     `.seconds`, no `.toDate()` - and nested ones inside `statusHistory` and
     `assignments` too. Handing that back typed as `Job` would be a trap for the
     next caller. The live job-board listener supplies the real document. */
}): Promise<{ id: string }> => {
    const res = await authedFetch('/api/booking/create', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'walkin',
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      vehicleName: data.vehicleName,
      vehicleRegNo: data.vehicleRegNo,
      items: data.serviceItems,
      useMembershipWash: data.useMembershipWash,
      byEmployee: data.byEmployee,
      assignees: data.assignees,
      idempotencyKey: data.idempotencyKey,
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out?.error ?? 'job-failed');
  return { id: out.id as string };
};

/**
 * Vehicle check-in: create the operational Job for a customer Booking.
 * The Booking (commercial truth) is NEVER replaced - it stays and gains a
 * `jobId` link; the Job (operational truth) carries the work. 1:1, permanent.
 * Idempotent: if the booking already has a job, returns it.
 */
export const createJobFromBooking = async (
  booking: Booking,
  byEmployee: { id: string; name: string },
): Promise<string> => {
  if (booking.jobId) return booking.jobId;

  const serviceItems: JobServiceItem[] = [{
    serviceId: booking.serviceId,
    serviceName: booking.serviceName,
    category: booking.serviceCategory,
    price: booking.serviceBasePrice,
  }];
  const subtotal = booking.serviceBasePrice;

  const job: Record<string, unknown> = {
    source: 'booking',
    bookingId: booking.id,
    /**
     * THE TWO IDS THIS FUNCTION ALREADY HELD AND THREW AWAY.
     *
     * It copied `vehicleName` and `vehicleRegNo` - display snapshots - and not
     * `vehicleId` or `customerId`, both of which are right there on the
     * booking. That omission is why 15 of 18 production jobs carry no
     * customer, and why the customer picture had to fall back to joining on a
     * plate string. Written at creation, from the authoritative parent, never
     * derived from a name or a registration.
     */
    vehicleId: booking.vehicleId,
    customerId: booking.userId,
    customerName: booking.userName,
    customerPhone: booking.userPhone.replace(/\D/g, '').slice(-10),
    vehicleName: booking.vehicleName,
    vehicleRegNo: booking.vehicleRegNo.toUpperCase(),
    serviceItems,
    status: 'checked_in' as JobStatus,
    subtotal,
    totalAmount: booking.totalAmount,
    paymentStatus: booking.paymentStatus === 'verified' ? 'collected' : 'pending',
    createdByEmployeeId: byEmployee.id,
    createdByEmployeeName: byEmployee.name,
    assignments: [] as JobAssignment[],
    assignedIds: [] as string[],
    statusHistory: [{
      status: 'checked_in', at: Timestamp.now(),
      byEmployeeId: byEmployee.id, byEmployeeName: byEmployee.name,
      note: 'Vehicle checked in from booking',
    }],
    date: todayStr(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  if (booking.userId) job.customerId = booking.userId;
  if (booking.discount) job.discount = booking.discount;
  if (booking.invoiceId) job.invoiceId = booking.invoiceId;

  const ref = await addDoc(collection(db, 'jobs'), job);
  // Link the commercial record to its operational record + advance its stage.
  await updateDoc(doc(db, 'bookings', booking.id), {
    jobId: ref.id,
    status: 'vehicle_received',
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const getJob = async (id: string): Promise<Job | null> => {
  const snap = await getDoc(doc(db, 'jobs', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Job) : null;
};

/** Live listener for ONE customer's job behind a booking - powers the
 *  Live Care tracker. The customerId equality keeps the query inside the
 *  customer-reads-their-own security rule. */
export const subscribeJobForBooking = (
  bookingId: string,
  customerId: string,
  cb: (job: Job | null) => void,
) => {
  const q = query(
    collection(db, 'jobs'),
    where('bookingId', '==', bookingId),
    where('customerId', '==', customerId),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Job)),
    () => cb(null),
  );
};

/** Live listener for the kiosk job board (today's jobs). */
export const subscribeTodaysJobs = (
  cb: (jobs: Job[]) => void,
  onError?: (err: Error) => void,
) => {
  const q = query(collection(db, 'jobs'), where('date', '==', todayStr()));
  return onSnapshot(
    q,
    (snap) => {
      const jobs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Job))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      cb(jobs);
    },
    (err) => {
      console.error('job board listener dropped', err);
      onError?.(err);
    },
  );
};

export const saveJobNotes = (jobId: string, notes: string) =>
  updateDoc(doc(db, 'jobs', jobId), { notes, updatedAt: serverTimestamp() });

export const updateJobStatus = async (
  jobId: string, status: JobStatus, byEmployee: { id: string; name: string },
  opts?: { skipAutoConsumption?: boolean },
) => {
  const update: Record<string, unknown> = {
    status,
    statusHistory: arrayUnion({
      status, at: Timestamp.now(),
      byEmployeeId: byEmployee.id, byEmployeeName: byEmployee.name,
    }),
    updatedAt: serverTimestamp(),
  };
  if (status === 'completed') update.completedAt = serverTimestamp();
  await updateDoc(doc(db, 'jobs', jobId), update);

  // Side-effects on completion - fire-and-forget, never block the kiosk
  if (status === 'completed') {
    /* THE SEAL. Server-side, atomic and idempotent (lib/server/sealVisit.ts):
       one transaction writes the sealed Visit and the Protections it creates,
       snapshotting the services, the pricing and the warranty terms as the
       catalogue reads them right now. §14.5 - a later price-list edit must never
       change what this customer was promised.

       Awaited before the other side-effects so a failure is logged against the
       completion that caused it, and never blocking: a seal that fails is
       recovered by the idempotent backfill, whereas a kiosk that hangs on a
       network call strands a car at the counter. */
    try {
      const idToken = await token();
      if (idToken) {
        await authedFetch('/api/visit/seal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ jobId }),
        });
      }
    } catch (e) {
      console.error('seal failed; the backfill will catch it', e);
    }

    try {
      const job = await getJob(jobId);
      if (job) {
        if (!opts?.skipAutoConsumption) {
          const { consumeForService } = await import('./inventory');
          await consumeForService(job.serviceItems.map(i => i.serviceId), 'job', jobId, byEmployee.id);
        }
        if (!job.customerId) {
          const { recordWalkinSpend } = await import('./walkinCustomers');
          await recordWalkinSpend(job.customerPhone, job.totalAmount);
        }
      }
    } catch (e) {
      console.error('completion side-effects failed', e);
    }
  }
};

/**
 * Ledger payment: records WHO received HOW MUCH and WHEN. Supports advances
 * and partial payments - paymentStatus flips to 'collected' only when the
 * running total covers totalAmount.
 */
export const addJobPayment = async (
  job: Job,
  p: { amount: number; method: 'upi' | 'cash'; transactionId?: string;
       by: { id: string; name: string } },
) => {
  if (p.amount <= 0) throw new Error('amount must be positive');
  const record: PaymentRecord = {
    id: crypto.randomUUID(),
    amount: Math.round(p.amount),
    method: p.method,
    ...(p.transactionId ? { transactionId: p.transactionId } : {}),
    receivedById: p.by.id, receivedByName: p.by.name,
    at: Timestamp.now(), date: todayStr(),
  };
  const amountPaid = (job.amountPaid ?? 0) + record.amount;
  await updateDoc(doc(db, 'jobs', job.id), {
    payments: arrayUnion(record),
    amountPaid,
    paymentMethod: p.method,
    paymentStatus: amountPaid >= job.totalAmount ? 'collected' : 'pending',
    ...(p.transactionId ? { transactionId: p.transactionId } : {}),
    updatedAt: serverTimestamp(),
  });
  return record;
};

/** Legacy one-shot collect - full balance in a single payment. */
export const markJobPayment = (
  jobId: string, method: 'upi' | 'cash', transactionId?: string,
) =>
  updateDoc(doc(db, 'jobs', jobId), {
    paymentMethod: method, paymentStatus: 'collected',
    ...(transactionId ? { transactionId } : {}),
    updatedAt: serverTimestamp(),
  });

/** Completed jobs with money still owed, oldest first (receivables). */
export const getReceivables = async (): Promise<Job[]> => {
  const snap = await getDocs(query(
    collection(db, 'jobs'),
    where('status', '==', 'completed'),
    where('paymentStatus', '==', 'pending'),
  ));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Job))
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
};

/** Attach a before/after photo taken at the kiosk. */
export const addJobPhoto = async (job: Job, file: File, kind: JobPhoto['kind']): Promise<JobPhoto> => {
  const uploaded = await uploadImage(`jobs/${job.id}/${crypto.randomUUID()}.jpg`, file, { maxWidth: 1280 });
  const photo: JobPhoto = { ...uploaded, kind };
  await updateDoc(doc(db, 'jobs', job.id), {
    photos: arrayUnion(photo), updatedAt: serverTimestamp(),
  });
  return photo;
};

/**
 * Replace the active assignee set (admin-only per rules). History is kept:
 * removed assignments get removedAt/removedById; the change lands in
 * statusHistory so the job has ONE audit trail.
 */
export const setJobAssignees = async (
  job: Job,
  next: { id: string; name: string }[],
  by: { id: string; name: string },
) => {
  const now = Timestamp.now();
  const prev = job.assignments ?? [];
  const activePrev = prev.filter(a => !a.removedAt);
  const nextIds = next.map(w => w.id);

  const kept = prev.map(a =>
    !a.removedAt && !nextIds.includes(a.employeeId)
      ? { ...a, removedAt: now, removedById: by.id }
      : a,
  );
  const added: JobAssignment[] = next
    .filter(w => !activePrev.some(a => a.employeeId === w.id))
    .map(w => ({
      employeeId: w.id, employeeName: w.name,
      role: nextIds[0] === w.id ? 'lead' as const : 'helper' as const,
      assignedAt: now, assignedById: by.id, assignedByName: by.name,
    }));

  await updateDoc(doc(db, 'jobs', job.id), {
    assignments: [...kept, ...added],
    assignedIds: nextIds,
    statusHistory: arrayUnion({
      status: job.status, at: now,
      byEmployeeId: by.id, byEmployeeName: by.name,
      note: `Assigned: ${next.map(w => w.name).join(', ') || 'nobody'}`,
    }),
    updatedAt: serverTimestamp(),
  });
};

/** Jobs an employee actually worked (assignment-based, for the admin employee page). */
export const getJobsForEmployee = async (employeeId: string, max = 50): Promise<Job[]> => {
  const snap = await getDocs(query(
    collection(db, 'jobs'),
    where('assignedIds', 'array-contains', employeeId),
    limit(max),
  ));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Job))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

/** Admin history/reporting - jobs for a specific date (default: recent). */
export const getJobsForDate = async (date: string): Promise<Job[]> => {
  const snap = await getDocs(query(collection(db, 'jobs'), where('date', '==', date)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Job))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};

export const getRecentJobs = async (max = 100): Promise<Job[]> => {
  const snap = await getDocs(query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Job));
};

export const getJobsForCustomer = async (customerId: string): Promise<Job[]> => {
  const snap = await getDocs(query(collection(db, 'jobs'), where('customerId', '==', customerId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Job))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
};
