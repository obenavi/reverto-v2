import ChatThread from '@/components/ChatThread';
import CustomerProfileForm from '@/components/CustomerProfileForm';
import { PageHeader, Shell } from '@/components/ui';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your booking · HelloNeighbor',
  robots: { index: false, follow: false },
};

/**
 * The neighbor's view of a thread. The token in the path is their credential,
 * so this page must never be indexed or shared.
 */
export default function ClientChatPage({ params }: { params: { token: string } }) {
  return (
    <Shell>
      <PageHeader title="Your booking" subtitle="Message your provider here." />
      <ChatThread token={params.token} />
      <CustomerProfileForm token={params.token} />
    </Shell>
  );
}
