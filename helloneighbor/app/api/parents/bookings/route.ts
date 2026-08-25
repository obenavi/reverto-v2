import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentParentId } from '@/lib/session';
import { linkedChildren } from '@/lib/parents';

/**
 * GET /api/parents/bookings — every booking across the children this parent
 * actually supervises.
 *
 * Scoped by linkedChildren() rather than by anything in the request: holding a
 * parent session is not authority over any particular account.
 */
export async function GET() {
  const parentId = currentParentId();
  if (!parentId) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const children = await linkedChildren(parentId);
  if (children.length === 0) {
    return NextResponse.json({ children: [], bookings: [] });
  }

  const db = supabaseAdmin();

  const [profiles, bookings] = await Promise.all([
    db
      .from('subscribers')
      .select('id, name, age, area, status, plan, supervision, curfew_minutes')
      .in('id', children),
    db
      .from('bookings')
      .select(
        'id, operator_id, client_name, client_phone, client_address, price_cents, payment_method, payment_status, status, cancelled_by, services (title), slots (starts_at, ends_at), subscribers (name)'
      )
      .in('operator_id', children)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  return NextResponse.json({
    children: profiles.data ?? [],
    bookings: bookings.data ?? [],
  });
}
