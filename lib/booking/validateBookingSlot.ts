import { checkSlotAvailability } from "./checkSlotAvailability";

export async function validateBookingSlot(date: string, time: string) {
  const slot = await checkSlotAvailability(date, time);

  if (!slot.available) {
    throw new Error("SLOT_FULL");
  }

  return true;
}