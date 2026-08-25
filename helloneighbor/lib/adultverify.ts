/**
 * The database half of the adult check. lib/adultcheck.ts holds the policy so
 * the parent's screens can use it too; this reads and writes the ledger.
 */
import { supabaseAdmin } from './supabase';
import {
  adultStatus,
  nextStep,
  remainingSignals,
  type AdultMethod,
  type AdultSignal,
  type AdultStatus,
} from './adultcheck';

export type AdultProgress = {
  status: AdultStatus;
  next: AdultMethod | null;
  remaining: number;
  signals: AdultSignal[];
};

/** Every check run against this parent, oldest first. */
export async function adultSignals(parentId: string): Promise<AdultSignal[]> {
  const { data, error } = await supabaseAdmin()
    .from('adult_checks')
    .select('method, passed, detail')
    .eq('parent_id', parentId)
    .order('created_at');

  if (error) {
    console.error('[adultverify] could not read checks', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    method: row.method as AdultMethod,
    passed: row.passed,
    detail: row.detail ?? '',
  }));
}

export async function adultProgress(parentId: string): Promise<AdultProgress> {
  const signals = await adultSignals(parentId);
  return {
    status: adultStatus(signals),
    next: nextStep(signals),
    remaining: remainingSignals(signals),
    signals,
  };
}

/**
 * Records one attempt and re-derives the parent's status from the whole ledger.
 *
 * Deliberately recomputed from every row rather than advanced in place: a
 * status derived from history can be explained and audited, and a bug here
 * shows up as a wrong answer rather than as an account quietly stuck in a state
 * nothing can reach.
 */
export async function recordAdultCheck(args: {
  parentId: string;
  method: AdultMethod;
  passed: boolean;
  detail: string;
  provider?: string | null;
  estimatedAge?: number | null;
  confidence?: number | null;
  reviewedBy?: string | null;
  ip?: string | null;
}): Promise<AdultProgress> {
  const db = supabaseAdmin();

  const { error } = await db.from('adult_checks').insert({
    parent_id: args.parentId,
    method: args.method,
    passed: args.passed,
    detail: args.detail,
    provider: args.provider ?? null,
    // Never populated by anything but the estimation path, and never an image.
    estimated_age: args.estimatedAge ?? null,
    confidence: args.confidence ?? null,
    reviewed_by: args.reviewedBy ?? null,
    ip: args.ip ?? null,
  });

  if (error) console.error('[adultverify] could not record check', error);

  const progress = await adultProgress(args.parentId);

  // The method recorded on the parent is the one that actually settled it, so
  // an admin reading the row can see why this account is trusted.
  const settling = progress.signals.filter((s) => s.passed).at(-1)?.method ?? null;

  const { error: updateError } = await db
    .from('parents')
    .update({
      age_proof_status: progress.status,
      age_proof_method: progress.status === 'verified' ? settling : null,
      age_verified_at: progress.status === 'verified' ? new Date().toISOString() : null,
    })
    .eq('id', args.parentId);

  if (updateError) console.error('[adultverify] could not update parent', updateError);

  return progress;
}

/** Whether this parent may do anything that touches money. */
export async function isVerifiedAdult(parentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('parents')
    .select('age_proof_status')
    .eq('id', parentId)
    .maybeSingle();

  return data?.age_proof_status === 'verified';
}
