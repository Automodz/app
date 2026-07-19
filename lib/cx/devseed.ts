/**
 * Dev-only seed data — companion to the AuthContext dev-auth shim.
 * Mock dev users cannot read Firestore, so customer surfaces seed from here
 * to be exercisable locally (Live Activity, booking flow, Care tracker).
 * Never imported into any production path without the dev-uid guard.
 */
import { Timestamp } from 'firebase/firestore';
import type { Booking, Job, Vehicle } from '@/lib/types';
import { MEDIA } from '@/lib/media';

export const isDevUser = (uid: string | undefined): boolean =>
  process.env.NODE_ENV === 'development' && !!uid?.startsWith('dev-');

const today = new Date().toISOString().split('T')[0];
const tsMinAgo = (min: number) => Timestamp.fromDate(new Date(Date.now() - min * 60000));

export const DEV_VEHICLE = {
  id: 'dev-car', name: 'BMW M340i', registrationNumber: 'GJ01AB1234',
  category: 'Luxury', color: 'Grey',
} as unknown as Vehicle;

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

export const DEV_JOBS: Record<string, Job> = {
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
      { status: 'checked_in', at: tsMinAgo(135), byEmployeeId: 'e1', byEmployeeName: 'Ravi Sharma', note: 'Walked the car with the owner — noted stone chip on bonnet.' },
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
