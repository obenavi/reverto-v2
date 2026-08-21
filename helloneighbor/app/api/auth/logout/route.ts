import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, OPERATOR_COOKIE } from '@/lib/session';

/** POST /api/auth/logout — clears whichever session cookies are present. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(OPERATOR_COOKIE);
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
