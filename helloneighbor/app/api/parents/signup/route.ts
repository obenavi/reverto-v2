import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { normalizePhone } from '@/lib/format';
import { TERMS_VERSION } from '@/lib/guidelines';
import { PARENT_RELATIONSHIPS } from '@/lib/parents';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RELATIONSHIPS = new Set(PARENT_RELATIONSHIPS.map((r) => r.value));

/**
 * POST /api/parents/signup — create a parent account.
 *
 * Public by necessity: a parent has no credential until this succeeds. The
 * account is created unverified; proof of age is reviewed separately, and
 * nothing about a child is reachable until a link is made and that link is
 * checked on every request.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await enforceRateLimit('join', [ip]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  if (!(await verifyTurnstile(body.turnstile_token, ip))) {
    return NextResponse.json(
      { error: 'Could not verify you are human. Reload and try again.' },
      { status: 403 }
    );
  }

  const firstName = String(body.first_name ?? '').trim();
  const lastName = String(body.last_name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const relationship = String(body.relationship ?? '');
  const phone = body.phone ? normalizePhone(String(body.phone)) : null;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'We need your first and last name.' }, { status: 400 });
  }
  if (!EMAIL_SHAPE.test(email)) {
    return NextResponse.json({ error: 'That email does not look right.' }, { status: 400 });
  }
  if (!RELATIONSHIPS.has(relationship as never)) {
    return NextResponse.json(
      { error: 'Tell us whether you are their mom, dad, or legal guardian.' },
      { status: 400 }
    );
  }
  if (body.accepted_terms !== true) {
    return NextResponse.json(
      { error: 'You need to accept the community guidelines.' },
      { status: 400 }
    );
  }
  if (body.confirms_adult !== true) {
    return NextResponse.json(
      { error: 'You need to confirm you are over 18.' },
      { status: 400 }
    );
  }

  const db = supabaseAdmin();

  const { data, error } = await db
    .from('parents')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      relationship,
      accepted_terms_at: new Date().toISOString(),
      accepted_terms_version: TERMS_VERSION,
      // Self-declaration is not proof. Awaiting review either way.
      age_proof_status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'There is already an account with that email. Log in instead.' },
        { status: 409 }
      );
    }
    console.error('[parents:signup]', error);
    return NextResponse.json({ error: 'Could not create that account.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
