import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase';
import { handOverOwnedCommunities } from './succession';

/**
 * Account deletion.
 *
 * Hard-deleting an operator would cascade away bookings, conversations and
 * reviews — taking the *other* party's history with it, and erasing the record
 * a dispute or a report depends on. So deletion scrubs the personal data and
 * keeps the shell: past bookings survive, attributed to a deleted account.
 *
 * The privacy policy promises this, and App Store Guideline 5.1.1(v) requires
 * an in-app path to it for any app that supports account creation.
 */
export async function deleteAccount(
  subscriberId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();

  const { data: subscriber } = await db
    .from('subscribers')
    .select('id, status')
    .eq('id', subscriberId)
    .maybeSingle();

  if (!subscriber) return { ok: false, error: 'Account not found.' };
  if (subscriber.status === 'deleted') return { ok: true };

  // Refuse while money is still in the air — deleting now would strand the
  // other party mid-transaction with nobody to resolve it against.
  const { data: liveBookings } = await db
    .from('bookings')
    .select('id')
    .eq('operator_id', subscriberId)
    .eq('status', 'confirmed')
    .limit(1);

  if (liveBookings?.length) {
    return {
      ok: false,
      error:
        'You still have a confirmed booking. Complete or cancel it first, then delete your account.',
    };
  }

  const { data: openDisputes } = await db
    .from('disputes')
    .select('id, bookings!inner (operator_id)')
    .eq('bookings.operator_id', subscriberId)
    .eq('status', 'open')
    .limit(1);

  if (openDisputes?.length) {
    return {
      ok: false,
      error: 'There is an open dispute on your account. It has to be resolved first.',
    };
  }

  // phone is unique and NOT NULL, so it needs a placeholder rather than null.
  const tombstone = `deleted:${randomUUID()}`;

  const { error } = await db
    .from('subscribers')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      name: 'Deleted account',
      phone: tombstone,
      bio: null,
      photo_url: null,
      area: 'unknown',
      otp_code: null,
      otp_expires_at: null,
      guardian_name: null,
      guardian_phone: null,
      guardian_email: null,
      guardian_relationship: null,
      guardian_consent_name: null,
      guardian_consent_ip: null,
    })
    .eq('id', subscriberId);

  if (error) {
    console.error('[account:delete]', error);
    return { ok: false, error: 'Could not delete the account.' };
  }

  // Take the storefront down. Services and profile go; bookings and reviews
  // stay because they are also the other party's record.
  await Promise.all([
    db.from('services').update({ active: false }).eq('operator_id', subscriberId),
    db.from('slots').delete().eq('operator_id', subscriberId).eq('status', 'open'),
    db.from('gallery_photos').delete().eq('operator_id', subscriberId),
    db.from('operator_profiles').delete().eq('operator_id', subscriberId),
    db.from('push_subscriptions').delete().eq('operator_id', subscriberId),

    // Leave every neighborhood group. Membership is what lets someone book or
    // be booked inside one, so a deleted account keeping it would be a ghost
    // in a group of people who think they know everyone in it.
    db
      .from('community_members')
      .update({
        status: 'removed',
        removed_at: new Date().toISOString(),
        removed_reason: 'Account deleted',
      })
      .eq('subscriber_id', subscriberId)
      .neq('status', 'removed'),

    // Hand over any group they ran, to whoever they named. Only groups with
    // no usable successor are archived — an owner is the only person who can
    // approve or remove members, so a group that outlives its owner with
    // nobody in charge is worse than no group.
    handOverOwnedCommunities({
      ownerColumn: 'owner_subscriber_id',
      ownerId: subscriberId,
      reason: 'This group closed because the person running it left HelloNeighbor.',
    }),
  ]);

  return { ok: true };
}
