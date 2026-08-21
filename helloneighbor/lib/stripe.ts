import Stripe from 'stripe';

let client: Stripe | null = null;

/** Server-only Stripe client. Throws if the secret key is missing. */
export function stripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Card payments are unavailable.');
  }

  client = new Stripe(key, { apiVersion: '2024-06-20' });
  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
