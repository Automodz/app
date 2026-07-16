// The Workspace IS the admin landing page now — keep earlier links working.
import { redirect } from 'next/navigation';

export default function WorkspaceRedirect() {
  redirect('/admin');
}
