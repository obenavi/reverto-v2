/**
 * The platform never moves money between two users.
 *
 * This is the load-bearing claim of the whole product's legal position. Taking
 * a neighbour's money and passing it to a provider is money transmission — a
 * licence in nearly every state, FinCEN registration, surety bonds, and the
 * platform standing between two people as the party that owes the money.
 *
 * It is also easy to undo by accident. The card path that used to exist was
 * switched off by filtering one array, which meant it was one line from being
 * back. So this file checks the property in the source rather than trusting
 * that nobody re-adds it: no charge, capture, refund or transfer against a
 * booking, and no way for a booking to be created with a card method.
 *
 * Stripe itself is not banned. It is how providers will be charged their
 * subscription, which is money moving from a user TO HelloNeighbor — a
 * different thing entirely, and not money transmission.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH_ROOTS = ['app', 'components', 'lib'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = SEARCH_ROOTS.flatMap((d) => (existsSync(join(root, d)) ? walk(join(root, d)) : []));
assert.ok(files.length > 50, 'expected to find the app source');

let checks = 0;
const failures = [];

function forbid(pattern, why, { except = [] } = {}) {
  for (const file of files) {
    const rel = relative(root, file);
    if (except.includes(rel)) continue;
    const source = readFileSync(file, 'utf8');
    for (const [index, line] of source.split('\n').entries()) {
      if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;
      if (pattern.test(line)) {
        failures.push(`${rel}:${index + 1} — ${why}\n    ${line.trim()}`);
      }
    }
  }
  checks += 1;
}

// --- Nothing may move a customer's money ------------------------------------
forbid(/paymentIntents\s*\.\s*(create|capture|confirm|cancel)/, 'creates or settles a payment between users');
forbid(/\brefunds\s*\.\s*create\b/, 'refunds a payment the platform never held');
forbid(/\btransfers\s*\.\s*create\b/, 'pays money out to a user');
forbid(/\bpayouts\s*\.\s*create\b/, 'pays money out to a user');
forbid(/stripeAccount|accounts\s*\.\s*create|Connect\b/, 'Stripe Connect makes the platform the payment intermediary');
forbid(/client_secret|clientSecret/, 'a client secret means a card is being taken in the app');

// --- Nor may a booking be created that expects one ---------------------------
forbid(/stripe_payment_intent_id/, 'reads or writes the retired card-hold column');

// --- The offered methods are the settled-directly ones ----------------------
const catalog = readFileSync(join(root, 'lib', 'catalog.ts'), 'utf8');
const offered = catalog.slice(
  catalog.indexOf('export const PAYMENT_METHODS'),
  catalog.indexOf('RETIRED_PAYMENT_METHODS')
);
assert.ok(offered.length > 100, 'could not find the offered payment methods');
assert.ok(
  !/value:\s*'stripe'/.test(offered),
  "PAYMENT_METHODS offers 'stripe' — a card taken by the platform is money transmission"
);
checks += 1;

for (const method of ['cash', 'venmo', 'cashapp', 'zelle', 'paypal']) {
  assert.ok(
    new RegExp(`value: '${method}'`).test(offered),
    `${method} should still be offered — it settles directly between the two people`
  );
  checks += 1;
}

// --- And the terms have to say so -------------------------------------------
const liability = readFileSync(join(root, 'lib', 'liability.ts'), 'utf8');
assert.ok(
  /does not process payments between users/i.test(liability),
  'the terms no longer state plainly that no payment passes between users'
);
assert.ok(
  /customer\.payment\.v2/.test(liability),
  'the customer payment consent still points at the v1 text, which described a card hold'
);
assert.ok(
  /provider\.payment\.v1/.test(liability),
  'providers should acknowledge that they collect their own money'
);
checks += 3;

// The guidelines are the plain-language copy everyone reads and ticks, and
// they described a card hold long after the card path was switched off. They
// are checked separately from the terms for exactly that reason.
const guidelines = readFileSync(join(root, 'lib', 'guidelines.ts'), 'utf8');
assert.ok(
  !/authorized when the booking is made|charged only after/i.test(guidelines),
  'the guidelines still describe a card hold the platform no longer takes'
);
assert.ok(
  /not a payment service|no money passes through/i.test(guidelines),
  'the guidelines should say plainly that HelloNeighbor is not a payment service'
);
assert.ok(
  /only money HelloNeighbor ever takes[^.]*subscription/i.test(guidelines),
  'the guidelines should name the subscription as the only money the platform takes'
);
assert.ok(
  /decides how the payment is settled/i.test(guidelines) === false,
  'the guidelines still promise a dispute decides the payment, which it cannot'
);
checks += 4;

// --- Report ------------------------------------------------------------------
if (failures.length > 0) {
  console.error('\nThe platform is handling money between users:\n');
  for (const f of failures) console.error('  ' + f);
  console.error('');
  process.exit(1);
}

console.log(`no-customer-payments: ${checks} checks passed across ${files.length} files`);
