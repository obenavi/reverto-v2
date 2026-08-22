'use client';

import { useCallback, useEffect, useState } from 'react';
import { Notice } from '@/components/ui';

/** base64url VAPID key -> the Uint8Array the Push API wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type State = 'unsupported' | 'unconfigured' | 'off' | 'on' | 'denied' | 'working';

/**
 * Push opt-in. `token` is present for a neighbor (their conversation link);
 * an operator passes nothing and is identified by their session.
 *
 * On iOS the Push API only exists once the app is installed to the home
 * screen, so this deliberately explains that rather than silently vanishing.
 */
export default function EnableNotifications({ token }: { token?: string }) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [state, setState] = useState<State>('working');
  const [error, setError] = useState<string | null>(null);
  const [installHint, setInstallHint] = useState(false);

  const sync = useCallback(async () => {
    if (!publicKey) return setState('unconfigured');

    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      // iOS exposes PushManager only for an installed PWA.
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
      setInstallHint(iOS && !standalone);
      return setState('unsupported');
    }

    if (Notification.permission === 'denied') return setState('denied');

    const registration = await navigator.serviceWorker.getRegistration();
    const existing = await registration?.pushManager.getSubscription();
    setState(existing ? 'on' : 'off');
  }, [publicKey]);

  useEffect(() => {
    sync();
  }, [sync]);

  async function enable() {
    setState('working');
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey!) as BufferSource,
      });

      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, token }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not turn notifications on.');
        setState('off');
        return;
      }
      setState('on');
    } catch (err) {
      console.error('[push] enable failed', err);
      setError('Could not turn notifications on.');
      setState('off');
    }
  }

  async function disable() {
    setState('working');
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      await fetch(`/api/push?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
        method: 'DELETE',
      });
      await subscription.unsubscribe();
    }
    setState('off');
  }

  if (state === 'unconfigured') return null;

  if (state === 'unsupported') {
    if (!installHint) return null;
    return (
      <Notice tone="info">
        Want alerts for new bookings? Tap Share, then <strong>Add to Home Screen</strong> —
        iPhone only allows notifications once the app is installed.
      </Notice>
    );
  }

  if (state === 'denied') {
    return (
      <Notice tone="warn">
        Notifications are blocked for this site. Turn them back on in your browser
        settings if you want booking alerts.
      </Notice>
    );
  }

  return (
    <div className="card">
      <p className="font-bold">Notifications</p>
      <p className="mt-1 text-[13px] text-ink-muted">
        {state === 'on'
          ? 'On — you will get an alert for new bookings and messages.'
          : 'Get an alert when someone books you or sends a message.'}
      </p>
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <button
        className={state === 'on' ? 'btn-secondary mt-3 w-full' : 'btn-primary mt-3 w-full'}
        disabled={state === 'working'}
        onClick={state === 'on' ? disable : enable}
      >
        {state === 'working' ? 'Working…' : state === 'on' ? 'Turn off' : 'Turn on notifications'}
      </button>
    </div>
  );
}
