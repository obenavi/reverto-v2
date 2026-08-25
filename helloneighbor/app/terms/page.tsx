import Link from 'next/link';
import { Shell } from '@/components/ui';
import { AGREEMENT, LIABILITY_VERSION, DISPUTE_STEPS } from '@/lib/liability';

export const metadata = {
  title: 'Terms and liability · HelloNeighbor',
  description: 'What HelloNeighbor is responsible for, what it is not, and what happens when something goes wrong.',
};

export default function TermsPage() {
  return (
    <Shell>
      <article className="space-y-6 pb-10">
        <header>
          <h1 className="text-2xl font-bold">Terms and liability</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Version {LIABILITY_VERSION}. This is the agreement you accept when you sign up
            or make a booking. The{' '}
            <Link href="/guidelines" className="font-semibold text-brand">
              community guidelines
            </Link>{' '}
            are separate — they are how to behave here; this is who is responsible for what.
          </p>
        </header>

        <div className="card border-warning bg-warning-light">
          <p className="text-[13px] font-semibold">The short version</p>
          <p className="mt-1 text-[13px]">
            HelloNeighbor lists people and books times. It does not employ anyone, supervise
            any work, run background checks, or carry insurance for anyone. If something goes
            wrong between you and the person you booked, that is between the two of you — we
            decide only how the money for that booking is settled. We do act on accounts when
            someone behaves badly, and you keep every right you have to take it further
            yourself.
          </p>
        </div>

        <nav className="card">
          <p className="text-[13px] font-semibold">What is in here</p>
          <ol className="mt-2 space-y-1">
            {AGREEMENT.map((clause) => (
              <li key={clause.n} className="text-[13px]">
                <a href={`#clause-${clause.n}`} className="text-brand hover:underline">
                  {clause.n}. {clause.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {AGREEMENT.map((clause) => (
          <section key={clause.n} id={`clause-${clause.n}`} className="scroll-mt-4">
            <h2 className="text-[15px] font-bold">
              {clause.n}. {clause.title}
            </h2>
            {/* Conspicuousness is part of enforceability: a term a court finds
                buried is a term that binds nobody. It is also simply the
                honest thing to give a fourteen-year-old and their mother. */}
            <p className="mt-1 border-l-2 border-brand pl-3 text-[14px] font-semibold">
              {clause.plain}
            </p>
            <div className="mt-2 space-y-2">
              {clause.body.map((paragraph, i) => (
                <p key={i} className="text-[14px] leading-relaxed text-ink-muted">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        <section className="card">
          <h2 className="text-[15px] font-bold">What happens when you open a dispute</h2>
          <ol className="mt-2 space-y-2">
            {DISPUTE_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-[14px] text-ink-muted">
                <span className="shrink-0 font-bold text-ink">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="text-[12px] text-ink-faint">
          If someone is hurt or in danger, call emergency services. Reporting it here is not a
          substitute and we are not an emergency service.
        </p>
      </article>
    </Shell>
  );
}
