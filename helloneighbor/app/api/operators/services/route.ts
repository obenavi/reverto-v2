import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { jurisdictionFor, kindAllowedIn } from '@/lib/jurisdictions';
import { SERVICE_KINDS } from '@/lib/catalog';
import { reviewContent } from '@/lib/supervisor';
import { PLANS, kindAllowedOnPlan, type PlanId } from '@/lib/plans';
import { serviceAllowance } from '@/lib/capacity';
import type { ServiceKind } from '@/lib/types';

const KINDS = new Set(SERVICE_KINDS.map((s) => s.kind));

/** POST /api/operators/services — add a service to the logged-in operator. */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const kind = String(body?.kind ?? '') as ServiceKind;
  const title = String(body?.title ?? '').trim();
  const priceCents = Math.round(Number(body?.price_cents));
  const durationMin = Math.round(Number(body?.duration_min));

  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: 'Pick a service type.' }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: 'Give it a name.' }, { status: 400 });
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: 'Price must be zero or more.' }, { status: 400 });
  }
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    return NextResponse.json({ error: 'How long does it take?' }, { status: 400 });
  }

  // What the operator's plan allows.
  const { data: account } = await supabaseAdmin()
    .from('subscribers')
    .select('plan, state')
    .eq('id', operatorId)
    .maybeSingle();

  // The state gate runs before the plan gate. A category their state does not
  // allow is not something a paid upgrade can unlock.
  const lookup = jurisdictionFor(account?.state);
  if (!lookup.enabled) {
    return NextResponse.json({ error: lookup.message, stateNotEnabled: true }, { status: 403 });
  }
  if (!kindAllowedIn(lookup.jurisdiction, kind)) {
    return NextResponse.json(
      { error: `That service is not available in ${lookup.jurisdiction.name}.` },
      { status: 403 }
    );
  }

  const planId = (account?.plan ?? 'basic') as PlanId;
  const planDef = PLANS[planId];

  if (!kindAllowedOnPlan(planId, kind)) {
    return NextResponse.json(
      {
        error: `${planDef.name} covers the services on our list. Upgrade to Pro to name your own.`,
        upgrade: true,
      },
      { status: 402 }
    );
  }

  const allowance = await serviceAllowance(operatorId, planId);
  if (allowance.atLimit) {
    return NextResponse.json(
      {
        error: `${planDef.name} covers ${allowance.max} services and you have ${allowance.used}. Remove one, or upgrade for more.`,
        upgrade: true,
      },
      { status: 402 }
    );
  }

  const { data, error } = await supabaseAdmin()
    .from('services')
    .insert({
      operator_id: operatorId,
      kind,
      title,
      description: body?.description ? String(body.description).trim() : null,
      price_cents: priceCents,
      duration_min: durationMin,
      location_type: body?.location_type === 'at_provider' ? 'at_provider' : 'at_customer',
      active: body?.active !== false,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[services:create]', error);
    return NextResponse.json({ error: 'Could not save that service.' }, { status: 500 });
  }

  // A blocked listing is hidden immediately rather than waiting on an admin,
  // since it is publicly bookable the moment it exists.
  const { verdict, review } = await reviewContent({
    subjectType: 'service',
    subjectId: data.id,
    label: 'service listing',
    content: { kind, title, description: data.description, price_cents: priceCents },
  });

  if (verdict === 'block') {
    await supabaseAdmin().from('services').update({ active: false }).eq('id', data.id);
    return NextResponse.json(
      {
        error:
          review?.rationale ??
          'That listing does not fit the community guidelines, so it has been hidden.',
        service: { ...data, active: false },
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ service: data }, { status: 201 });
}

/** PATCH /api/operators/services — edit price, title, or the active toggle. */
export async function PATCH(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? '');
  if (!id) return NextResponse.json({ error: 'Missing service id.' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.title === 'string') patch.title = body.title.trim();
  if (typeof body.description === 'string') patch.description = body.description.trim();
  if (body.price_cents !== undefined) patch.price_cents = Math.round(Number(body.price_cents));
  if (body.duration_min !== undefined) patch.duration_min = Math.round(Number(body.duration_min));
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (body.location_type === 'at_provider' || body.location_type === 'at_customer') {
    patch.location_type = body.location_type;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  // Scoping to operator_id is what stops one operator editing another's rows,
  // since the service role key bypasses RLS.
  const { data, error } = await supabaseAdmin()
    .from('services')
    .update(patch)
    .eq('id', id)
    .eq('operator_id', operatorId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[services:update]', error);
    return NextResponse.json({ error: 'Could not update that service.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Service not found.' }, { status: 404 });
  return NextResponse.json({ service: data });
}

/** DELETE /api/operators/services?id=… */
export async function DELETE(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing service id.' }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from('services')
    .delete()
    .eq('id', id)
    .eq('operator_id', operatorId);

  if (error) {
    console.error('[services:delete]', error);
    return NextResponse.json({ error: 'Could not delete that service.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
