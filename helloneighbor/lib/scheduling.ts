import { supabaseAdmin } from './supabase';

// The pure rules live in ./schedulingRules so client components can import
// them without dragging supabase-js into the browser bundle.
export {
  LATE_OPTIONS,
  lateLabel,
  MIN_GAP_MINUTES,
  MAX_GAP_MINUTES,
  requiredGapMinutes,
  needsTravelBetween,
  findTightPairs,
  lateWouldCollide,
  whenPhrase,
  timePhrase,
} from './schedulingRules';
export type { LateMinutes, ScheduledJob, TightPair } from './schedulingRules';

/**
 * Overlap blocking and travel gaps.
 *
 * Slots were independent of one another, which meant a provider offering two
 * services in the same hour could be booked for both, and nothing noticed two
 * jobs across town with five minutes between them.
 */

/** How late someone can say they will be. */
export async function blockOverlappingSlots(args: {
  operatorId: string;
  bookingId: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
}): Promise<number> {
  const db = supabaseAdmin();

  // Overlap is "starts before this ends AND ends after this starts" — the
  // standard interval test, which correctly leaves exact abutment alone.
  const { data, error } = await db
    .from('slots')
    .update({ status: 'blocked', blocked_by_booking_id: args.bookingId })
    .eq('operator_id', args.operatorId)
    .eq('status', 'open')
    .neq('id', args.slotId)
    .lt('starts_at', args.endsAt)
    .gt('ends_at', args.startsAt)
    .select('id');

  if (error) {
    console.error('[scheduling] could not block overlapping slots', error);
    return 0;
  }
  return data?.length ?? 0;
}

/** Reopens slots closed by a booking that has since been cancelled. */
export async function releaseBlockedSlots(bookingId: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('slots')
    .update({ status: 'open', blocked_by_booking_id: null })
    .eq('blocked_by_booking_id', bookingId)
    .eq('status', 'blocked');

  if (error) console.error('[scheduling] could not release slots', error);
}
