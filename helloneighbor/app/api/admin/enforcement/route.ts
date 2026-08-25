import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/guards';
import { sendSms } from '@/lib/sms';
import {
  SUSPENSION_DAYS,
  categoryLabel,
  recommendedAction,
  severityOf,
  type EnforcementAction,
} from '@/lib/enforcement';

const ACTIONS = new Set<EnforcementAction>(['warning', 'suspension', 'ban', 'lifted']);

/**
 * GET /api/admin/enforcement?subscriber_id=… | ?phone=…
 *
 * One person's history, plus what the ladder recommends next. The
 * recommendation is a default for the form, never something that fires on its
 * own — an automatic ban is an automatic false positive sooner or later, and
 * there is no appeal to a machine.
 */
export async function GET(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const subscriberId = url.searchParams.get('subscriber_id');
  const phone = url.searchParams.get('phone');
  const category = url.searchParams.get('category') ?? 'other';

  if (!subscriberId && !phone) {
    return NextResponse.json({ error: 'Name a subscriber or a phone.' }, { status: 400 });
  }

  const query = supabaseAdmin()
    .from('enforcement_actions')
    .select('id, created_at, action, reason, severe, expires_at, decided_by, dispute_id')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data } = subscriberId
    ? await query.eq('subscriber_id', subscriberId)
    : await query.eq('phone', phone!);

  const history = data ?? [];

  return NextResponse.json({
    history,
    recommended: recommendedAction({
      category,
      priorWarnings: history.filter((a) => a.action === 'warning').length,
      priorSuspensions: history.filter((a) => a.action === 'suspension').length,
    }),
  });
}

/**
 * POST /api/admin/enforcement — act on an account.
 *
 * Append-only. Lifting a suspension writes a 'lifted' row rather than deleting
 * anything, so "why was this person banned" is answerable in a year.
 */
export async function POST(request: Request) {
  const denied = requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const subscriberId = body?.subscriber_id ? String(body.subscriber_id) : null;
  const phone = body?.phone ? String(body.phone) : null;
  const action = String(body?.action ?? '') as EnforcementAction;
  const reason = String(body?.reason ?? '').trim();
  const category = String(body?.category ?? 'other');
  const disputeId = body?.dispute_id ? String(body.dispute_id) : null;

  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
  // Exactly one subject, matching the table's own constraint.
  if (Boolean(subscriberId) === Boolean(phone)) {
    return NextResponse.json(
      { error: 'Name exactly one of a subscriber or a phone.' },
      { status: 400 }
    );
  }
  // Every action is something a real person may read back months later, and a
  // ban with no stated reason cannot be defended or appealed.
  if (reason.length < 10) {
    return NextResponse.json({ error: 'Write down why, in a sentence.' }, { status: 400 });
  }

  const severe = severityOf(category) === 'severe';
  const expiresAt =
    action === 'suspension' && !severe
      ? new Date(Date.now() + SUSPENSION_DAYS * 86_400_000).toISOString()
      : null;

  const db = supabaseAdmin();

  const { error } = await db.from('enforcement_actions').insert({
    subscriber_id: subscriberId,
    phone,
    action,
    reason: `${categoryLabel(category)}: ${reason}`.slice(0, 2000),
    severe,
    dispute_id: disputeId,
    decided_by: 'admin',
    expires_at: expiresAt,
  });

  if (error) {
    console.error('[enforcement]', error);
    return NextResponse.json({ error: 'Could not record that.' }, { status: 500 });
  }

  // The listing has to come down with the account, or a banned provider stays
  // bookable until someone notices.
  if (subscriberId) {
    if (action === 'ban') {
      await db.from('subscribers').update({ status: 'rejected' }).eq('id', subscriberId);
    } else if (action === 'suspension') {
      await db.from('subscribers').update({ status: 'suspended' }).eq('id', subscriberId);
    } else if (action === 'lifted') {
      await db.from('subscribers').update({ status: 'active' }).eq('id', subscriberId);
    }
  }

  // Tell them what happened to them. Never who reported it or what they said.
  const target = phone
    ? phone
    : (
        await db.from('subscribers').select('phone').eq('id', subscriberId!).maybeSingle()
      ).data?.phone;

  if (target) {
    const note =
      action === 'ban'
        ? 'Your HelloNeighbor account has been closed for breaking the community guidelines. Reply to this message if you think that is wrong.'
        : action === 'suspension'
          ? 'Your HelloNeighbor account is suspended while we look into a report. We will be in touch.'
          : action === 'lifted'
            ? 'Your HelloNeighbor account has been reinstated.'
            : 'A warning has been recorded on your HelloNeighbor account for breaking the community guidelines.';
    await sendSms(target, note);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
