// Phase A migration: give every legacy job an assignments array + assignedIds
// (creator as lead). Idempotent - skips jobs that already have assignedIds.
// Run: node --env-file=.env.local scripts/backfill-assignments.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'automodz',
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore(app);

const snap = await db.collection('jobs').get();
let updated = 0, skipped = 0;
for (const d of snap.docs) {
  const j = d.data();
  if (Array.isArray(j.assignedIds)) { skipped++; continue; }
  const at = j.createdAt ?? Timestamp.now();
  await d.ref.update({
    assignments: [{
      employeeId: j.createdByEmployeeId ?? 'unknown',
      employeeName: j.createdByEmployeeName ?? 'Unknown',
      role: 'lead',
      assignedAt: at,
      assignedById: j.createdByEmployeeId ?? 'unknown',
      assignedByName: j.createdByEmployeeName ?? 'Unknown',
    }],
    assignedIds: [j.createdByEmployeeId ?? 'unknown'],
  });
  updated++;
}
console.log(`backfill done: ${updated} updated, ${skipped} already migrated`);
process.exit(0);
