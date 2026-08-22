'use client';

import { useEffect } from 'react';
import { Shell } from '@/components/ui';

/**
 * Catches a render or data error anywhere in the tree so a user sees a page
 * rather than a stack trace. Next.js already strips the message in production;
 * the digest is what maps to the server log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] unhandled error', error);
  }, [error]);

  return (
    <Shell>
      <div className="card mt-10 text-center">
        <p className="text-4xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="mt-2 text-2xl font-extrabold">Something broke</h1>
        <p className="mt-2 text-ink-muted">
          That&apos;s on us, not you. Try again — if it keeps happening, let us know at
          safety@helloneighbor.app.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[12px] text-ink-faint">Ref: {error.digest}</p>
        )}
        <button onClick={reset} className="btn-primary mt-5">
          Try again
        </button>
      </div>
    </Shell>
  );
}
