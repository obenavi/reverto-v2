import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { jurisdictionFor, kindAllowedIn } from '@/lib/jurisdictions';
import { SERVICE_KINDS } from '@/lib/catalog';
import { reviewContent } from '@/lib/supervisor';
import { screenServiceText } from '@/lib/serviceScreen';
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

  const description = body?.description ? String(body.description).trim() : null;

  // The floor, before the model and before the row. Deterministic, unappealable,
  // and it runs on a listing that has not been written anywhere yet — there is
  // no window in which a banned listing exists and is bookable.
  const screened = screenServiceText(title, description);
  if (!screened.ok) {
    return NextResponse.json(
      { error: screened.message, blockedCategory: screened.category },
      { status: 422 }
    );
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

  // Written first so the supervisor has something to file its verdict against,
  // but never live: `active` starts false and is only turned on by a verdict.
  // The previous order inserted an ACTIVE row and hid it afterwards, which left
  // a listing publicly bookable for as long as the model took to answer.
  const wantsActive = body?.active !== false;

  const { data, error } = await supabaseAdmin()
    .from('services')
    .insert({
      operator_id: operatorId,
      kind,
      title,
      description,
      price_cents: priceCents,
      duration_min: durationMin,
      location_type: body?.location_type === 'at_provider' ? 'at_provider' : 'at_customer',
      active: false,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[services:create]', error);
    return NextResponse.json({ error: 'Could not save that service.' }, { status: 500 });
  }

  const { verdict, review } = await reviewContent({
    subjectType: 'service',
    subjectId: data.id,
    label: 'service listing',
    content: { kind, title, description, price_cents: priceCents },
  });

  if (verdict === 'block') {
    return NextResponse.json(
      {
        error:
          review?.rationale ??
          'That listing does not fit the community guidelines, so it is not live.',
        service: data,
      },
      { status: 422 }
    );
  }

  // 'review' and 'error' both mean a person has not seen it yet. It stays
  // hidden — a listing nobody has checked should not be taking bookings, and
  // an unconfigured or failing supervisor is not a reason to publish.
  if (verdict !== 'pass') {
    return NextResponse.json(
      {
        service: data,
        pending: true,
        message:
          'Saved, and waiting on a person to look at it. It will go live once somebody has.',
      },
      { status: 201 }
    );
  }

  if (wantsActive) {
    const { data: live } = await supabaseAdmin()
      .from('services')
      .update({ active: true })
      .eq('id', data.id)
      .select('*')
      .single();
    return NextResponse.json({ service: live ?? { ...data, active: true } }, { status: 201 });
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

  // An edit is new text. Screening only on create would make "add something
  // bland, then rewrite it" the obvious way past every check on this page.
  if (typeof patch.title === 'string' || typeof patch.description === 'string') {
    const edited = screenServiceText(
      typeof patch.title === 'string' ? patch.title : null,
      typeof patch.description === 'string' ? patch.description : null
    );
    if (!edited.ok) {
      return NextResponse.json(
        { error: edited.message, blockedCategory: edited.category },
        { status: 422 }
      );
    }
  }
  if (body.price_cents !== undefined) patch.price_cents = Math.round(Number(body.price_cents));
  if (body.duration_min !== undefined) patch.duration_min = Math.round(Number(body.duration_min));
  if (typeof body.active === 'boolean') patch.active = body.active;
  if (body.location_type === 'at_provider' || body.location_type === 'at_customer') {
    patch.location_type = body.location_type;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  // Rewritten text gets the model as well as the blocklist, synchronously. The
  // fire-and-forget version would leave the new wording live and bookable while
  // the model read it, which is the same hole the create path used to have.
  const textChanged = typeof patch.title === 'string' || typeof patch.description === 'string';
  if (textChanged) {
    const { data: current } = await supabaseAdmin()
      .from('services')
      .select('kind, title, description, price_cents')
      .eq('id', id)
      .eq('operator_id', operatorId)
      .maybeSingle();

    if (!current) return NextResponse.json({ error: 'Service not found.' }, { status: 404 });

    const { verdict, review } = await reviewContent({
      subjectType: 'service',
      subjectId: id,
      label: 'edited service listing',
      content: {
        kind: current.kind,
        title: patch.title ?? current.title,
        description: patch.description ?? current.description,
        price_cents: patch.price_cents ?? current.price_cents,
      },
    });

    if (verdict === 'block') {
      return NextResponse.json(
        {
          error:
            review?.rationale ??
            'That wording does not fit the community guidelines, so the change was not saved.',
        },
        { status: 422 }
      );
    }

    // Anything short of a pass means nobody has approved the new wording.
    if (verdict !== 'pass') patch.active = false;
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
