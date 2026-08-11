import { notFound } from 'next/navigation';
import { ApprovalScreen } from '@/components/studio/ApprovalScreen';
import { ServerRoom } from '@/components/screens/ServerRoom';
import { toApproval } from '@/lib/customer/project';
import { currentSession } from '@/lib/server/session';
import { readApproval } from '@/lib/server/approvalService';

export const dynamic = 'force-dynamic';

/**
 * `/approval/[id]` — design screen 12.
 *
 * The approval is read HERE rather than out of the customer picture, because
 * an approval is about a visit in flight and the picture is a snapshot: a
 * request the studio made ninety seconds ago must appear the moment the
 * customer opens the notification, not on whatever the page last rendered.
 *
 * Ownership is checked inside `readApproval`, against the verified session. An
 * approval that is not the caller's returns null, which becomes the same 404
 * as one that does not exist — so this cannot be used to discover which
 * approvals are real.
 */
export default async function ApprovalPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await currentSession();
  const approval = session ? await readApproval(session.uid, id) : null;

  return (
    <ServerRoom>
      {() => {
        if (!approval) notFound();
        return <ApprovalScreen model={toApproval(approval)} />;
      }}
    </ServerRoom>
  );
}
