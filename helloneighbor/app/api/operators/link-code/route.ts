import { NextResponse } from 'next/server';
import { requireOperator } from '@/lib/guards';
import { linkCodeFor } from '@/lib/parents';

/**
 * GET /api/operators/link-code — the code a young person gives their parent.
 *
 * Generated on first request rather than at signup, so an account that never
 * needs one never gets one.
 */
export async function GET() {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const code = await linkCodeFor(operatorId);
  if (!code) {
    return NextResponse.json({ error: 'Could not create a code.' }, { status: 500 });
  }
  return NextResponse.json({ code });
}
