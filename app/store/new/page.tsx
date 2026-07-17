'use client';
// Kiosk entry point - the intake flow itself is shared with /admin/walkin.
import WalkInFlow from '@/components/intake/WalkInFlow';

export default function StoreNewJobPage() {
  return <WalkInFlow />;
}
