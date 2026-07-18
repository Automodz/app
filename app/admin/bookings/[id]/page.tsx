'use client';
// Deep-link escape hatch — the workspace itself lives in components/workspace
// and normally opens as a drawer over the Studio Board.
import { useParams } from 'next/navigation';
import BookingWorkspace from '@/components/workspace/BookingWorkspace';

export default function BookingWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  return <BookingWorkspace id={id} />;
}
