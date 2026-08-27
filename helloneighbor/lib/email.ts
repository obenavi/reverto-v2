/**
 * Transactional email, via Resend.
 *
 * Written against the HTTP API rather than an SDK so there is no extra
 * dependency, and it degrades the same way SMS does: with no API key the
 * message is logged instead of thrown, so the rest of a signup still completes
 * in local development.
 */

const ENDPOINT = 'https://api.resend.com/emails';

type EmailResult = { sent: boolean; reason?: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.info(`[email:unconfigured] to=${args.to} subject=${args.subject}\n${args.text}`);
    return { sent: false, reason: 'email_not_configured' };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        html: args.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[email:failed]', res.status, detail);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[email:threw]', err);
    return { sent: false, reason: err instanceof Error ? err.message : 'unknown' };
  }
}

/** Basic escaping — every value below is user-supplied. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function guardianConsentEmail(args: {
  operatorName: string;
  operatorAge: number;
  area: string;
  consentUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `${args.operatorName} needs your permission to use HelloNeighbor`;

  const text = `${args.operatorName} (age ${args.operatorAge}, in ${args.area}) signed up for HelloNeighbor and listed you as their parent or guardian.

HelloNeighbor is a neighborhood app where young people take small local jobs — trash cans, car washes, dog walking, tutoring, yard work. Babysitting and other care work are not allowed.

Nothing on their account goes live until you approve it:

${args.consentUrl}

That link is unique to this request. If you were not expecting this email, you can ignore it — without your approval the account stays on hold and is never visible to anyone.

Questions: safety@helloneighbor.app`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 16px">Permission needed</h1>
  <p style="color:#4b5563"><strong>${esc(args.operatorName)}</strong> (age ${args.operatorAge}, in ${esc(args.area)}) signed up for HelloNeighbor and listed you as their parent or guardian.</p>
  <p style="color:#4b5563">HelloNeighbor is a neighborhood app where young people take small local jobs — trash cans, car washes, dog walking, tutoring, yard work. Babysitting and other care work are not allowed.</p>
  <p style="color:#4b5563">Nothing on their account goes live until you approve it.</p>
  <p style="margin:24px 0"><a href="${esc(args.consentUrl)}" style="background:#1565C0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">Review and give permission</a></p>
  <p style="color:#6b7280;font-size:13px">That link is unique to this request. If you were not expecting this email you can ignore it — without your approval the account stays on hold and is never visible to anyone.</p>
  <p style="color:#6b7280;font-size:13px">Questions: <a href="mailto:safety@helloneighbor.app" style="color:#1565C0">safety@helloneighbor.app</a></p>
</body></html>`;

  return { subject, text, html };
}

/**
 * Sent when a guardian is being asked to settle an age the face check could
 * not. Deliberately different copy from the routine consent email: this one
 * leads with the age question, because that is what is being asked.
 */
export function guardianAgeCheckEmail(args: {
  operatorName: string;
  operatorAge: number;
  area: string;
  consentUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `Please confirm ${args.operatorName}'s age on HelloNeighbor`;

  const text = `${args.operatorName}, in ${args.area}, signed up for HelloNeighbor and told us they are ${args.operatorAge}.

Our automatic age check could not confirm that, so we are asking you instead.

HelloNeighbor is a neighborhood app where young people take small local jobs — trash cans, car washes, dog walking, tutoring, yard work. Babysitting and other care work are not allowed.

To confirm their age and give permission:

${args.consentUrl}

You will be asked to confirm that you are their legal guardian and that you take responsibility for their activity in the app. Their account stays on hold until you do.

If you were not expecting this email, ignore it — the account will not go live.

Questions: safety@helloneighbor.app`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 16px">Please confirm an age</h1>
  <p style="color:#4b5563"><strong>${esc(args.operatorName)}</strong>, in ${esc(args.area)}, signed up for HelloNeighbor and told us they are <strong>${args.operatorAge}</strong>.</p>
  <p style="color:#4b5563">Our automatic age check could not confirm that, so we are asking you instead.</p>
  <p style="color:#4b5563">HelloNeighbor is a neighborhood app where young people take small local jobs — trash cans, car washes, dog walking, tutoring, yard work. Babysitting and other care work are not allowed.</p>
  <p style="margin:24px 0"><a href="${esc(args.consentUrl)}" style="background:#1565C0;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">Confirm their age and give permission</a></p>
  <p style="color:#6b7280;font-size:13px">You will be asked to confirm that you are their legal guardian and that you take responsibility for their activity in the app. Their account stays on hold until you do.</p>
  <p style="color:#6b7280;font-size:13px">If you were not expecting this email, ignore it — the account will not go live.</p>
  <p style="color:#6b7280;font-size:13px">Questions: <a href="mailto:safety@helloneighbor.app" style="color:#1565C0">safety@helloneighbor.app</a></p>
</body></html>`;

  return { subject, text, html };
}
