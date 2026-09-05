import type { PaymentMethod, PaymentTiming, ServiceKind } from './types';

/**
 * The service types the prototype shipped with, used for icons and defaults.
 *
 * Each kind also carries its own colour. A customer scanning a grid of six
 * services should be able to tell them apart before reading any of the labels,
 * and colour does that faster than an emoji alone.
 *
 * The classes are written out in full rather than built from the tone name
 * because Tailwind compiles only the class strings it can literally see —
 * `bg-${tone}-light` would produce no CSS at all.
 */
export type ServiceTone = {
  /** Tinted chip: the icon square on a card, a category pill. */
  chip: string;
  /** Solid fill: a colour stripe down a card, a filled badge. */
  bar: string;
  /** The colour as text, on white. */
  text: string;
  /** Ring shown when a card is hovered or chosen. */
  ring: string;
};

export const SERVICE_KINDS: {
  kind: ServiceKind;
  label: string;
  emoji: string;
  defaultPriceCents: number;
  defaultDurationMin: number;
  tone: ServiceTone;
}[] = [
  {
    kind: 'trash',
    label: 'Trash cans',
    emoji: '🗑️',
    defaultPriceCents: 1000,
    defaultDurationMin: 15,
    tone: {
      chip: 'bg-teal-light text-teal',
      bar: 'bg-teal',
      text: 'text-teal',
      ring: 'hover:border-teal',
    },
  },
  {
    kind: 'car',
    label: 'Car wash',
    emoji: '🚗',
    defaultPriceCents: 2500,
    defaultDurationMin: 60,
    tone: {
      chip: 'bg-brand-light text-brand',
      bar: 'bg-brand',
      text: 'text-brand',
      ring: 'hover:border-brand',
    },
  },
  {
    kind: 'dog',
    label: 'Dog walking',
    emoji: '🐕',
    defaultPriceCents: 1500,
    defaultDurationMin: 30,
    tone: {
      chip: 'bg-berry-light text-berry',
      bar: 'bg-berry',
      text: 'text-berry',
      ring: 'hover:border-berry',
    },
  },
  {
    kind: 'tutor',
    label: 'Tutoring',
    emoji: '📚',
    defaultPriceCents: 2000,
    defaultDurationMin: 60,
    tone: {
      chip: 'bg-violet-light text-violet',
      bar: 'bg-violet',
      text: 'text-violet',
      ring: 'hover:border-violet',
    },
  },
  {
    kind: 'lawn',
    label: 'Lawn care',
    emoji: '🌱',
    defaultPriceCents: 3000,
    defaultDurationMin: 60,
    tone: {
      chip: 'bg-success-light text-success',
      bar: 'bg-success',
      text: 'text-success',
      ring: 'hover:border-success',
    },
  },
  {
    kind: 'other',
    label: 'Something else',
    emoji: '✨',
    defaultPriceCents: 1500,
    defaultDurationMin: 30,
    // Deliberately the neutral: "something else" is the absence of a category,
    // and giving it a hue of its own would say it was one.
    tone: {
      chip: 'bg-mist text-ink-muted',
      bar: 'bg-ink-muted',
      text: 'text-ink-muted',
      ring: 'hover:border-ink-faint',
    },
  },
];

export function serviceKind(kind: ServiceKind) {
  // Falls through to 'other' for anything unknown, including 'baby' listings
  // that predate the babysitting ban.
  return SERVICE_KINDS.find((s) => s.kind === kind) ?? SERVICE_KINDS[SERVICE_KINDS.length - 1];
}

type PaymentMethodInfo = {
  value: PaymentMethod;
  label: string;
  note: string;
  handle: boolean;
};

/**
 * How a neighbour pays the person who did the work.
 *
 * Every one of these is settled directly between the two of them. The app
 * records which one was agreed and, where there is one, shows the handle to
 * send to. It does not hold, move, escrow, or refund a cent of it.
 *
 * That is a deliberate limit, not a missing feature. Passing a customer's
 * money on to a provider is money transmission: a licence in nearly every
 * state, FinCEN registration, surety bonds, and the platform standing between
 * two people as the party that owes the money. A card button is not worth any
 * of that, and it would not reduce the risk that actually matters here, which
 * is a young person going to a stranger's house.
 */
export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  { value: 'cash', label: 'Cash', note: 'Hand it over in person', handle: false },
  { value: 'venmo', label: 'Venmo', note: 'Send to their handle', handle: true },
  { value: 'cashapp', label: 'Cash App', note: 'Send to their $cashtag', handle: true },
  { value: 'zelle', label: 'Zelle', note: 'Send to their phone or email', handle: true },
  { value: 'paypal', label: 'PayPal', note: 'Send to their PayPal', handle: true },
];

/**
 * A provider's own way of being paid, beyond the five the app knows.
 *
 * Free text on purpose. Somebody takes a cheque, a bank transfer, a regional
 * app this codebase has never heard of, or an envelope through the door — and
 * an app that only accepts the methods it shipped with is one that makes those
 * people pick the wrong option and explain it in a message.
 *
 * A label only. It is shown to strangers on a booking page, so it must never
 * carry an account number, and MAX_CUSTOM_METHOD_LENGTH is short enough that
 * one does not fit comfortably.
 */
export const MAX_CUSTOM_METHODS = 3;
export const MAX_CUSTOM_METHOD_LENGTH = 40;

/** Trims, caps and drops the empties. Returns what is safe to store. */
export function cleanCustomMethods(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const label = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM_METHOD_LENGTH);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= MAX_CUSTOM_METHODS) break;
  }
  return out;
}

/**
 * Methods that only exist to put a label on an old row.
 *
 * 'stripe' was a card hold taken by the platform and released to the provider
 * on completion. It was never switched on for customers, and migration 028
 * removed both the column that stored the hold and the value from the
 * bookings check constraint, so the database will not accept one either.
 *
 * The label survives for one case only: a database restored from a dump taken
 * before that migration. Nothing may offer it.
 */
const RETIRED_PAYMENT_METHODS: PaymentMethodInfo[] = [
  { value: 'stripe', label: 'Card (no longer offered)', note: '', handle: false },
  // The provider wrote their own; the wording is on the booking row.
  { value: 'other', label: 'Another way', note: 'However they asked to be paid', handle: false },
];

/**
 * What the customer said they can do, narrowed to what was actually offered.
 *
 * The customer ticks as many as they like at booking — they know which apps
 * they have, and which one gets used is for the two of them at the door. Both
 * lists are filtered against the provider's own, because a form is not
 * entitled to add a method the provider never offered.
 *
 * Custom labels are matched case-insensitively and returned in the PROVIDER's
 * casing, so what lands on the booking is their wording rather than whatever
 * the browser sent.
 */
export function agreedPaymentOptions(args: {
  /** What the customer ticked. */
  methods: unknown;
  customs: unknown;
  /** What the provider offers. */
  offeredMethods: PaymentMethod[];
  offeredCustoms: string[];
}): { methods: PaymentMethod[]; customs: string[] } {
  const wantedMethods = Array.isArray(args.methods) ? args.methods.map(String) : [];
  const wantedCustoms = Array.isArray(args.customs) ? args.customs.map(String) : [];

  const methods = args.offeredMethods.filter((m) => wantedMethods.includes(m));

  const customs = args.offeredCustoms.filter((label) =>
    wantedCustoms.some((wanted) => wanted.trim().toLowerCase() === label.toLowerCase())
  );

  return { methods, customs };
}

/** Every value the schema knows about. For labelling only — never for offering. */
export const ALL_PAYMENT_METHODS: PaymentMethodInfo[] = [
  ...PAYMENT_METHODS,
  ...RETIRED_PAYMENT_METHODS,
];

/** Methods that need a handle or address before a neighbor can pay. */
export const HANDLE_METHODS = PAYMENT_METHODS.filter((m) => m.handle).map((m) => m.value);

export function paymentLabel(value: PaymentMethod): string {
  return ALL_PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export function paymentNote(value: PaymentMethod): string {
  return ALL_PAYMENT_METHODS.find((p) => p.value === value)?.note ?? '';
}

/**
 * When payment is due. There is one answer.
 *
 * Advance payment used to be an option a provider could switch on. It is gone:
 * every marketplace fraud that does not need an escrow account runs through
 * prepayment — take the money, never turn up — and with no money passing
 * through this platform there is nothing to claw back. Paying at the door when
 * the job is done makes that scam worth nothing.
 *
 * The list keeps its shape so a booking written before this can still be
 * labelled, and so that putting a second entry back is a visible diff rather
 * than a one-character change.
 */
export const PAYMENT_TIMINGS: { value: PaymentTiming; label: string; note: string }[] = [
  {
    value: 'on_completion',
    label: 'Pay when it is done',
    note: 'In person, at the end of the job, with you both there',
  },
];

export function timingLabel(value: PaymentTiming): string {
  return PAYMENT_TIMINGS.find((t) => t.value === value)?.label ?? value;
}
