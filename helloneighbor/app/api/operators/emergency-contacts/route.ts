import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { normalizePhone } from '@/lib/format';
import { CONTACT_RELATIONSHIPS, MAX_EMERGENCY_CONTACTS, escalationTargets } from '@/lib/escalation';

const RELATIONSHIPS = new Set(CONTACT_RELATIONSHIPS.map((r) => r.value as string));

/** GET — my contacts, and who would actually be reached. */
export async function GET() {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const { data } = await supabaseAdmin()
    .from('emergency_contacts')
    .select('id, name, phone, relationship, priority, verified_at')
    .eq('subscriber_id', operatorId)
    .order('priority');

  // Showing the real chain, not just their own entries. A young person should
  // be able to see that a guardian is already in it before deciding whether
  // they need to add anyone.
  const targets = await escalationTargets(operatorId);

  return NextResponse.json({
    contacts: data ?? [],
    chain: targets.map((t) => ({ who: t.contacted, name: t.name })),
  });
}

/** POST — add or replace a contact at a priority slot. */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? '').trim().slice(0, 80);
  const phone = normalizePhone(String(body?.phone ?? ''));
  const relationship = String(body?.relationship ?? '');
  const priority = Math.round(Number(body?.priority ?? 1));

  if (!name) return NextResponse.json({ error: 'Who is it?' }, { status: 400 });
  if (!phone) {
    return NextResponse.json({ error: 'That phone number does not look right.' }, { status: 400 });
  }
  if (!RELATIONSHIPS.has(relationship)) {
    return NextResponse.json({ error: 'How do you know them?' }, { status: 400 });
  }
  if (!Number.isInteger(priority) || priority < 1 || priority > MAX_EMERGENCY_CONTACTS) {
    return NextResponse.json({ error: 'Pick a slot.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  // A young person's own number in their own emergency list is the kind of
  // mistake that only shows up at the worst moment.
  const { data: self } = await db
    .from('subscribers')
    .select('phone, name')
    .eq('id', operatorId)
    .maybeSingle();

  if (self?.phone && normalizePhone(self.phone) === phone) {
    return NextResponse.json(
      { error: 'That is your own number. It needs to be someone who can come and get you.' },
      { status: 400 }
    );
  }

  const { error } = await db.from('emergency_contacts').upsert(
    {
      subscriber_id: operatorId,
      name,
      phone,
      relationship,
      priority,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'subscriber_id,priority' }
  );

  if (error) {
    console.error('[emergency:save]', error);
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE ?id=… */
export async function DELETE(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Which one?' }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from('emergency_contacts')
    .delete()
    .eq('id', id)
    .eq('subscriber_id', operatorId);

  if (error) {
    console.error('[emergency:delete]', error);
    return NextResponse.json({ error: 'Could not remove that.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
