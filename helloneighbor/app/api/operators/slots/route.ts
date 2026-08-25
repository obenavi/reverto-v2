import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { curfewRefusal } from '@/lib/curfewPolicy';

/** POST /api/operators/slots — open a block of availability. */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const startsAt = new Date(String(body?.starts_at ?? ''));
  const durationMin = Math.round(Number(body?.duration_min ?? 60));

  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: 'Pick a date and time.' }, { status: 400 });
  }
  if (startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'That time is in the past.' }, { status: 400 });
  }
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    return NextResponse.json({ error: 'How long is the slot?' }, { status: 400 });
  }

  // A slot that ends after curfew could never be worked, so it is refused at
  // the point it is created rather than silently hidden at booking time.
  const refusal = await curfewRefusal({
    operatorId,
    startsAt,
    durationMin,
    audience: 'operator',
  });
  if (refusal) return NextResponse.json({ error: refusal }, { status: 400 });

  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);

  const { data, error } = await supabaseAdmin()
    .from('slots')
    .insert({
      operator_id: operatorId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    console.error('[slots:create]', error);
    return NextResponse.json({ error: 'Could not add that slot.' }, { status: 500 });
  }
  return NextResponse.json({ slot: data }, { status: 201 });
}

/** DELETE /api/operators/slots?id=… — only slots nobody has booked. */
export async function DELETE(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing slot id.' }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from('slots')
    .delete()
    .eq('id', id)
    .eq('operator_id', operatorId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[slots:delete]', error);
    return NextResponse.json({ error: 'Could not remove that slot.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'That slot is already booked — cancel the booking instead.' },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
