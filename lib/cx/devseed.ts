/**
 * Dev-only seed data - companion to the AuthContext dev-auth shim.
 * Mock dev users cannot read Firestore, so customer surfaces seed from here
 * to be exercisable locally (Live Activity, booking flow, Care tracker).
 * Never imported into any production path without the dev-uid guard.
 */
import { Timestamp } from 'firebase/firestore';
import type { Booking, Job, Subscription, Vehicle } from '@/lib/types';
import { MEDIA } from '@/lib/media';

export const isDevUser = (uid: string | undefined): boolean =>
  process.env.NODE_ENV === 'development' && !!uid?.startsWith('dev-');

const today = new Date().toISOString().split('T')[0];
const tsMinAgo = (min: number) => Timestamp.fromDate(new Date(Date.now() - min * 60000));

export const DEV_VEHICLE = {
  id: 'dev-car', name: 'BMW M340i', registrationNumber: 'GJ01AB1234',
  category: 'Luxury', color: 'Grey',
  createdAt: Timestamp.fromDate(new Date('2026-03-01T12:00:00')),
} as unknown as Vehicle;

/** Completed ceramic from April - makes protection ACTIVE on the passport. */
export const DEV_CERAMIC_BOOKING = {
  id: 'dev-ceramic', userId: 'dev-customer', vehicleId: 'dev-car',
  vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
  serviceName: 'Kovalent Graphene', serviceCategory: 'Ceramic',
  serviceDurationMinutes: 480, status: 'completed',
  scheduledDate: '2026-04-20', scheduledTime: '09:00',
  totalAmount: 12000, paymentMethod: 'upi', paymentStatus: 'verified',
  jobId: 'dev-job-ceramic', invoiceId: 'dev-inv-1',
} as unknown as Booking;

export const DEV_ACTIVE_BOOKING = {
  id: 'dev-visit', userId: 'dev-customer', vehicleId: 'dev-car',
  vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
  serviceName: 'Ceramic Coating', serviceCategory: 'Ceramic',
  serviceDurationMinutes: 480, status: 'in_progress',
  scheduledDate: today, scheduledTime: '10:00',
  totalAmount: 24000, paymentMethod: 'upi', paymentStatus: 'pending',
  jobId: 'dev-job-active',
} as unknown as Booking;

export const DEV_COMPLETED_BOOKING = {
  id: 'dev-done', userId: 'dev-customer', vehicleId: 'dev-car',
  vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
  serviceName: 'Signature Wash', serviceCategory: 'Washing',
  serviceDurationMinutes: 60, status: 'completed',
  scheduledDate: '2026-07-12', scheduledTime: '11:00',
  totalAmount: 1200, paymentMethod: 'cash', paymentStatus: 'verified',
  jobId: 'dev-job-done',
} as unknown as Booking;

/** A request the studio couldn't take (approval workflow) - carries the reason,
 *  so the "declined" fork of the lifecycle is exercisable locally. */
export const DEV_DECLINED_BOOKING = {
  id: 'dev-declined', userId: 'dev-customer', vehicleId: 'dev-car',
  vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
  serviceName: 'Signature Wash', serviceCategory: 'Washing',
  serviceDurationMinutes: 60, status: 'cancelled',
  scheduledDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
  scheduledTime: '14:00',
  totalAmount: 1200, paymentMethod: 'cash', paymentStatus: 'pending',
  rejectionReason: 'That afternoon was fully booked — mornings this week are wide open.',
  cancelledAt: tsMinAgo(60 * 20), createdAt: tsMinAgo(60 * 30), updatedAt: tsMinAgo(60 * 20),
} as unknown as Booking;

/** An active Club membership, mid-cycle - the Club layer needs a real one. */
export const DEV_MEMBERSHIP = {
  id: 'dev-sub', userId: 'dev-customer', userName: 'Aarav Mehta',
  userEmail: 'customer@dev.automodz.local', userPhone: '',
  plan: 'Silver', status: 'active',
  startDate: new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0],
  endDate: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0],
  washesTotal: 4, washesUsed: 1, paymentMethod: 'upi',
} as unknown as Subscription;

export const DEV_JOBS: Record<string, Job> = {
  'dev-ceramic': {
    id: 'dev-job-ceramic', source: 'booking', bookingId: 'dev-ceramic',
    customerId: 'dev-customer', customerName: 'Aarav Mehta', customerPhone: '',
    vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
    serviceItems: [{ serviceId: 's11', serviceName: 'Kovalent Graphene', category: 'Ceramic', price: 12000 }],
    bay: 2, status: 'completed', subtotal: 12000, totalAmount: 12000,
    paymentStatus: 'collected', amountPaid: 12000, invoiceId: 'dev-inv-1',
    createdByEmployeeId: 'e1', createdByEmployeeName: 'Bay Detailer',
    assignments: [{
      employeeId: 'e1', employeeName: 'Ravi Sharma', role: 'lead',
      assignedAt: Timestamp.fromDate(new Date('2026-04-20T09:00:00')),
      assignedById: 'a1', assignedByName: 'Studio Owner',
    }],
    assignedIds: ['e1'],
    statusHistory: [
      { status: 'checked_in', at: Timestamp.fromDate(new Date('2026-04-20T09:05:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma' },
      { status: 'in_progress', at: Timestamp.fromDate(new Date('2026-04-20T09:40:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma', note: 'Two-stage paint correction before the coat.' },
      { status: 'completed', at: Timestamp.fromDate(new Date('2026-04-20T17:30:00')), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma' },
    ],
    photos: [
      { url: MEDIA.services.washing, path: 'dev/c1', kind: 'before' },
      { url: MEDIA.services.ceramic, path: 'dev/c2', kind: 'after' },
    ],
    date: '2026-04-20',
    createdAt: Timestamp.fromDate(new Date('2026-04-20T09:00:00')),
    updatedAt: Timestamp.fromDate(new Date('2026-04-20T17:30:00')),
    completedAt: Timestamp.fromDate(new Date('2026-04-20T17:30:00')),
  } as unknown as Job,
  'dev-visit': {
    id: 'dev-job-active', source: 'booking', bookingId: 'dev-visit',
    customerId: 'dev-customer', customerName: 'Aarav Mehta', customerPhone: '',
    vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
    serviceItems: [{ serviceId: 's1', serviceName: 'Ceramic Coating', category: 'Ceramic', price: 24000 }],
    bay: 2, status: 'in_progress', subtotal: 24000, totalAmount: 24000,
    paymentStatus: 'pending', amountPaid: 0,
    createdByEmployeeId: 'e1', createdByEmployeeName: 'Bay Detailer',
    assignments: [{
      employeeId: 'e1', employeeName: 'Ravi Sharma', role: 'lead',
      assignedAt: tsMinAgo(130), assignedById: 'a1', assignedByName: 'Studio Owner',
    }],
    assignedIds: ['e1'],
    statusHistory: [
      { status: 'checked_in', at: tsMinAgo(135), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma', note: 'Walked the car with the owner - noted stone chip on bonnet.' },
      { status: 'in_progress', at: tsMinAgo(110), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma', note: 'Decontamination wash and clay complete.' },
    ],
    photos: [
      { url: MEDIA.services.washing, path: 'dev/1', kind: 'before' },
      { url: MEDIA.services.ceramic, path: 'dev/2', kind: 'during' },
    ],
    date: today, createdAt: tsMinAgo(135), updatedAt: tsMinAgo(10),
  } as unknown as Job,
  'dev-done': {
    id: 'dev-job-done', source: 'booking', bookingId: 'dev-done',
    customerId: 'dev-customer', customerName: 'Aarav Mehta', customerPhone: '',
    vehicleName: 'BMW M340i', vehicleRegNo: 'GJ01AB1234',
    serviceItems: [{ serviceId: 's2', serviceName: 'Signature Wash', category: 'Washing', price: 1200 }],
    bay: 1, status: 'completed', subtotal: 1200, totalAmount: 1200,
    paymentStatus: 'collected', amountPaid: 1200,
    createdByEmployeeId: 'e2', createdByEmployeeName: 'Bay Detailer',
    assignments: [{
      employeeId: 'e2', employeeName: 'Karan Patel', role: 'lead',
      assignedAt: tsMinAgo(60 * 24 * 8), assignedById: 'a1', assignedByName: 'Studio Owner',
    }],
    assignedIds: ['e2'],
    statusHistory: [
      { status: 'checked_in', at: tsMinAgo(60 * 24 * 8 + 60), byEmployeeId: 'e2', byEmployeeName: 'Karan Patel' },
      { status: 'in_progress', at: tsMinAgo(60 * 24 * 8 + 45), byEmployeeId: 'e2', byEmployeeName: 'Karan Patel' },
      { status: 'quality_check', at: tsMinAgo(60 * 24 * 8 + 15), byEmployeeId: 'e2', byEmployeeName: 'Karan Patel' },
      { status: 'ready_for_delivery', at: tsMinAgo(60 * 24 * 8 + 5), byEmployeeId: 'e2', byEmployeeName: 'Karan Patel' },
      { status: 'completed', at: tsMinAgo(60 * 24 * 8), byEmployeeId: 'e2', byEmployeeName: 'Karan Patel' },
    ],
    photos: [
      { url: MEDIA.services.washing, path: 'dev/3', kind: 'before' },
      { url: MEDIA.services.coating, path: 'dev/4', kind: 'after' },
    ],
    date: '2026-07-12', createdAt: tsMinAgo(60 * 24 * 8 + 60), updatedAt: tsMinAgo(60 * 24 * 8),
    completedAt: tsMinAgo(60 * 24 * 8),
  } as unknown as Job,
};
