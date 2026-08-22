import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ADMIN_COOKIE, cookieOptions, createToken } from '@/lib/session';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { adminAreaVisible } from '@/lib/adminAccess';

/** POST /api/auth/admin — password login for the admin dashboard. */
export async function POST(request: Request) {
  const limited = await enforceRateLimit('adminLogin', [clientIp(request)]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);

  // Unlisted entrance and optional IP allowlist, both checked before the
  // password. 404 rather than 401 — a 401 confirms the endpoint exists.
  if (!adminAreaVisible(body?.access_key ? String(body.access_key) : undefined)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const provided = String(body?.password ?? '');
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    console.error('[admin-login] ADMIN_PASSWORD is not set');
    return NextResponse.json({ error: 'Admin login is not configured.' }, { status: 500 });
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, createToken('admin'), cookieOptions);
  return response;
}
