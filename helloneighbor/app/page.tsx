import Link from 'next/link';
import { SERVICE_KINDS } from '@/lib/catalog';
import { Shell } from '@/components/ui';
import { Logo } from '@/components/Logo';

const STEPS = [
  { n: 1, title: 'Sign up', body: 'Tell us your name, your neighborhood, and what you can do.' },
  { n: 2, title: 'Get approved', body: 'A grown-up on our team reviews every application.' },
  { n: 3, title: 'Share your link', body: 'Neighbors book you directly. You keep every dollar.' },
];

export default function LandingPage() {
  return (
    <>
      <nav className="band">
        <Shell className="flex items-center justify-between !py-3">
          <Logo />
          <div className="flex gap-4">
            <Link href="/parent/login" className="text-[13px] font-semibold text-ink-muted">
              Parent login
            </Link>
            <Link href="/login" className="text-[13px] font-semibold text-brand">
              Operator login
            </Link>
          </div>
        </Shell>
      </nav>

      <Shell>
        <section className="py-8 text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            The neighborhood runs on kids with a hustle.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-ink-muted">
            Trash cans, car washes, dog walks, tutoring, yard work. Set your prices,
            share one link, get booked.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/join" className="btn-primary">
              Start my business
            </Link>
            <Link href="/login" className="btn-secondary">
              I already have an account
            </Link>
            <Link href="/parent/signup" className="btn-secondary">
              I&apos;m a parent
            </Link>
          </div>
        </section>

        <section className="mt-4">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
            What people book
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SERVICE_KINDS.filter((s) => s.kind !== 'other').map((s) => (
              <li key={s.kind} className="card flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  {s.emoji}
                </span>
                <span className="font-semibold">{s.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
            How it works
          </h2>
          <ol className="space-y-2">
            {STEPS.map((step) => (
              <li key={step.n} className="card flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-light font-bold text-brand">
                  {step.n}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 rounded-card bg-brand-light p-6 text-center">
          <h2 className="text-xl font-extrabold text-brand-dark">Ready when you are.</h2>
          <p className="mt-1 text-ink-muted">Takes about two minutes to sign up.</p>
          <Link href="/join" className="btn-primary mt-4">
            Start my business
          </Link>
        </section>

        <footer className="mt-10 flex justify-center gap-4 border-t border-line pt-4 text-center text-[13px] text-ink-faint">
          <Link href="/guidelines" className="hover:text-ink-muted">
            Guidelines
          </Link>
          <Link href="/safety" className="hover:text-ink-muted">
            Safety
          </Link>
          <Link href="/privacy" className="hover:text-ink-muted">
            Privacy
          </Link>
          <Link href="/my-bookings" className="hover:text-ink-muted">
            Find my booking
          </Link>
        </footer>
      </Shell>
    </>
  );
}
