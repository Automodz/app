import { Timestamp } from 'firebase/firestore';
import type { Vehicle, Booking, Notification, Subscription } from './types';

const ts      = (daysAgo: number)   => Timestamp.fromDate(new Date(Date.now() - daysAgo * 86400000));
const future  = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString().split('T')[0];
const past    = (daysAgo: number)   => new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];

export const DEMO_VEHICLES: Vehicle[] = [
  { id: 'dv1', name: 'Maruti Swift',   registrationNumber: 'GJ01AB1234', category: 'Hatchback',   color: 'Pearl White',    notes: 'Daily driver',  createdAt: ts(90) },
  { id: 'dv2', name: 'Honda City ZX',  registrationNumber: 'GJ01CD5678', category: 'Sedan',       color: 'Radiant Red',    notes: 'Weekend car',   createdAt: ts(60) },
  { id: 'dv3', name: 'Hyundai Creta',  registrationNumber: 'GJ05EF9012', category: 'Compact SUV', color: 'Titan Grey',     notes: 'Family SUV',    createdAt: ts(45) },
  { id: 'dv4', name: 'Mercedes GLC',   registrationNumber: 'GJ01ZZ0001', category: 'Luxury',      color: 'Obsidian Black', notes: 'VIP treatment', createdAt: ts(10) },
];

export const DEMO_BOOKINGS: Booking[] = [
  {
    id: 'db1', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv4', vehicleName: 'Mercedes GLC', vehicleRegNo: 'GJ01ZZ0001',
    serviceId: 's2', serviceName: 'Llumar Platinum PPF', serviceCategory: 'PPF',
    serviceBasePrice: 205000, pickupDropRequired: true, pickupDropFee: 100, totalAmount: 205100,
    scheduledDate: future(2), scheduledTime: '09:00', status: 'confirmed',
    paymentMethod: 'upi', paymentStatus: 'pending', transactionId: 'GPay4521987634',
    createdAt: ts(1), updatedAt: ts(1),
  },
  {
    id: 'db2', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv3', vehicleName: 'Hyundai Creta', vehicleRegNo: 'GJ05EF9012',
    serviceId: 's11', serviceName: 'Kovalent Graphene Ceramic', serviceCategory: 'Ceramic',
    serviceBasePrice: 12000, pickupDropRequired: false, pickupDropFee: 0, totalAmount: 12000,
    scheduledDate: future(5), scheduledTime: '11:00', status: 'pending',
    paymentMethod: 'cash', paymentStatus: 'pending',
    createdAt: ts(2), updatedAt: ts(2),
  },
  {
    id: 'db3', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv2', vehicleName: 'Honda City ZX', vehicleRegNo: 'GJ01CD5678',
    serviceId: 's6', serviceName: 'Detail SPA', serviceCategory: 'Washing',
    serviceBasePrice: 2500, pickupDropRequired: true, pickupDropFee: 100, totalAmount: 2600,
    scheduledDate: past(1), scheduledTime: '10:00', status: 'in_progress',
    paymentMethod: 'cash', paymentStatus: 'pending',
    createdAt: ts(3), updatedAt: ts(1),
  },
  {
    id: 'db4', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv1', vehicleName: 'Maruti Swift', vehicleRegNo: 'GJ01AB1234',
    serviceId: 's5', serviceName: 'Premium Wash', serviceCategory: 'Washing',
    serviceBasePrice: 1000, pickupDropRequired: false, pickupDropFee: 0, totalAmount: 1000,
    scheduledDate: past(3), scheduledTime: '09:30', status: 'completed',
    paymentMethod: 'upi', paymentStatus: 'verified', transactionId: 'PhonePe7734521889',
    createdAt: ts(8), updatedAt: ts(3),
  },
  {
    id: 'db5', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv2', vehicleName: 'Honda City ZX', vehicleRegNo: 'GJ01CD5678',
    serviceId: 's12', serviceName: 'Kovalent Borophene Ceramic', serviceCategory: 'Ceramic',
    serviceBasePrice: 14000, pickupDropRequired: true, pickupDropFee: 100, totalAmount: 14100,
    scheduledDate: past(15), scheduledTime: '09:00', status: 'completed',
    paymentMethod: 'cash', paymentStatus: 'verified',
    createdAt: ts(20), updatedAt: ts(15),
  },
  {
    id: 'db6', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv1', vehicleName: 'Maruti Swift', vehicleRegNo: 'GJ01AB1234',
    serviceId: 's15', serviceName: 'Maintenance Coat', serviceCategory: 'Coating',
    serviceBasePrice: 4500, pickupDropRequired: false, pickupDropFee: 0, totalAmount: 4500,
    scheduledDate: past(30), scheduledTime: '14:00', status: 'completed',
    paymentMethod: 'upi', paymentStatus: 'verified', transactionId: 'GPay9912345670',
    createdAt: ts(35), updatedAt: ts(30),
  },
  {
    id: 'db7', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv3', vehicleName: 'Hyundai Creta', vehicleRegNo: 'GJ05EF9012',
    serviceId: 's7', serviceName: 'Dry Clean', serviceCategory: 'Washing',
    serviceBasePrice: 4000, pickupDropRequired: false, pickupDropFee: 0, totalAmount: 4000,
    scheduledDate: past(45), scheduledTime: '11:00', status: 'cancelled',
    paymentMethod: 'upi', paymentStatus: 'pending',
    createdAt: ts(50), updatedAt: ts(45),
  },
  {
    id: 'db8', userId: 'demo-user', userName: 'Arjun Mehta',
    userPhone: '9876543210', userEmail: 'arjun.demo@automodz.in',
    vehicleId: 'dv1', vehicleName: 'Maruti Swift', vehicleRegNo: 'GJ01AB1234',
    serviceId: 's1', serviceName: 'Llumar Gloss PPF', serviceCategory: 'PPF',
    serviceBasePrice: 145000, pickupDropRequired: true, pickupDropFee: 100, totalAmount: 145100,
    scheduledDate: past(60), scheduledTime: '09:00', status: 'completed',
    paymentMethod: 'cash', paymentStatus: 'verified',
    createdAt: ts(65), updatedAt: ts(60),
  },
];

export const DEMO_NOTIFICATIONS: Notification[] = [
  { id: 'dn1', userId: 'demo-user', title: 'Mercedes GLC Ready for Pickup',       body: 'Your Llumar Platinum PPF installation is complete. Vehicle ready at 6 PM.',                                   type: 'booking_update', read: false, bookingId: 'db1', createdAt: ts(0) },
  { id: 'dn2', userId: 'demo-user', title: 'Booking Confirmed',                   body: `Your Kovalent Graphene Ceramic booking for Hyundai Creta on ${future(5)} is confirmed.`,                      type: 'booking_update', read: false, bookingId: 'db2', createdAt: ts(1) },
  { id: 'dn3', userId: 'demo-user', title: 'Honda City Detail SPA In Progress',   body: 'Our team has started working on your Honda City. Estimated completion: 4 hours.',                             type: 'booking_update', read: true,  bookingId: 'db3', createdAt: ts(1) },
  { id: 'dn4', userId: 'demo-user', title: 'How was your Premium Wash?',           body: 'Your Maruti Swift Premium Wash is complete. We hope you loved the results!',                                  type: 'reminder',       read: true,  bookingId: 'db4', createdAt: ts(3) },
  { id: 'dn5', userId: 'demo-user', title: 'Special Offer: 15% off PPF',           body: 'Exclusive offer for loyal customers. Book any PPF service this month and save ₹15,000+',                     type: 'promotion',      read: true,                    createdAt: ts(7) },
];

export const DEMO_SUBSCRIPTION: Subscription = {
  id:            'demo-sub-1',
  userId:        'demo-user',
  userName:      'Arjun Mehta',
  userEmail:     'arjun.demo@automodz.in',
  userPhone:     '9876543210',
  plan:          'Gold',
  status:        'active',
  startDate:     new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0],
  endDate:       new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0],
  washesTotal:   8,
  washesUsed:    3,
  paymentMethod: 'upi',
  transactionId: 'GPay8834521001',
  createdAt:     Timestamp.fromDate(new Date(Date.now() - 12 * 86400000)),
  updatedAt:     Timestamp.fromDate(new Date(Date.now() - 2  * 86400000)),
};