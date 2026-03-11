import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SLOT_CAPACITY } from "@/lib/config/bookingConfig";

/**
 * Checks how many bookings exist for a slot
 */
export async function checkSlotAvailability(
  date: string,
  time: string
): Promise<{
  available: boolean;
  count: number;
  capacity: number;
}> {
  const q = query(
    collection(db, "bookings"),
    where("scheduledDate", "==", date),
    where("scheduledTime", "==", time),
    where("status", "!=", "cancelled")
  );

  const snapshot = await getDocs(q);

  const count = snapshot.size;

  return {
    available: count < SLOT_CAPACITY,
    count,
    capacity: SLOT_CAPACITY,
  };
}