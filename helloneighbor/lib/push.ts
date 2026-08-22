import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

/**
 * Web push. Works on installed PWAs including iOS 16.4+, which is what makes
 * the app feel native without a store build — and is a real capability rather
 * than a webview shell, which matters for App Store Guideline 4.2.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:safety@helloneighbor.app';

  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

type Target = { operatorId?: string; conversationId?: string };

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Sends to every subscription registered for a target. Subscriptions the push
 * service rejects with 404/410 are gone for good and are deleted — otherwise
 * dead endpoints accumulate forever and every send gets slower.
 */
export async function sendPush(target: Target, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) {
    console.info('[push:unconfigured]', payload.title);
    return 0;
  }

  const db = supabaseAdmin();
  let query = db.from('push_subscriptions').select('id, endpoint, p256dh, auth');

  if (target.operatorId) query = query.eq('operator_id', target.operatorId);
  else if (target.conversationId) query = query.eq('conversation_id', target.conversationId);
  else return 0;

  const { data: subscriptions, error } = await query;
  if (error) {
    console.error('[push] could not load subscriptions', error);
    return 0;
  }
  if (!subscriptions?.length) return 0;

  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(sub.id);
        } else {
          console.error('[push] send failed', status, err);
        }
      }
    })
  );

  if (dead.length > 0) {
    await db.from('push_subscriptions').delete().in('id', dead);
  }

  return sent;
}

export const pushTemplates = {
  newBooking: (clientName: string, serviceTitle: string, when: string): PushPayload => ({
    title: 'New booking',
    body: `${clientName} booked ${serviceTitle} for ${when}.`,
    url: '/dashboard',
    tag: 'booking',
  }),

  newMessage: (from: string, preview: string, url: string): PushPayload => ({
    title: `Message from ${from}`,
    body: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview,
    url,
    tag: 'message',
  }),

  bookingCancelled: (serviceTitle: string, when: string, url: string): PushPayload => ({
    title: 'Booking cancelled',
    body: `${serviceTitle} on ${when} was cancelled.`,
    url,
    tag: 'booking',
  }),
};
