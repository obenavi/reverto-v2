'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Cloudflare Turnstile challenge.
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, and the server
 * skips verification in that case too — so the forms keep working in local
 * development and in a half-configured deploy.
 */
export default function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    function render() {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      if (widgetRef.current) return;

      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey!,
        callback: (token) => onToken(token),
        // A token is single-use and short-lived; clear it so a stale one is
        // never submitted.
        'expired-callback': () => onToken(null),
        'error-callback': () => {
          setFailed(true);
          onToken(null);
        },
        theme: 'light',
      });
    }

    if (window.turnstile) {
      render();
    } else if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = render;
      script.onerror = () => setFailed(true);
      document.head.appendChild(script);
    } else {
      // Script is already in flight from another mount — poll briefly for it.
      const timer = setInterval(() => {
        if (window.turnstile) {
          clearInterval(timer);
          render();
        }
      }, 100);
      setTimeout(() => clearInterval(timer), 10_000);
    }

    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [siteKey, onToken]);

  if (!siteKey) return null;

  return (
    <div>
      <div ref={containerRef} />
      {failed && (
        <p className="mt-1 text-[12px] text-danger">
          The human check could not load. Reload the page to try again.
        </p>
      )}
    </div>
  );
}
