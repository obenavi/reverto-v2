import GuardianConsent from '@/components/GuardianConsent';
import { PageHeader, Shell } from '@/components/ui';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Permission needed · HelloNeighbor',
  robots: { index: false, follow: false },
};

export default function ConsentPage({ params }: { params: { token: string } }) {
  return (
    <Shell>
      <PageHeader title="Permission needed" />
      <GuardianConsent token={params.token} />
    </Shell>
  );
}
