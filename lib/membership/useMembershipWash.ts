import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Subscription } from "@/lib/types";

export async function useMembershipWash(subscription: Subscription) {

  if (!subscription) return false;

  const remaining = subscription.washesTotal - subscription.washesUsed;

  if (remaining <= 0) {
    throw new Error("NO_WASHES_LEFT");
  }

  const ref = doc(db, "subscriptions", subscription.id);

  await updateDoc(ref, {
    washesUsed: increment(1),
    updatedAt: new Date(),
  });

  return true;
}