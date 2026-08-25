import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId, currentParentId } from '@/lib/session';

/**
 * GET /api/communities/bookings?community_id=… — every booking in the group.
 *
 * The owner's whole job, alongside admitting and removing people: seeing what
 * is happening on their street. Scoped to bookings that recorded this group,
 * so it never reaches work the members did elsewhere — an owner is not
 * entitled to a young person's entire diary because they share a postcode.
 */
export async function GET(request: Request) {
  const operatorId = currentOperatorId();
  const parentId = currentParentId();
  if (!operatorId && !parentId) {
    return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });
  }

  const communityId = new URL(request.url).searchParams.get('community_id');
  if (!communityId) return NextResponse.json({ error: 'Which group?' }, { status: 400 });

  const db = supabaseAdmin();

  const { data: owned } = await db
    .from('communities')
    .select('id')
    .eq('id', communityId)
    .eq(operatorId ? 'owner_subscriber_id' : 'owner_parent_id', operatorId ?? parentId!)
    .maybeSingle();

  if (!owned) {
    return NextResponse.json({ error: 'That is not your group.' }, { status: 403 });
  }

  const { data } = await db
    .from('bookings')
    .select(
      'id, created_at, status, price_cents, client_name, services (title), slots (starts_at, ends_at), subscribers (name, age)'
    )
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(200);

  const bookings = (data ?? []).map((row) => {
    const provider = row.subscribers as unknown as { name: string; age: number } | null;
    const service = row.services as unknown as { title: string } | null;
    const slot = row.slots as unknown as { starts_at: string; ends_at: string } | null;
    return {
      id: row.id,
      status: row.status,
      priceCents: row.price_cents,
      // First names only on both sides. An owner needs to see that Sam is
      // mowing for the Patels on Saturday, not their phone numbers.
      provider: provider?.name.split(' ')[0] ?? 'Someone',
      providerAge: provider?.age ?? null,
      customer: row.client_name.split(' ')[0],
      service: service?.title ?? 'A service',
      startsAt: slot?.starts_at ?? null,
      endsAt: slot?.ends_at ?? null,
    };
  });

  return NextResponse.json({ bookings });
}
