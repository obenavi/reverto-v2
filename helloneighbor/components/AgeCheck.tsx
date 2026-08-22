'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Notice } from '@/components/ui';

type Stage = 'intro' | 'consented' | 'capturing' | 'sending' | 'done';

/**
 * The face check.
 *
 * Consent is a separate, explicit step before the camera is ever requested —
 * BIPA wants notice and agreement before capture, not implied by submitting.
 * The frame is captured to a canvas, posted, and dropped; nothing is written
 * to storage on either side.
 */
export default function AgeCheck({
  alreadyConsented,
  status,
}: {
  alreadyConsented: boolean;
  status: string | null;
}) {
  const [stage, setStage] = useState<Stage>(alreadyConsented ? 'consented' : 'intro');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Release the camera on unmount — a live indicator light left on is both a
  // privacy problem and a support ticket.
  useEffect(() => stopCamera, [stopCamera]);

  async function consent() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/age-verification/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accepted: true }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not record your agreement.');
      return;
    }
    setStage('consented');
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
      setStage('capturing');
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
    setStage('sending');
    setBusy(true);

    const form = new FormData();
    form.append('image', new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));

    const res = await fetch('/api/age-verification', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? 'The check could not run.');
      setStage('consented');
      return;
    }
    setResult({ status: body.status, message: body.message });
    setStage('done');
  }

  if (status === 'passed') {
    return <Notice tone="success">Your age has been checked. Nothing more to do.</Notice>;
  }

  if (stage === 'done' && result) {
    return (
      <Notice
        tone={
          result.status === 'passed' ? 'success' : result.status === 'failed' ? 'error' : 'warn'
        }
      >
        {result.message}
      </Notice>
    );
  }

  return (
    <div className="card">
      <p className="font-bold">Age check</p>

      {stage === 'intro' && (
        <>
          <p className="mt-1 text-[13px] text-ink-muted">
            We use a quick photo to check that your age is roughly what you told us. It
            keeps adults from posing as teenagers, and the other way round.
          </p>

          <ul className="mt-3 space-y-1 text-[13px] text-ink-muted">
            <li>
              <strong className="text-ink">Your photo is not saved.</strong> It goes
              straight to the age-checking service, and we keep only the estimated number
              — never the picture, never a faceprint.
            </li>
            <li>
              <strong className="text-ink">It is an estimate, not a verdict.</strong> If it
              disagrees with what you typed, a person looks — you are not locked out by a
              machine.
            </li>
            <li>
              <strong className="text-ink">You can skip it.</strong> Your application then
              goes to a person to review instead, which takes longer.
            </li>
          </ul>

          {error && (
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
          )}

          <button className="btn-primary mt-3 w-full" onClick={consent} disabled={busy}>
            {busy ? 'Saving…' : 'I agree — run the check'}
          </button>
        </>
      )}

      {stage === 'consented' && (
        <>
          <p className="mt-1 text-[13px] text-ink-muted">
            Find good light and look straight at the camera.
          </p>
          {error && (
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
          <button className="btn-primary mt-3 w-full" onClick={startCamera}>
            Open camera
          </button>
        </>
      )}

      {stage === 'capturing' && (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            className="mt-3 aspect-square w-full rounded-card bg-black object-cover"
          />
          <div className="mt-3 flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                stopCamera();
                setStage('consented');
              }}
            >
              Cancel
            </button>
            <button className="btn-primary flex-1" onClick={capture}>
              Take photo
            </button>
          </div>
        </>
      )}

      {stage === 'sending' && <p className="mt-3 text-ink-muted">Checking…</p>}
    </div>
  );
}
