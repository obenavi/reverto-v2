import type { PaymentMethod, ServiceKind } from './types';

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

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; note: string }[] = [
  { value: 'stripe', label: 'Card', note: 'Held now, charged after the job' },
  { value: 'cash', label: 'Cash', note: 'Pay in person' },
  { value: 'venmo', label: 'Venmo', note: 'Pay in person' },
  { value: 'cashapp', label: 'Cash App', note: 'Pay in person' },
  { value: 'zelle', label: 'Zelle', note: 'Pay in person' },
];

export function paymentLabel(value: PaymentMethod): string {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}
