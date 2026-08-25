import Link from 'next/link';
import { Shell } from '@/components/ui';
import {
  ALL_AGREEMENTS,
  DISPUTE_STEPS,
  LAUNCH_JURISDICTION,
  LIABILITY_VERSION,
} from '@/lib/liability';

export const metadata = {
  title: 'Terms · HelloNeighbor',
  description:
    'What HelloNeighbor is responsible for, what it is not, and what happens when something goes wrong.',
};

export default function TermsPage() {
  return (
    <Shell>
      <article className="space-y-8 pb-10">
        <header>
          <h1 className="text-2xl font-bold">Terms</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Version {LIABILITY_VERSION}. Everyone accepts the General Terms. Depending on
            what you do here you also accept one of the role agreements below, and the
            addendum for your state. The{' '}
            <Link href="/guidelines" className="font-semibold text-brand">
              community guidelines
            </Link>{' '}
            are separate — they are how to behave here; this is who is responsible for
            what.
          </p>
        </header>

        <div className="card border-warning bg-warning-light">
          <p className="text-[13px] font-semibold">The short version</p>
          <p className="mt-1 text-[13px]">
            HelloNeighbor lists people and books times. It does not employ anyone,
            supervise any work, run criminal background checks, or carry insurance for
            anyone. If something goes wrong between you and the person you booked, we
            decide only how the money for that booking is settled — and you keep every
            right you have to take it further yourself. Where your local law gives you a
            right we cannot take away, that law wins over anything written here.
          </p>
        </div>

        <nav className="card">
          <p className="text-[13px] font-semibold">What is in here</p>
          <ul className="mt-2 space-y-3">
            {ALL_AGREEMENTS.map((doc) => (
              <li key={doc.id}>
                <a href={`#${doc.id}`} className="text-[13px] font-semibold text-brand">
                  {doc.title}
                </a>
                <span className="block text-[12px] text-ink-faint">{doc.audience}</span>
              </li>
            ))}
          </ul>
        </nav>

        {ALL_AGREEMENTS.map((doc) => (
          <section key={doc.id} id={doc.id} className="scroll-mt-4 space-y-4">
            <div className="border-b border-line pb-3">
              <h2 className="text-xl font-bold">{doc.title}</h2>
              <p className="mt-1 text-[13px] font-semibold text-ink-muted">
                {doc.audience}
              </p>
              <p className="mt-2 text-[13px] text-ink-muted">{doc.preamble}</p>
            </div>

            {doc.clauses.map((clause) => (
              <div key={clause.n} id={`${doc.id}-${clause.n}`} className="scroll-mt-4">
                <h3 className="text-[15px] font-bold">
                  {clause.n}. {clause.title}
                </h3>
                {/* Conspicuousness is part of enforceability: a term a court
                    finds buried binds nobody. */}
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
              </div>
            ))}
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
          HelloNeighbor currently operates in {LAUNCH_JURISDICTION} only. Other states and
          countries are enabled one at a time, each with its own addendum, and a service
          being available here says nothing about anywhere else. If someone is hurt or in
          danger, call emergency services — reporting it here is not a substitute and we
          are not an emergency service.
        </p>
      </article>
    </Shell>
  );
}
