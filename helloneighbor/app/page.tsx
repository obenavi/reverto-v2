import Link from 'next/link';
import { SERVICE_KINDS } from '@/lib/catalog';
import { formatPrice } from '@/lib/format';
import { PLATFORM_CURFEW_MINUTES, formatCurfew } from '@/lib/curfew';
import { MINIMUM_AGE } from '@/lib/ages';
import { Shell } from '@/components/ui';
import { Logo, LogoMark } from '@/components/Logo';

const STEPS = [
  {
    n: 1,
    title: 'Sign up',
    body: 'Tell us your name, your neighborhood, and what you can do.',
    tone: 'bg-brand-light text-brand',
  },
  {
    n: 2,
    title: 'Get approved',
    body: 'A grown-up on our team reviews every application before it goes live.',
    tone: 'bg-violet-light text-violet',
  },
  {
    n: 3,
    title: 'Share your link',
    body: 'Neighbors book you directly. You keep every dollar they pay.',
    tone: 'bg-success-light text-success',
  },
];

/**
 * Three facts, not three slogans.
 *
 * Every one of these is something the product actually enforces somewhere in
 * the codebase — the money never touches us, an admin reviews every account,
 * and the curfew is a hard cap on when a job may END. Putting a claim on the
 * front page that the code does not back up is the one thing here that would
 * cost more than it earns.
 */
const PROOF = [
  { value: '100%', label: 'Yours to keep' },
  { value: 'Every one', label: 'Adult-reviewed' },
  { value: formatCurfew(PLATFORM_CURFEW_MINUTES), label: 'Under-18 curfew' },
];

const SAFEGUARDS = [
  {
    emoji: '👀',
    title: 'A person reviews everyone',
    body: 'Every application is read by a real admin before it can take a booking.',
    tone: 'bg-teal-light text-teal',
  },
  {
    emoji: '👪',
    title: 'Parents are in the loop',
    body: 'Under 18 means an adult is on the account, sees the bookings, and sets the curfew.',
    tone: 'bg-violet-light text-violet',
  },
  {
    emoji: '🏘️',
    title: 'Neighborhood groups',
    body: 'Join the group for your street, so the person at the door is someone the block already knows.',
    tone: 'bg-berry-light text-berry',
  },
];

export default function LandingPage() {
  return (
    <>
      <nav className="band sticky top-0 z-10">
        <Shell className="flex items-center justify-between !py-3">
          <Logo />
          <div className="flex gap-4">
            <Link href="/parent/login" className="text-[13px] font-semibold text-ink-muted">
              Parent login
            </Link>
            <Link href="/login" className="text-[13px] font-semibold text-brand">
              Log in
            </Link>
          </div>
        </Shell>
      </nav>

      <section className="hero">
        <Shell className="!py-12 text-center">
          <span className="pill mb-4 bg-white px-3 py-1 text-brand-dark">
            🏘️ Now open to {MINIMUM_AGE} and up
          </span>
          <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-tight sm:text-[42px]">
            The neighborhood runs on
            <br />
            <span className="text-mint">kids with a hustle.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-white/85">
            Trash cans, car washes, dog walks, tutoring, yard work. Set your prices,
            share one link, get booked by the people on your street.
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/join" className="btn bg-white text-brand-dark hover:bg-brand-light">
              Start my business →
            </Link>
            <Link
              href="/parent/signup"
              className="btn border border-white/40 text-white hover:bg-white/10"
            >
              I&apos;m a parent
            </Link>
          </div>

          <ul className="mt-10 grid grid-cols-3 gap-3 border-t border-white/20 pt-6">
            {PROOF.map((p) => (
              <li key={p.label}>
                <p className="stat-value text-mint">{p.value}</p>
                <p className="stat-label text-white/85">{p.label}</p>
              </li>
            ))}
          </ul>
        </Shell>
      </section>

      <Shell>
        <section className="mt-8">
          <h2 className="section-label">What people book</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SERVICE_KINDS.filter((s) => s.kind !== 'other').map((s) => (
              <li
                key={s.kind}
                className="card card-lift flex items-stretch gap-3 overflow-hidden !p-0"
              >
                <span className={`w-1.5 shrink-0 ${s.tone.bar}`} aria-hidden />
                <span className={`tile-icon my-3 self-center ${s.tone.chip}`} aria-hidden>
                  {s.emoji}
                </span>
                <span className="min-w-0 py-3 pr-3">
                  <span className="block font-bold">{s.label}</span>
                  <span className="block text-[13px] text-ink-muted">
                    Usually{' '}
                    <span className={`font-bold ${s.tone.text}`}>
                      {formatPrice(s.defaultPriceCents)}
                    </span>{' '}
                    · {s.defaultDurationMin} min
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-ink-faint">
            Those are the starting prices we suggest. Everyone sets their own.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="section-label">How it works</h2>
          <ol className="space-y-2">
            {STEPS.map((step) => (
              <li key={step.n} className="card flex gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${step.tone}`}
                >
                  {step.n}
                </span>
                <div>
                  <p className="font-bold">{step.title}</p>
                  <p className="text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The other half of the audience. Someone who lands here wanting to
            hire, rather than to work, needs to know how they get to a provider
            — and the honest answer is a link from a neighbor, not a search. */}
        <section className="mt-10">
          <h2 className="section-label">Booking someone?</h2>
          <div className="card border-brand-light bg-brand-light">
            <p className="font-bold text-brand-dark">
              Providers share a booking link. That link is the whole thing.
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Pick a service, pick a time, and pay them however you already pay people —
              cash, Venmo, Cash App, Zelle, PayPal. The money goes straight to them. We
              never hold it, so there is nothing extra on top, and nothing of yours
              sitting with us.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/my-bookings" className="btn-primary">
                Find my booking
              </Link>
              <Link href="/safety" className="btn-secondary">
                How safety works
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="section-label">Nobody is on their own here</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SAFEGUARDS.map((item) => (
              <li key={item.title} className="card">
                <span className={`tile-icon ${item.tone}`} aria-hidden>
                  {item.emoji}
                </span>
                <p className="mt-2 font-bold">{item.title}</p>
                <p className="text-[13px] text-ink-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="hero mt-10 rounded-card">
          <div className="p-8 text-center">
            <LogoMark size={40} tone="mono" className="mx-auto mb-3" label={null} />
            <h2 className="text-2xl font-extrabold tracking-tight">Ready when you are.</h2>
            <p className="mt-1 text-white/85">Takes about two minutes to sign up.</p>
            <Link
              href="/join"
              className="btn mt-5 bg-white text-brand-dark hover:bg-brand-light"
            >
              Start my business →
            </Link>
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-line pt-4 text-center text-[13px] text-ink-faint">
          <Link href="/guidelines" className="hover:text-brand">
            Guidelines
          </Link>
          <Link href="/safety" className="hover:text-brand">
            Safety
          </Link>
          <Link href="/terms" className="hover:text-brand">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-brand">
            Privacy
          </Link>
          <Link href="/my-bookings" className="hover:text-brand">
            Find my booking
          </Link>
        </footer>
      </Shell>
    </>
  );
}
