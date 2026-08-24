import { supabaseAdmin } from './supabase';
import { PLANS, capacity, weekEnd, weekStart, type Capacity, type PlanId } from './plans';

/**
 * Plan limits, counted against live data.
 *
 * Kept apart from lib/plans.ts so the plan definitions stay a pure table that
 * tests and the pricing page can import without pulling in a database client.
 */

/**
 * Confirmed and completed bookings whose slot falls in the given week.
 *
 * Counted by when the work happens rather than when it was booked: a neighbor
 * booking three weeks ahead should not eat this week's allowance. Cancelled
 * bookings do not count — a cancellation gives the slot back.
 */
export async function bookingsInWeek(operatorId: string, when = new Date()): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('bookings')
    .select('id, slots!inner(starts_at)', { count: 'exact', head: true })
    .eq('operator_id', operatorId)
    .in('status', ['confirmed', 'completed'])
    .gte('slots.starts_at', weekStart(when).toISOString())
    .lt('slots.starts_at', weekEnd(when).toISOString());

  if (error) {
    console.error('[capacity] could not count bookings', error);
    // Fail open: a counting error should not make someone unbookable.
    return 0;
  }
  return count ?? 0;
}

export async function operatorCapacity(
  operatorId: string,
  planId: PlanId,
  when = new Date()
): Promise<Capacity> {
  if (PLANS[planId].weeklyBookings === null) {
    return capacity(planId, 0, when);
  }
  return capacity(planId, await bookingsInWeek(operatorId, when), when);
}

/** How many services an operator has, against what their plan allows. */
export async function serviceAllowance(
  operatorId: string,
  planId: PlanId
): Promise<{ used: number; max: number | null; atLimit: boolean }> {
  const max = PLANS[planId].maxServices;
  if (max === null) return { used: 0, max: null, atLimit: false };

  const { count, error } = await supabaseAdmin()
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('operator_id', operatorId);

  if (error) {
    console.error('[capacity] could not count services', error);
    return { used: 0, max, atLimit: false };
  }

  const used = count ?? 0;
  return { used, max, atLimit: used >= max };
}
