import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sends signed-out visitors to the right login page before any private shell
 * renders.
 *
 * Why here rather than in the page: redirect() from a server component is
 * delivered as a client-side navigation, so the browser gets a 200 and the
 * page shell renders before it moves. Nothing private leaks — every API refuses
 * an anonymous caller, and the shells hold no data — but a real 307 is both
 * faster and more honest.
 *
 * This checks only that a session cookie is PRESENT. It cannot check the
 * signature: middleware runs on the Edge runtime, which has no node crypto,
 * and the HMAC lives there. That is fine — a forged cookie gets past this and
 * straight into the page's own currentX() check, which does verify, and into
 * the API guards, which verify again. Treat this as routing, not as security.
 */

const GUARDED: { prefix: string; cookie: string; login: string }[] = [
  { prefix: '/dashboard', cookie: 'hn_operator', login: '/login' },
  { prefix: '/parent', cookie: 'hn_parent', login: '/parent/login' },
  { prefix: '/admin', cookie: 'hn_admin', login: '/admin/login' },
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  for (const rule of GUARDED) {
    if (!pathname.startsWith(rule.prefix)) continue;
    // The login page itself must stay reachable.
    if (pathname.startsWith(rule.login)) return NextResponse.next();
    if (pathname.startsWith('/parent/signup')) return NextResponse.next();

    if (!request.cookies.has(rule.cookie)) {
      const url = request.nextUrl.clone();
      url.pathname = rule.login;
      url.search = '';
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/parent/:path*', '/admin/:path*'],
};
