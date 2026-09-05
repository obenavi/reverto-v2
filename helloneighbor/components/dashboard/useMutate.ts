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

  /**
   * Resolves to the response body on success and null on failure, so a caller
   * that needs something back — a listing that saved but is not live yet, say —
   * can read it. Callers that only care whether it worked can still treat the
   * result as truthy.
   */
  async function mutate<T = Record<string, unknown>>(
    url: string,
    options: { method: string; body?: unknown }
  ): Promise<T | null> {
    setBusy(true);
    setError(null);

    const res = await fetch(url, {
      method: options.method,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    setBusy(false);

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? 'Something went wrong.');
      return null;
    }

    router.refresh();
    return body as T;
  }

  return { mutate, busy, error, setError };
}
