/** Shared domain types. These mirror supabase/migrations/001_init_schema.sql. */

export type SubscriberStatus = 'pending' | 'active' | 'suspended' | 'rejected';
export type ServiceKind =
  | 'trash'
  | 'car'
  | 'dog'
  | 'baby'
  | 'tutor'
  | 'lawn'
  | 'other';
export type SlotStatus = 'open' | 'held' | 'booked';
export type PaymentMethod = 'stripe' | 'cash' | 'venmo' | 'cashapp' | 'zelle';
export type PaymentStatus =
  | 'pending'
  | 'held'
  | 'captured'
  | 'released'
  | 'refunded'
  | 'failed';
export type BookingStatus = 'confirmed' | 'completed' | 'cancelled';
export type PingStatus = 'new' | 'answered' | 'dismissed';
export type DisputeStatus = 'open' | 'resolved_operator' | 'resolved_neighbor' | 'closed';

/** An operator — the kid or teen running the little business. */
export interface Subscriber {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  area: string;
  age: number;
  status: SubscriberStatus;
  bio: string | null;
  photo_url: string | null;
  payment_methods: PaymentMethod[];
  approved_at: string | null;
}

export interface Service {
  id: string;
  operator_id: string;
  kind: ServiceKind;
  title: string;
  description: string | null;
  price_cents: number;
  duration_min: number;
  active: boolean;
}

export interface Slot {
  id: string;
  operator_id: string;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
}

export interface Booking {
  id: string;
  created_at: string;
  operator_id: string;
  slot_id: string | null;
  service_id: string | null;
  client_name: string;
  client_phone: string;
  client_address: string | null;
  notes: string | null;
  price_cents: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  status: BookingStatus;
}

export interface Ping {
  id: string;
  created_at: string;
  operator_id: string;
  client_name: string;
  client_phone: string;
  message: string | null;
  requested_for: string | null;
  status: PingStatus;
}

export interface Review {
  id: string;
  created_at: string;
  booking_id: string | null;
  operator_id: string;
  rating: number;
  public_comment: string | null;
  private_comment: string | null;
  operator_reply: string | null;
}

export interface GalleryPhoto {
  id: string;
  operator_id: string;
  url: string;
  caption: string | null;
  sort_order: number;
}

export interface Dispute {
  id: string;
  created_at: string;
  booking_id: string;
  opened_by: 'neighbor' | 'operator';
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_at: string | null;
}

export interface Referral {
  id: string;
  created_at: string;
  referrer_id: string;
  referred_id: string | null;
  code: string;
  status: 'pending' | 'credited';
  credited_at: string | null;
}

export interface Boost {
  id: string;
  operator_id: string;
  starts_at: string;
  ends_at: string;
  amount_cents: number;
  active: boolean;
}

export interface OperatorProfile {
  id: string;
  operator_id: string;
  headline: string | null;
  about: string | null;
  service_radius_mi: number | null;
  response_time_min: number | null;
  payment_handles: Record<string, string>;
}

/** A booking joined with the bits of its service and slot the UI displays. */
export type BookingRow = Booking & {
  services: { title: string; kind: string } | null;
  slots: { starts_at: string; ends_at: string } | null;
};

/** A dispute joined with the booking details the admin screen displays. */
export type DisputeRow = Dispute & {
  bookings: {
    client_name: string;
    price_cents: number;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
  } | null;
};
