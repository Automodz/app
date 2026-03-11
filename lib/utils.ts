import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, addDays, differenceInMinutes, parseISO, parse } from 'date-fns';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const PICKUP_FEE = 50;  // per leg — 50 pick + 50 drop = 100 total

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  return format(d, 'dd MMM yyyy');
};

export const formatTime = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(); d.setHours(h, m);
  return format(d, 'h:mm a');
};

/** Returns true if the booking can still be cancelled (>4hrs before scheduled time) */
export const canCancelBooking = (scheduledDate: string, scheduledTime: string): boolean => {
  try {
    const scheduled = parse(
      `${scheduledDate} ${scheduledTime}`,
      'yyyy-MM-dd HH:mm',
      new Date()
    );
    const now = new Date();
    return differenceInMinutes(scheduled, now) > 240; // 4 hours = 240 min
  } catch {
    return false;
  }
};

/** Minutes until cancellation window closes (for display) */
export const minutesUntilCancelDeadline = (scheduledDate: string, scheduledTime: string): number => {
  try {
    const scheduled = parse(`${scheduledDate} ${scheduledTime}`, 'yyyy-MM-dd HH:mm', new Date());
    return differenceInMinutes(scheduled, new Date()) - 240;
  } catch { return 0; }
};

export const generateTimeSlots = (durationMinutes: number): string[] => {
  const slots: string[] = [];
  const start = 9 * 60;  // 9:00 AM
  const end   = 19 * 60; // 7:00 PM
  const step  = Math.max(durationMinutes, 30); // min 30-min gaps
  for (let t = start; t + durationMinutes <= end; t += step) {
    const h = Math.floor(t / 60).toString().padStart(2, '0');
    const m = (t % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
};

export const getAvailableDates = (count = 14): string[] => {
  const dates: string[] = [];
  for (let i = 1; dates.length < count; i++) {
    const d = addDays(new Date(), i);
    if (d.getDay() !== 0) dates.push(format(d, 'yyyy-MM-dd')); // skip Sundays
  }
  return dates;
};

export const getStatusLabel = (status: string): string => ({
  pending: 'Pending', confirmed: 'Confirmed', vehicle_received: 'Received',
  in_progress: 'In Progress', quality_check: 'QC Check',
  ready_for_delivery: 'Ready', completed: 'Completed', cancelled: 'Cancelled',
}[status] || status);

export const getStatusColor = (status: string): string => ({
  pending:            'text-yellow-400 bg-yellow-400/10',
  confirmed:          'text-blue-400 bg-blue-400/10',
  vehicle_received:   'text-purple-400 bg-purple-400/10',
  in_progress:        'text-orange-400 bg-orange-400/10',
  quality_check:      'text-cyan-400 bg-cyan-400/10',
  ready_for_delivery: 'text-green-400 bg-green-400/10',
  completed:          'text-emerald-400 bg-emerald-400/10',
  cancelled:          'text-red-400 bg-red-400/10',
}[status] || 'text-gray-400 bg-gray-400/10');

export const getStatusStep = (status: string): number =>
  ['pending','confirmed','vehicle_received','in_progress','quality_check','ready_for_delivery','completed'].indexOf(status);

export const getCategoryIcon = (category: string): string =>
  ({ PPF: '🛡️', Washing: '🚿', Ceramic: '💎', Coating: '✨' }[category] || '🔧');

export const getDurationLabel = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr${minutes >= 120 ? 's' : ''}`;
  return `${Math.round(minutes / 1440)} day${minutes > 1440 ? 's' : ''}`;
};

export const getBookingWhatsAppMsg = (b: {
  userName: string; vehicleName: string; serviceName: string;
  scheduledDate: string; scheduledTime: string; totalAmount: number;
  id: string; pickupDropRequired?: boolean; paymentMethod?: string; transactionId?: string;
}) =>
`🚗 *AutoModz Booking*

Customer: ${b.userName}
Vehicle: ${b.vehicleName}
Service: ${b.serviceName}
Date: ${formatDate(b.scheduledDate)} at ${formatTime(b.scheduledTime)}
Amount: ${formatCurrency(b.totalAmount)}
Payment: ${b.paymentMethod === 'upi' ? `UPI${b.transactionId ? ` (Txn: ${b.transactionId})` : ' (pending)'}` : 'Cash at shop'}
${b.pickupDropRequired ? '🚙 Pickup & Drop required' : ''}
Booking ID: ${b.id.slice(0, 8).toUpperCase()}`;
