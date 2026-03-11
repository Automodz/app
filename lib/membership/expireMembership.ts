import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Subscription } from "@/lib/types";

export async function expireMembershipIfNeeded(subscription: Subscription) {
  const today = new Date().toISOString().split("T")[0];

  if (subscription.status !== "active") return false;

  if (subscription.endDate < today) {
    try {
      const ref = doc(db, "subscriptions", subscription.id);

      await updateDoc(ref, {
        status: "expired",
        updatedAt: new Date(),
      });

      return true;
    } catch (error) {
      console.error("Membership expiry update failed", error);
      return false;
    }
  }

  return false;
}