import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireOperator } from '@/lib/guards';
import { clientIp } from '@/lib/ratelimit';

/**
 * POST /api/age-verification/consent — records agreement to the face check.
 *
 * Separate from the scan itself on purpose: BIPA requires notice and written
 * consent *before* a biometric is captured. Bundling consent into the upload
 * would make it implied by the act, which is the thing the statute rules out.
 */
export async function POST(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const body = await request.json().catch(() => null);
  if (body?.accepted !== true) {
    return NextResponse.json({ error: 'You need to agree to continue.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from('subscribers')
    .update({
      biometric_consent_at: new Date().toISOString(),
      biometric_consent_ip: clientIp(request),
    })
    .eq('id', operatorId);

  if (error) {
    console.error('[ageverify:consent]', error);
    return NextResponse.json({ error: 'Could not record your agreement.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
