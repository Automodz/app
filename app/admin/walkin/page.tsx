'use client';
// Walk-in intake inside the admin OS — same flow the kiosk uses, no
// context switch into Store Mode chrome.
import WalkInFlow from '@/components/intake/WalkInFlow';

export default function AdminWalkInPage() {
  return <WalkInFlow />;
}
