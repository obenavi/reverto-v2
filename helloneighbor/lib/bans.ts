/**
 * Enforcing an action once it has been decided.
 *
 * A ban that only removes a listing is not a ban — the same person signs up
 * again on Tuesday. So the check runs at the two doors: signing up as a
 * provider, and making a booking as a customer.
 *
 * Keyed on the phone number because that is the only identifier a customer
 * has. It is not proof against someone determined to get a new number, and it
 * is not meant to be; it is meant to make coming back a deliberate act rather
 * than a click.
 */
import { supabaseAdmin } from './supabase';
import { blockedMessage, isCurrentlyBlocked, type ActionRow } from './enforcement';

export type BanCheck = { blocked: boolean; message: string };

const CLEAR: BanCheck = { blocked: false, message: '' };

async function checkRows(
  column: 'phone' | 'subscriber_id',
  value: string
): Promise<BanCheck> {
  const { data, error } = await supabaseAdmin()
    .from('enforcement_actions')
    .select('action, created_at, expires_at')
    .eq(column, value)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // Fail open, and loudly. A database hiccup must not lock out every
    // legitimate user — the cost of that is far higher than one banned person
    // getting through one booking.
    console.error('[bans] could not read actions', error);
    return CLEAR;
  }

  const verdict = isCurrentlyBlocked((data ?? []) as ActionRow[]);
  return verdict.blocked
    ? { blocked: true, message: blockedMessage(verdict.reason) }
    : CLEAR;
}

/** Is this phone number barred from signing up or booking? */
export async function phoneIsBanned(phone: string): Promise<BanCheck> {
  if (!phone) return CLEAR;
  return checkRows('phone', phone);
}

/** Is this account suspended or banned? */
export async function subscriberIsBanned(subscriberId: string): Promise<BanCheck> {
  if (!subscriberId) return CLEAR;
  return checkRows('subscriber_id', subscriberId);
}
