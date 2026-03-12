// Booking slot configuration for AutoModz detailing studio

export const SLOT_INTERVAL = 60; // minutes
export const OPENING_TIME = "09:00";
export const CLOSING_TIME = "19:00";
export const SLOT_CAPACITY = 3;

/**
 * Convert HH:MM to minutes
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convert minutes back to HH:MM
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");

  return `${h}:${m}`;
}

/**
 * Generate all time slots between opening and closing
 */
export function generateTimeSlots(): string[] {
  const slots: string[] = [];

  const start = timeToMinutes(OPENING_TIME);
  const end = timeToMinutes(CLOSING_TIME);

  for (let t = start; t < end; t += SLOT_INTERVAL) {
    slots.push(minutesToTime(t));
  }

  return slots;
}

/**
 * Calculate how many slots a service requires
 * Example:
 * 60 min service → 1 slot
 * 120 min service → 2 slots
 */
export function calculateRequiredSlots(duration: number): number {
  return Math.ceil(duration / SLOT_INTERVAL);
}