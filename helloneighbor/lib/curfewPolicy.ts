/**
 * Curfew, applied against the database.
 *
 * lib/curfew.ts holds the pure rules so the booking page can use them too; this
 * module is the server half that looks up whose curfew applies. Kept separate
 * because it imports the service-role client, which must never reach a browser
 * bundle.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { jurisdictionCurfew, jurisdictionFor } from '@/lib/jurisdictions';
import {
  DEFAULT_TIMEZONE,
  effectiveCurfewMinutes,
  formatCurfew,
  latestStartMinutes,
  withinCurfew,
} from '@/lib/curfew';

export type OperatorCurfew = {
  timezone: string;
  /** null means no curfew applies — an adult with no parent limit set. */
  curfewMinutes: number | null;
};

/** The curfew in force for one operator, platform cap and parent limit merged. */
export async function operatorCurfew(operatorId: string): Promise<OperatorCurfew> {
  const { data } = await supabaseAdmin()
    .from('subscribers')
    .select('age, timezone, curfew_minutes, state')
    .eq('id', operatorId)
    .maybeSingle();

  if (!data) return { timezone: DEFAULT_TIMEZONE, curfewMinutes: null };

  // The platform floor now comes from the state rather than a constant. A
  // jurisdiction with a stricter curfew than 9pm tightens it for everyone
  // there; a parent can tighten it further and never loosen it.
  const lookup = jurisdictionFor(data.state);
  const stateCurfew = lookup.enabled
    ? jurisdictionCurfew(lookup.jurisdiction, data.age)
    : null;

  return {
    timezone: data.timezone ?? DEFAULT_TIMEZONE,
    curfewMinutes: effectiveCurfewMinutes(data.age, data.curfew_minutes, stateCurfew),
  };
}

/**
 * Why this job cannot run, or null if it can.
 *
 * `audience` only changes the wording: the operator setting their own hours
 * should be told what their curfew is, while a neighbour booking someone else's
 * kid has no business being told a family's rules — they just get told the time
 * does not work.
 */
export async function curfewRefusal(args: {
  operatorId: string;
  startsAt: string | Date;
  durationMin: number;
  audience: 'operator' | 'neighbor';
  curfew?: OperatorCurfew;
}): Promise<string | null> {
  const curfew = args.curfew ?? (await operatorCurfew(args.operatorId));
  if (curfew.curfewMinutes == null) return null;

  const check = withinCurfew({
    startsAt: args.startsAt,
    durationMin: args.durationMin,
    timezone: curfew.timezone,
    curfewMinutes: curfew.curfewMinutes,
  });
  if (check.allowed) return null;

  if (args.audience === 'neighbor') {
    return 'That time does not work — the job would run too late. Pick an earlier time.';
  }

  const by = latestStartMinutes(curfew.curfewMinutes, args.durationMin);
  const limit = formatCurfew(curfew.curfewMinutes);

  if (check.crossesMidnight) {
    return `That runs past midnight. You need to be finished by ${limit}.`;
  }
  if (by < 0) {
    return `A ${args.durationMin}-minute job cannot finish by ${limit}. Shorten it or start earlier in the day.`;
  }
  return `That would finish at ${formatCurfew(check.endsAtMinutes)}, and you need to be done by ${limit}. Start by ${formatCurfew(by)}.`;
}
