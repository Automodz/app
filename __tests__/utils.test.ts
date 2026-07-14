import {
  formatCurrency, formatDate, formatTime,
  canCancelBooking, minutesUntilCancelDeadline,
  generateTimeSlots, getAvailableDates,
  getStatusLabel, getStatusColor, getStatusStep,
} from '../lib/utils';

test('formatCurrency displays INR correctly', () => {
  expect(formatCurrency(500)).toBe('₹500');
  expect(formatCurrency(123456)).toBe('₹1,23,456');
});

test('date and time formatting', () => {
  expect(formatDate('2023-12-25')).toContain('25');
  expect(formatTime('09:30')).toContain('9:30');
});

test('cancellation window', () => {
  // A booking 2 days out is always cancellable; one in the past never is
  const twoDaysOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  expect(canCancelBooking(twoDaysOut, '10:00')).toBeTruthy();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  expect(canCancelBooking(yesterday, '10:00')).toBeFalsy();
});

// more tests can be added later
