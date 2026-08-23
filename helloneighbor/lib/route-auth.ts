import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase';
import { currentOperatorId, isAdmin } from './session';
import { readConversationToken } from './conversations';
import { clientIp } from './ratelimit';

/**
 * Authorization for route handlers that need a credential.
 *
 * This exists because the same bug appeared three times: a handler called
 * supabaseAdmin() at the top, before working out who was calling. In
 * production the 401 still won, but an unauthenticated caller got a 500 and a
 * stack trace instead of a clean refusal, and the route did pointless work.
 *
 * The shape here makes that mistake unavailable rather than merely discouraged
 * — `db` is only handed to the handler, and the handler only runs once a
 * caller has been resolved and accepted. A route using this cannot construct
 * the client early because it never imports it.
 */

export type CallerKind = 'operator' | 'neighbor' | 'admin';

export type Caller =
  | { kind: 'operator'; operatorId: string }
  | { kind: 'neighbor'; conversationId: string }
  | { kind: 'admin' };

/**
 * `caller` is narrowed to whatever the route accepted, so a handler that only
 * accepts operators gets `operatorId` without re-checking `kind`.
 */
export type RouteContext<K extends CallerKind> = {
  caller: Extract<Caller, { kind: K }>;
  db: SupabaseClient;
  body: Record<string, unknown>;
  ip: string;
};

/**
 * Resolves the caller from credentials only — a signed conversation token, a
 * session cookie — never from anything the request body claims about identity.
 *
 * A neighbor token wins over an operator session: an operator who booked
 * someone else is acting as the customer on that thread, and the token is the
 * more specific claim.
 */
function resolveCaller(request: Request, token: string | undefined): Caller | null {
  const fromToken = readConversationToken(token);
  if (fromToken) return { kind: 'neighbor', conversationId: fromToken };

  const operatorId = currentOperatorId();
  if (operatorId) return { kind: 'operator', operatorId };

  if (isAdmin()) return { kind: 'admin' };

  return null;
}

const denied = () => NextResponse.json({ error: 'Not authorized.' }, { status: 401 });

/**
 * Wraps a handler that requires one of `accept`.
 *
 * The JSON body is read once and passed through, so a handler never has to
 * clone the request to look at it before authorizing.
 */
export async function withCaller<K extends CallerKind>(
  request: Request,
  accept: readonly K[],
  handler: (ctx: RouteContext<K>) => Promise<NextResponse>
): Promise<NextResponse> {
  const body: Record<string, unknown> =
    request.method === 'GET' || request.method === 'HEAD'
      ? {}
      : ((await request.json().catch(() => ({}))) as Record<string, unknown>);

  // The token may arrive in the query string or the body, depending on whether
  // the caller is fetching or posting.
  const token =
    new URL(request.url).searchParams.get('token') ??
    (typeof body.token === 'string' ? body.token : undefined);

  const caller = resolveCaller(request, token);
  if (!caller || !accept.includes(caller.kind as K)) return denied();

  return handler({
    caller: caller as Extract<Caller, { kind: K }>,
    db: supabaseAdmin(),
    body,
    ip: clientIp(request),
  });
}
