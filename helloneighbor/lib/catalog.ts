import type { PaymentMethod, PaymentTiming, ServiceKind } from './types';

/** The service types the prototype shipped with, used for icons and defaults. */
export const SERVICE_KINDS: {
  kind: ServiceKind;
  label: string;
  emoji: string;
  defaultPriceCents: number;
  defaultDurationMin: number;
}[] = [
  { kind: 'trash', label: 'Trash cans', emoji: '🗑️', defaultPriceCents: 1000, defaultDurationMin: 15 },
  { kind: 'car', label: 'Car wash', emoji: '🚗', defaultPriceCents: 2500, defaultDurationMin: 60 },
  { kind: 'dog', label: 'Dog walking', emoji: '🐕', defaultPriceCents: 1500, defaultDurationMin: 30 },
  { kind: 'tutor', label: 'Tutoring', emoji: '📚', defaultPriceCents: 2000, defaultDurationMin: 60 },
  { kind: 'lawn', label: 'Lawn care', emoji: '🌱', defaultPriceCents: 3000, defaultDurationMin: 60 },
  { kind: 'other', label: 'Something else', emoji: '✨', defaultPriceCents: 1500, defaultDurationMin: 30 },
];

export function serviceKind(kind: ServiceKind) {
  // Falls through to 'other' for anything unknown, including 'baby' listings
  // that predate the babysitting ban.
  return SERVICE_KINDS.find((s) => s.kind === kind) ?? SERVICE_KINDS[SERVICE_KINDS.length - 1];
}

/**
 * Every method the schema knows about, including ones not currently offered.
 * Used for labelling existing bookings.
 */
export const ALL_PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  note: string;
  handle: boolean;
}[] = [
  { value: 'cash', label: 'Cash', note: 'Hand it over in person', handle: false },
  { value: 'venmo', label: 'Venmo', note: 'Send to their handle', handle: true },
  { value: 'cashapp', label: 'Cash App', note: 'Send to their $cashtag', handle: true },
  { value: 'zelle', label: 'Zelle', note: 'Send to their phone or email', handle: true },
  { value: 'paypal', label: 'PayPal', note: 'Send to their PayPal', handle: true },
  { value: 'stripe', label: 'Card', note: 'Held now, charged after the job', handle: false },
];

/**
 * What an operator can actually offer today. Card payments are off while the
 * Stripe Connect question — operators are minors, and Connect requires account
 * holders to be 18+ — is unresolved. The code path stays in the repo; putting
 * 'stripe' back in this list re-enables it.
 */
export const PAYMENT_METHODS = ALL_PAYMENT_METHODS.filter((m) => m.value !== 'stripe');

/** Methods that need a handle or address before a neighbor can pay. */
export const HANDLE_METHODS = PAYMENT_METHODS.filter((m) => m.handle).map((m) => m.value);

export function paymentLabel(value: PaymentMethod): string {
  return ALL_PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export function paymentNote(value: PaymentMethod): string {
  return ALL_PAYMENT_METHODS.find((p) => p.value === value)?.note ?? '';
}

export const PAYMENT_TIMINGS: { value: PaymentTiming; label: string; note: string }[] = [
  {
    value: 'advance',
    label: 'Pay in advance',
    note: 'Send it now, before the job',
  },
  {
    value: 'on_completion',
    label: 'Pay when it is done',
    note: 'Settle up at the end',
  },
];

export function timingLabel(value: PaymentTiming): string {
  return PAYMENT_TIMINGS.find((t) => t.value === value)?.label ?? value;
}
