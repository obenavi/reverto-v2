import Link from 'next/link';
import { GUIDELINES, TERMS_VERSION } from '@/lib/guidelines';
import { PageHeader, Shell } from '@/components/ui';

export const metadata = {
  title: 'Community guidelines · HelloNeighbor',
  description: 'The rules everyone on HelloNeighbor agrees to.',
};

export default function GuidelinesPage() {
  return (
    <Shell>
      <PageHeader
        title="Community guidelines"
        subtitle={`Version ${TERMS_VERSION} — everyone who signs up or books agrees to this.`}
        back={{ href: '/', label: 'Home' }}
      />

      <div className="space-y-4">
        {GUIDELINES.map((section) => (
          <section key={section.id} id={section.id} className="card">
            <h2 className="mb-2 font-bold">{section.title}</h2>
            <div className="space-y-2 text-ink-muted">
              {section.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-card bg-warning-light p-4 text-[13px] text-warning">
        <p className="font-bold">Questions, or something went wrong?</p>
        <p className="mt-1">
          Open a dispute from the booking itself so an administrator can read the message
          history, or reach the team at{' '}
          <a className="underline" href="mailto:safety@helloneighbor.app">
            safety@helloneighbor.app
          </a>
          .
        </p>
      </div>

      <p className="mt-6 text-center">
        <Link href="/join" className="btn-primary">
          Start my business
        </Link>
      </p>
    </Shell>
  );
}
