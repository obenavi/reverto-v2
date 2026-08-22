import { supabaseAdmin } from './supabase';

/**
 * A block is one row per operator/neighbor-phone pair, whoever asked for it.
 * Every relationship in this app is exactly that pair, so a single row covers
 * both directions — a blocked neighbor cannot book or message that operator,
 * and vice versa.
 */

export async function isBlocked(operatorId: string, clientPhone: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('blocks')
    .select('id')
    .eq('operator_id', operatorId)
    .eq('client_phone', clientPhone)
    .maybeSingle();

  if (error) {
    // Fail open on a lookup error rather than locking everyone out, but say so.
    console.error('[blocks] lookup failed', error);
    return false;
  }
  return Boolean(data);
}

/** Phone numbers this operator has blocked, for the dashboard list. */
export async function blockedPhones(operatorId: string): Promise<string[]> {
  const { data } = await supabaseAdmin()
    .from('blocks')
    .select('client_phone')
    .eq('operator_id', operatorId);

  return (data ?? []).map((row) => row.client_phone as string);
}
