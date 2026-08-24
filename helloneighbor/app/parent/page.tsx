import { redirect } from 'next/navigation';
import { currentParentId } from '@/lib/session';
import ParentDashboard from '@/components/ParentDashboard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your family · HelloNeighbor' };

export default function ParentPage() {
  if (!currentParentId()) redirect('/parent/login');
  return <ParentDashboard />;
}
