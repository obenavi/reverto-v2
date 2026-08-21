'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Calls a route handler, surfaces its error message, and refreshes the server
 * component tree so the panel re-renders with fresh data.
 */
export function useMutate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mutate(
    url: string,
    options: { method: string; body?: unknown }
  ): Promise<boolean> {
    setBusy(true);
    setError(null);

    const res = await fetch(url, {
      method: options.method,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Something went wrong.');
      return false;
    }

    router.refresh();
    return true;
  }

  return { mutate, busy, error, setError };
}
