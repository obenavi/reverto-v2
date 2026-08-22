/** Shared domain types. These mirror supabase/migrations/001_init_schema.sql. */

export type SubscriberStatus = 'pending' | 'active' | 'suspended' | 'rejected';
// 'baby' was removed when babysitting was banned; see migration 002.
export type ServiceKind = 'trash' | 'car' | 'dog' | 'tutor' | 'lawn' | 'other';
export type SlotStatus = 'open' | 'held' | 'booked';
// 'stripe' is retained so the card code path still compiles; it is not
// currently offerable — see PAYMENT_METHODS in lib/catalog.ts.
export type PaymentMethod = 'stripe' | 'cash' | 'venmo' | 'cashapp' | 'zelle' | 'paypal';

/** Whether money moves before the job or after it. */
export type PaymentTiming = 'advance' | 'on_completion';
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
  accepted_terms_at: string | null;
  accepted_terms_version: string | null;
  prefers_advance_payment: boolean;
  /** Guardian details, required and populated only for operators under 18. */
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_relationship: string | null;
  guardian_consent_at: string | null;
  guardian_consent_name: string | null;
  guardian_consent_ip: string | null;
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
  payment_timing: PaymentTiming | null;
  stripe_payment_intent_id: string | null;
  status: BookingStatus;
  accepted_terms_at: string | null;
  accepted_terms_version: string | null;
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

export type MessageSender = 'client' | 'operator' | 'system';
export type MessageKind =
  | 'text'
  | 'payment_poll'
  | 'payment_choice'
  | 'timing_poll'
  | 'timing_choice'
  | 'payment_memo'
  | 'system';

export interface Conversation {
  id: string;
  created_at: string;
  booking_id: string;
  operator_id: string;
  client_name: string;
  client_phone: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  created_at: string;
  conversation_id: string;
  sender: MessageSender;
  kind: MessageKind;
  body: string;
  /** payment_poll carries { options: PaymentMethod[] }. */
  metadata: Record<string, unknown>;
  read_at: string | null;
}

export type ModerationVerdict = 'pass' | 'review' | 'block' | 'error';
export type ModerationSubject = 'subscriber' | 'service' | 'booking' | 'message';

export interface ModerationReview {
  id: string;
  created_at: string;
  subject_type: ModerationSubject;
  subject_id: string;
  verdict: ModerationVerdict;
  risk_score: number;
  categories: string[];
  rationale: string | null;
  model: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}
