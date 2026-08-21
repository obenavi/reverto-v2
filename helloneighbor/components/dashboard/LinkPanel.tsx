'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@/components/ui';

export default function LinkPanel({ operatorId }: { operatorId: string }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  // window isn't available during the server render.
  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin);
  }, []);

  const url = `${origin}/b/${operatorId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="font-bold">Your booking link</p>
        <p className="mt-1 text-ink-muted">
          Anyone with this link can see your services and book a time. No account needed.
        </p>

        <div className="mt-3 break-all rounded-btn bg-gray-50 px-3 py-2 font-mono text-[13px]">
          {origin ? url : 'Loading…'}
        </div>

        <div className="mt-3 flex gap-2">
          <button className="btn-primary flex-1" onClick={copy} disabled={!origin}>
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <a className="btn-secondary" href={url} target="_blank" rel="noreferrer">
            Preview
          </a>
        </div>
      </div>

      <Notice tone="info">
        Put it in your neighborhood group chat, on a flyer, or in your school directory.
      </Notice>
    </div>
  );
}
