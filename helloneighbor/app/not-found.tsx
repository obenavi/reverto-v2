import Link from 'next/link';
import { Shell } from '@/components/ui';

export default function NotFound() {
  return (
    <Shell>
      <div className="card mt-10 text-center">
        <p className="text-4xl" aria-hidden>
          🔍
        </p>
        <h1 className="mt-2 text-2xl font-extrabold">Nothing here</h1>
        <p className="mt-2 text-ink-muted">
          This page doesn&apos;t exist, or the link has expired. Booking and conversation
          links stop working after 30 days.
        </p>
        <Link href="/" className="btn-primary mt-5">
          Back home
        </Link>
      </div>
    </Shell>
  );
}
