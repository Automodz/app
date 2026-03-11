import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function isMembershipExpired(endDate: string): boolean {
  const today = new Date();
  const end = new Date(endDate);

  return today > end;
}

export async function expireMembershipIfNeeded(subscription: any) {
  if (!subscription) return;

  const expired = isMembershipExpired(subscription.endDate);

  if (!expired) return;

  const ref = doc(db, "subscriptions", subscription.id);

  await updateDoc(ref, {
    status: "expired",
  });
}