/**
 * Guards against a bug that shipped three times.
 *
 * A handler that calls supabaseAdmin() before working out who is calling still
 * returns 401 in production — but an unauthenticated caller gets a 500 and a
 * stack trace on the way there, and the route does work it should not.
 *
 * This walks every route handler and fails when the service-role client is
 * constructed before the first authorization decision. It is static, so it
 * needs no server and no database, and it catches the pattern whether or not
 * the author used lib/route-auth.ts.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const API = new URL('../app/api', import.meta.url).pathname;
const ROOT = new URL('..', import.meta.url).pathname;

/**
 * Handlers with no caller to authorize: anyone may reach them, so there is no
 * ordering to get wrong. Each needs a reason, so adding one is a decision
 * rather than a way to silence the check.
 *
 * Keyed by file AND method. Keying by file alone was a real hole: one entry
 * silently excused every handler in the file, so a genuine ordering bug in
 * push POST went undetected behind an exemption written for push DELETE.
 */
const PUBLIC_HANDLERS = {
  'app/api/operators/join/route.ts POST': 'signup — anyone may apply',
  'app/api/bookings/route.ts POST': 'neighbors book without an account',
  'app/api/bookings/recover/route.ts POST':
    'recovery by phone, answers identically whether or not the number is known',
  'app/api/pings/route.ts POST': 'neighbors ping without an account',
  'app/api/auth/request-code/route.ts POST': 'requesting a login code precedes having one',
  'app/api/auth/verify-code/route.ts POST': 'exchanging a code for a session',
  'app/api/parents/signup/route.ts POST':
    'a parent has no credential until this succeeds; the account it creates reaches no child until a link is made',
  'app/api/auth/parent/request-code/route.ts POST':
    'requesting a login code precedes having one; answers identically for unknown emails',
  'app/api/auth/parent/verify-code/route.ts POST': 'exchanging a code for a parent session',
  'app/api/stripe/webhook/route.ts POST':
    'authorized by the Stripe signature, which is verified before the client is built',
  'app/api/communities/join/route.ts POST':
    'the invite code IS the credential — a neighbor with no account joins with it; the code is rate-limited and answers identically for an unknown code and a closed group',
  'app/api/push/route.ts DELETE':
    'the push endpoint URL is itself the per-browser secret; a session may have expired by the time someone turns notifications off',
};

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === 'route.ts') out.push(full);
  }
  return out;
}

/** Extracts each exported handler body by brace matching. */
function handlers(source) {
  const found = [];
  const re = /export async function (GET|POST|PATCH|PUT|DELETE)\s*\([^)]*\)\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    found.push({ method: m[1], body: source.slice(m.index + m[0].length, i - 1) });
  }
  return found;
}

const GUARDS = [
  'requireOperator',
  'requireAdmin',
  'withCaller',
  'readConversationToken',
  'readGuardianToken',
  'status: 401',
  'status: 404',
];

let failures = 0;
let checked = 0;
/** Exemptions actually relied on, so stale ones can be reported. */
const seen = new Set();

for (const file of walk(API).sort()) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');

  for (const { method, body } of handlers(source)) {
    const db = body.indexOf('supabaseAdmin()');
    if (db < 0) continue;

    checked += 1;

    const reason = PUBLIC_HANDLERS[`${rel} ${method}`];
    const firstGuard = GUARDS.map((g) => body.indexOf(g))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0];

    const guarded = firstGuard !== undefined && firstGuard < db;

    if (guarded) {
      console.log(`ok   ${rel} ${method} — authorizes before touching the database`);
    } else if (reason) {
      seen.add(`${rel} ${method}`);
      console.log(`ok   ${rel} ${method} — public: ${reason}`);
    } else {
      failures += 1;
      console.log(
        `FAIL ${rel} ${method} — supabaseAdmin() is constructed before any authorization.\n` +
          `     Move the guard above it, or use withCaller() from lib/route-auth.ts.\n` +
          `     If this handler genuinely has no caller to authorize, add\n` +
          `     '${rel} ${method}' to PUBLIC_HANDLERS with a reason — and expect\n` +
          `     that line to be questioned in review.`
      );
    }
  }
}

const unused = Object.keys(PUBLIC_HANDLERS).filter((k) => !seen.has(k));
for (const key of unused) {
  failures += 1;
  console.log(
    `FAIL ${key} is exempt in PUBLIC_HANDLERS but does not need to be —\n` +
      `     it either authorizes correctly now or no longer exists.\n` +
      `     Remove the entry; a stale exemption hides the next regression.`
  );
}

console.log(`\n${checked} handlers touch the database`);
if (failures > 0) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
console.log('all passed');
