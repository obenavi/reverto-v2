import { NextResponse } from 'next/server';
import { currentOperatorId, isAdmin } from './session';

/**
 * Route-handler guards. Each returns either the caller's identity or a
 * response to return immediately.
 */

export function requireOperator():
  | { operatorId: string; deny?: never }
  | { operatorId?: never; deny: NextResponse } {
  const operatorId = currentOperatorId();
  if (!operatorId) {
    return { deny: NextResponse.json({ error: 'Not logged in.' }, { status: 401 }) };
  }
  return { operatorId };
}

export function requireAdmin(): NextResponse | null {
  return isAdmin() ? null : NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
}
