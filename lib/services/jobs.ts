import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp, arrayUnion,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../firebase';
import { uploadImage } from './storage';
import type { Job, JobStatus, JobServiceItem, JobPhoto, JobAssignment, PaymentRecord, User, BookingDiscount, Booking } from '../types';

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

export const createWalkInJob = async (data: {
  customerId?: string; customerName: string; customerPhone: string;
  vehicleName: string; vehicleRegNo: string;
  serviceItems: JobServiceItem[];
  bay?: 1 | 2 | 3;
  discount?: BookingDiscount;
  byEmployee: { id: string; name: string };
  /** Who works this job - defaults to the intake employee as lead. */
  assignees?: { id: string; name: string }[];
}): Promise<string> => {
  const subtotal = data.serviceItems.reduce((s, i) => s + i.price, 0);
  const totalAmount = Math.max(0, subtotal - (data.discount?.amount ?? 0));
  const workers = data.assignees?.length ? data.assignees : [data.byEmployee];
  const assignments: JobAssignment[] = workers.map((w, i) => ({
    employeeId: w.id, employeeName: w.name,
    role: i === 0 ? 'lead' : 'helper',
    assignedAt: Timestamp.now(),
    assignedById: data.byEmployee.id, assignedByName: data.byEmployee.name,
  }));
  const job: Record<string, unknown> = {
    source: 'walk_in',
    customerName: data.customerName,
    customerPhone: data.customerPhone.replace(/\D/g, '').slice(-10),
    vehicleName: data.vehicleName,
    vehicleRegNo: data.vehicleRegNo.toUpperCase(),
    serviceItems: data.serviceItems,
    status: 'checked_in' as JobStatus,
    subtotal, totalAmount,
    paymentStatus: 'pending',
    createdByEmployeeId: data.byEmployee.id,
    createdByEmployeeName: data.byEmployee.name,
    assignments,
    assignedIds: workers.map(w => w.id),
    statusHistory: [{
      status: 'checked_in', at: Timestamp.now(),
      byEmployeeId: data.byEmployee.id, byEmployeeName: data.byEmployee.name,
    }],
    date: todayStr(),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  if (data.customerId) job.customerId = data.customerId;
  if (data.bay) job.bay = data.bay;
  if (data.discount) job.discount = data.discount;
  const r = await addDoc(collection(db, 'jobs'), job);
  // Walk-in CRM record for accountless customers - fire-and-forget
  if (!data.customerId) {
    import('./walkinCustomers').then(({ recordWalkinVisit }) =>
      recordWalkinVisit({
        name: data.customerName, phone: data.customerPhone,
        vehicleName: data.vehicleName, date: todayStr(),
      })).catch(() => {});
  }
  return r.id;
};

/**
 * Vehicle check-in: create the operational Job for a customer Booking.
 * The Booking (commercial truth) is NEVER replaced — it stays and gains a
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

export const setJobBay = (jobId: string, bay: 1 | 2 | 3) =>
  updateDoc(doc(db, 'jobs', jobId), { bay, updatedAt: serverTimestamp() });

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
