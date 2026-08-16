import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/* `getAdminStats` STOOD HERE. It read EVERY booking and EVERY user document
   to count today's bookings - an unbounded pair of collection scans, growing
   with the business, on a dashboard that computes its own figures from the
   scoped queries it already makes (`app/admin/page.tsx`). Nothing called it,
   and on a project that has just exhausted its daily read quota the last thing
   worth keeping is a full-collection scan waiting for a caller. */
