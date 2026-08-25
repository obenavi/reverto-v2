import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentParentId } from '@/lib/session';
import { supervises } from '@/lib/parents';
import { PLATFORM_CURFEW_MINUTES, formatCurfew } from '@/lib/curfew';

/**
 * POST /api/parents/curfew — set or clear how late a child may still be working.
 *
 * A parent can only tighten the platform's 9pm floor. Anything later is
 * refused outright rather than quietly clamped, so nobody sets 11pm, sees it
 * accepted, and believes it took effect.
 */
export async function POST(request: Request) {
  const parentId = currentParentId();
  if (!parentId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const subscriberId = String(body?.subscriber_id ?? '');
  if (!subscriberId) {
    return NextResponse.json({ error: 'Which child?' }, { status: 400 });
  }

  // A parent session is not authority over any particular account.
  if (!(await supervises(parentId, subscriberId))) {
    return NextResponse.json({ error: 'That is not your account to change.' }, { status: 403 });
  }

  // null clears the parent's own limit; the 9pm floor stays either way.
  const raw = body?.curfew_minutes;
  let minutes: number | null = null;

  if (raw !== null && raw !== undefined && raw !== '') {
    minutes = Math.round(Number(raw));
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      return NextResponse.json({ error: 'That is not a time of day.' }, { status: 400 });
    }
    if (minutes > PLATFORM_CURFEW_MINUTES) {
      return NextResponse.json(
        {
          error: `Nobody under 18 works past ${formatCurfew(PLATFORM_CURFEW_MINUTES)} on HelloNeighbor. You can set an earlier time, not a later one.`,
        },
        { status: 400 }
      );
    }
    if (minutes === 0) {
      return NextResponse.json(
        { error: 'A midnight curfew would block every job. Pause the account instead.' },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseAdmin()
    .from('subscribers')
    .update({
      curfew_minutes: minutes,
      curfew_set_by_parent_id: minutes === null ? null : parentId,
      curfew_set_at: minutes === null ? null : new Date().toISOString(),
    })
    .eq('id', subscriberId);

  if (error) {
    console.error('[parents:curfew]', error);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }

  // Times already on the calendar are left alone on purpose: a booking is a
  // commitment to a neighbour, and cancelling it is the parent's decision to
  // make deliberately, through the cancellation flow, not a side effect of
  // changing a setting.
  return NextResponse.json({ ok: true, curfew_minutes: minutes });
}
