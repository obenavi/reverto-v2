import Link from 'next/link';
import { RESPONSE_TARGET_HOURS } from '@/lib/reports';
import { PageHeader, Shell } from '@/components/ui';

export const metadata = {
  title: 'Safety · HelloNeighbor',
  description: 'How to report a problem, block someone, and reach a human.',
};

export default function SafetyPage() {
  return (
    <Shell>
      <PageHeader
        title="Safety"
        subtitle="How to get help, and what happens when you ask."
        back={{ href: '/', label: 'Home' }}
      />

      <div className="mb-4 rounded-card border border-danger bg-danger-light p-4">
        <p className="font-bold text-danger">If someone is in immediate danger</p>
        <p className="mt-1 text-[13px] text-danger">
          Call your local emergency number first. HelloNeighbor is not an emergency
          service and nobody is monitoring this app around the clock.
        </p>
      </div>

      <div className="space-y-4">
        <section className="card">
          <h2 className="mb-2 font-bold">Reporting someone</h2>
          <p className="text-ink-muted">
            Every conversation has a <strong>Report or block this person</strong> link at
            the bottom. Pick what happened, add anything useful, and send. You can block
            at the same time.
          </p>
          <p className="mt-2 text-ink-muted">
            Reports about safety, inappropriate content, or someone&apos;s age go to the
            top of the queue. Everything else is reviewed within{' '}
            {RESPONSE_TARGET_HOURS} hours.
          </p>
        </section>

        <section className="card">
          <h2 className="mb-2 font-bold">Blocking</h2>
          <p className="text-ink-muted">
            A block is immediate and works both ways: they cannot book you, message you,
            or ping you, and you will not hear from them again. Existing bookings stay in
            your history so a dispute can still be resolved.
          </p>
          <p className="mt-2 text-ink-muted">
            Operators can unblock from their dashboard. You do not need a reason, and we
            do not tell the other person they were blocked.
          </p>
        </section>

        <section className="card">
          <h2 className="mb-2 font-bold">What we check automatically</h2>
          <p className="text-ink-muted">
            Every signup, listing, and message is reviewed against the community
            guidelines before or shortly after it appears. That catches banned services,
            attempts to move people off the app, and content that should not be here — but
            it is not a substitute for telling us when something feels wrong.
          </p>
        </section>

        <section className="card">
          <h2 className="mb-2 font-bold">Reaching a person</h2>
          <p className="text-ink-muted">
            Email{' '}
            <a className="font-semibold text-brand" href="mailto:safety@helloneighbor.app">
              safety@helloneighbor.app
            </a>
            . Parents and guardians can use the same address to ask what we hold about
            their child, withdraw permission, or have an account deleted.
          </p>
        </section>
      </div>

      <p className="mt-6 flex justify-center gap-4 text-[13px]">
        <Link href="/guidelines" className="font-semibold text-brand">
          Community guidelines
        </Link>
        <Link href="/privacy" className="font-semibold text-brand">
          Privacy
        </Link>
      </p>
    </Shell>
  );
}
