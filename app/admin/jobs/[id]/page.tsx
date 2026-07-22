'use client';
// Deep-link escape hatch - the workspace itself lives in components/workspace
// and normally opens as a drawer over the Studio Board.
import { useParams } from 'next/navigation';
import JobWorkspace from '@/components/workspace/JobWorkspace';

export default function JobWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  return <JobWorkspace id={id} />;
}
