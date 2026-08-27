'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@/components/ui';
import { PARENT_RELATIONSHIPS } from '@/lib/parentRoles';
import { MINOR_BADGE_LIMIT } from '@/lib/ages';

/**
 * Getting an adult behind a young person's account.
 *
 * Two routes, and they are not presented as equals. A parent account is a
 * living thing — someone who can look in next month, see a booking they are
 * uneasy about, and cancel it. A waiver is one signature and then nobody is
 * watching. The waiver is here because some families will not make a second
 * login, and those kids are better off on an app that knows they are minors
 * than on one that does not. It is offered second, and said plainly.
 */
export default function LinkParentPanel({
  supervision,
  age,
  guardianConsentSentAt,
}: {
  supervision: string;
  age: number;
  guardianConsentSentAt: string | null;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [showWaiver, setShowWaiver] = useState(false);
  const [gName, setGName] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [gRelationship, setGRelationship] = useState<string>(PARENT_RELATIONSHIPS[0].value);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const linked = supervision === 'parent_account';
  const waived = supervision === 'waiver';

  useEffect(() => {
    if (linked) return;
    fetch('/api/operators/link-code')
      .then((res) => res.json().then((body) => ({ ok: res.ok, body })))
      .then(({ ok, body }) => (ok ? setCode(body.code) : setError(body.error)))
      .catch(() => setError('Could not load your code.'));
  }, [linked]);

  // Nobody 18 or over needs either route.
  if (age >= MINOR_BADGE_LIMIT) return null;

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

  async function sendWaiver(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);

    const res = await fetch('/api/operators/waiver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guardian_name: gName,
        guardian_email: gEmail,
        guardian_relationship: gRelationship,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(body.error ?? 'Could not send that.');
      return;
    }
    setSent(true);
  }

  return (
    <section className="card">
      <p className="font-bold">Parent or guardian</p>

      {linked ? (
        <div className="mt-2">
          <Notice tone="success">
            A parent account is linked. They can see your bookings, set how late you can
            work, and cancel a booking if they need to — they can&apos;t post or reply as
            you.
          </Notice>
        </div>
      ) : (
        <>
          {waived ? (
            <div className="mt-2 space-y-2">
              <Notice tone="success">Your guardian signed the waiver. You&apos;re set up.</Notice>
              <p className="text-[13px] text-ink-muted">
                They can still make a parent account any time. It&apos;s the better setup —
                a waiver is a one-time signature, an account means someone can actually
                look in later.
              </p>
            </div>
          ) : (
            <div className="mt-2">
              <Notice tone="warn">
                You&apos;re under 18, so your profile stays offline until an adult is
                behind it. You&apos;re not being charged until then.
              </Notice>
            </div>
          )}

          <p className="mt-3 text-[13px] font-semibold">Recommended: a parent account</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            Give this code to your parent or guardian. They enter it after making their own
            account at <strong>/parent/signup</strong>.
          </p>

          {error && (
            <div className="mt-2">
              <Notice tone="error">{error}</Notice>
            </div>
          )}

          <p className="mt-3 select-all rounded-btn bg-canvas px-3 py-3 text-center font-mono text-xl tracking-widest">
            {code ?? '········'}
          </p>

          <button className="btn-primary mt-2 w-full" onClick={copy} disabled={!code}>
            {copied ? 'Copied!' : 'Copy code'}
          </button>

          <p className="mt-2 text-[12px] text-ink-faint">
            Only share it with your own parent or guardian. Whoever enters it can see your
            bookings.
          </p>

          {!waived && (
            <div className="mt-4 border-t border-line pt-3">
              {sent || guardianConsentSentAt ? (
                <Notice tone="info">
                  We emailed your guardian. Your profile goes live once they open the link
                  and sign — check with them if it&apos;s been a while.
                </Notice>
              ) : showWaiver ? (
                <form className="space-y-3" onSubmit={sendWaiver}>
                  <p className="text-[13px] font-semibold">
                    If they won&apos;t make an account
                  </p>
                  <p className="text-[13px] text-ink-muted">
                    We&apos;ll email them a form to sign instead. We don&apos;t recommend
                    it: they&apos;re still legally responsible for everything you do here,
                    but they won&apos;t be able to see your bookings or step in later.
                  </p>
                  <div>
                    <label htmlFor="gname">Their full name</label>
                    <input
                      id="gname"
                      required
                      value={gName}
                      onChange={(e) => setGName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="gemail">Their email</label>
                    <input
                      id="gemail"
                      type="email"
                      required
                      value={gEmail}
                      onChange={(e) => setGEmail(e.target.value)}
                    />
                    <p className="mt-1 text-[12px] text-ink-faint">
                      Has to be theirs, not yours — they sign it, not you.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="grel">Who they are to you</label>
                    <select
                      id="grel"
                      value={gRelationship}
                      onChange={(e) => setGRelationship(e.target.value)}
                    >
                      {PARENT_RELATIONSHIPS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary flex-1" disabled={sending}>
                      {sending ? 'Sending…' : 'Email the form'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary flex-1"
                      onClick={() => setShowWaiver(false)}
                    >
                      Back
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="text-[13px] underline"
                  onClick={() => setShowWaiver(true)}
                >
                  They won&apos;t make an account — what else can I do?
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
