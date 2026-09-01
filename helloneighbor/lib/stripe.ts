import Stripe from 'stripe';

/**
 * Server-only Stripe client.
 *
 * This exists for ONE purpose: charging providers their subscription, which is
 * money moving from a user to HelloNeighbor for access to the tools.
 *
 * It must never be used to move money between two users. A neighbour pays the
 * person who did the work directly — cash, Venmo, Cash App, Zelle, PayPal —
 * and HelloNeighbor records what was agreed and nothing else. Taking the
 * customer's money and passing it on is money transmission, which needs a
 * licence in nearly every state plus FinCEN registration, and there is no
 * version of this product that is worth that.
 *
 * tests/no-customer-payments.test.mjs enforces the rule, because "we decided
 * not to" is not a control.
 */

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Subscription billing is unavailable.');
  }

  client = new Stripe(key, { apiVersion: '2024-06-20' });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
