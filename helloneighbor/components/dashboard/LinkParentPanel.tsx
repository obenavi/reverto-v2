'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@/components/ui';

/**
 * The code a young person reads out to their parent.
 *
 * Lives in Settings under "Link parent or guardian account", because that is
 * where they will look for it and where the parent-facing screen tells them to
 * look.
 */
export default function LinkParentPanel({ supervision }: { supervision: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/operators/link-code')
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => (ok ? setCode(body.code) : setError(body.error)))
      .catch(() => setError('Could not load your code.'));
  }, []);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const linked = supervision === 'parent_account';

  return (
    <section className="card">
      <p className="font-bold">Link parent or guardian account</p>

      {linked ? (
        <div className="mt-2">
          <Notice tone="success">
            A parent account is linked. They can see your bookings and cancel one if they
            need to — they can&apos;t post or reply as you.
          </Notice>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-ink-muted">
            Give this code to your parent or guardian. They enter it after making their own
            account at <strong>/parent/signup</strong>.
          </p>

          {error && (
            <div className="mt-2">
              <Notice tone="error">{error}</Notice>
            </div>
          )}

          <p className="mt-3 select-all rounded-btn bg-gray-50 px-3 py-3 text-center font-mono text-xl tracking-widest">
            {code ?? '········'}
          </p>

          <button className="btn-primary mt-2 w-full" onClick={copy} disabled={!code}>
            {copied ? 'Copied!' : 'Copy code'}
          </button>

          <p className="mt-2 text-[12px] text-ink-faint">
            Only share it with your own parent or guardian. Whoever enters it can see your
            bookings.
          </p>
        </>
      )}
    </section>
  );
}
