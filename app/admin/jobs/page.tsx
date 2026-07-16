// Active Jobs merged into the Workspace — keep old links working.
import { redirect } from 'next/navigation';

export default function JobsRedirect() {
  redirect('/admin');
}
