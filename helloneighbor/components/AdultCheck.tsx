'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Notice } from '@/components/ui';
import { CHALLENGE_AGE, type AdultMethod } from '@/lib/adultcheck';

type Progress = {
  status: 'pending' | 'verified' | 'rejected';
  next: AdultMethod | null;
  remaining: number;
  signals: { method: AdultMethod; passed: boolean; detail: string }[];
};

const METHOD_LABEL: Record<AdultMethod, string> = {
  card: 'Card in your name',
  estimation: 'Quick photo check',
  document: 'Photo ID',
  manual: 'Reviewed by our team',
};

/**
 * The parent's side of the adult check.
 *
 * Shown as a two-of-these list rather than a wizard, because the honest shape
 * is "any two of these and you're done" — and a parent who cannot do the
 * selfie should be able to see the alternative without failing something
 * first.
 *
 * The camera frame goes straight to the route and is dropped. Nothing is
 * uploaded to storage, on either side.
 */
export default function AdultCheck() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [consented, setConsented] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // A camera light left on is both a privacy problem and a support ticket.
  useEffect(() => stopCamera, [stopCamera]);

  const load = useCallback(async () => {
    const res = await fetch('/api/parents/adult-check');
    if (!res.ok) return;
    setProgress(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function claimCard() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/parents/adult-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'card' }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? 'Could not check that.');
      return;
    }
    setProgress(body);
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCapturing(true);
    } catch {
      setError('We could not open your camera. Check the permission and try again.');
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth, video.videoHeight) || 480;
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );
    if (!blob) {
      setError('Could not capture that frame. Try again.');
      return;
    }

    stopCamera();
    setCapturing(false);
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append('image', new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
    form.append('consent', 'true');

    const res = await fetch('/api/parents/adult-check', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'The check could not run.');
      return;
    }
    setProgress(body);
  }

  if (!progress) return null;

  if (progress.status === 'verified') {
    return (
      <Notice tone="success">
        You&apos;re verified. Nothing more to do here.
      </Notice>
    );
  }

  if (progress.status === 'rejected') {
    return (
      <Notice tone="error">
        We couldn&apos;t verify this account. Get in touch and a person will look again.
      </Notice>
    );
  }

  const done = (m: AdultMethod) => progress.signals.some((s) => s.method === m && s.passed);
  const tried = (m: AdultMethod) => progress.signals.some((s) => s.method === m);

  return (
    <section className="card">
      <p className="font-bold">Confirm you&apos;re an adult</p>
      <p className="mt-1 text-[13px] text-ink-muted">
        Any two of these and you&apos;re done — {progress.remaining} to go. We do this
        because a parent account can cancel a child&apos;s work and hold the card, so it
        should not be something a stranger can set up.
      </p>

      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        <li className="rounded-btn border border-line px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">{METHOD_LABEL.card}</span>
            {done('card') ? (
              <span className="pill bg-success text-white">done</span>
            ) : (
              <button className="btn-secondary !py-1 text-[13px]" onClick={claimCard} disabled={busy}>
                Check
              </button>
            )}
          </div>
          <p className="mt-1 text-[12px] text-ink-faint">
            You need a card on file for the subscription anyway, and you have to be 18 to
            hold one. Nothing extra is charged for this.
          </p>
        </li>

        <li className="rounded-btn border border-line px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">{METHOD_LABEL.estimation}</span>
            {done('estimation') ? (
              <span className="pill bg-success text-white">done</span>
            ) : capturing ? null : (
              <button
                className="btn-secondary !py-1 text-[13px]"
                onClick={consented ? startCamera : () => setConsented(true)}
                disabled={busy}
              >
                {consented ? 'Open camera' : 'Start'}
              </button>
            )}
          </div>

          {!done('estimation') && !consented && (
            <p className="mt-1 text-[12px] text-ink-faint">
              A photo, checked on the spot and then thrown away. We keep the answer, never
              the picture — no image, scan or face template is stored anywhere.
            </p>
          )}

          {!done('estimation') && consented && !capturing && (
            <p className="mt-1 text-[12px] text-ink-faint">
              By opening the camera you agree to the photo being sent to our age-check
              provider and immediately discarded. It reads about {CHALLENGE_AGE} and over
              reliably; younger than that just means we ask for something else.
            </p>
          )}

          {capturing && (
            <div className="mt-2">
              <video ref={videoRef} playsInline muted className="w-full rounded-btn" />
              <div className="mt-2 flex gap-2">
                <button className="btn-primary flex-1" onClick={capture} disabled={busy}>
                  Take the photo
                </button>
                <button
                  className="btn-secondary flex-1"
                  onClick={() => {
                    stopCamera();
                    setCapturing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {tried('estimation') && !done('estimation') && !capturing && (
            <p className="mt-1 text-[12px] text-ink-faint">
              That one didn&apos;t settle it — which is common and says nothing about you.
              Use the card, or ask us to look.
            </p>
          )}
        </li>

        <li className="rounded-btn border border-line px-3 py-2 opacity-70">
          <span className="text-[13px] font-semibold">{METHOD_LABEL.manual}</span>
          <p className="mt-1 text-[12px] text-ink-faint">
            If neither works, email us and a person will sort it out. You will not be
            locked out by a machine.
          </p>
        </li>
      </ul>
    </section>
  );
}
