import { NextResponse } from 'next/server';
import { requireOperator } from '@/lib/guards';
import { deleteAccount } from '@/lib/account';
import { OPERATOR_COOKIE } from '@/lib/session';

/**
 * DELETE /api/operators/account — the operator deletes their own account.
 *
 * Requires the literal word DELETE in the body: this is irreversible and a
 * stray click should not do it.
 */
export async function DELETE(request: Request) {
  const { operatorId, deny } = requireOperator();
  if (deny) return deny;

  const confirm = new URL(request.url).searchParams.get('confirm');
  if (confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Deletion not confirmed.' }, { status: 400 });
  }

  const result = await deleteAccount(operatorId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(OPERATOR_COOKIE);
  return response;
}
