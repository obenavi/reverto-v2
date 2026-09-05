/**
 * Nobody works at an empty house.
 *
 * Two arrangements, no third: the job is at the provider's own place, or it is
 * at the customer's and the customer is there for the whole of it. Most of
 * these cases exist to stop the rule quietly acquiring an exemption — the
 * previous version applied only when the provider was under 18, and the whole
 * point of this change is that it applies to everyone.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function load(file) {
  const js = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { presenceFor, needsCustomerPresent, checkPresence, presenceNotice, presenceLabel } =
  await load('lib/presence.ts');
const { agreedPaymentOptions } = await load('lib/catalog.ts');

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, `${label} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  console.log('ok  ', label);
  passed += 1;
}

const at = (location, confirmed) =>
  checkPresence({ location, confirmed, providerName: 'Maya' });

console.log('\n— the two arrangements —');
check('a job they host is at their place', presenceFor('at_provider'), 'at_provider');
check('a job at yours needs you there', presenceFor('at_customer'), 'customer_home');
check('and only that one asks anything of the customer', needsCustomerPresent('at_customer'), true);
check('their own place does not', needsCustomerPresent('at_provider'), false);

console.log('\n— confirming, or not —');
check('confirmed is allowed', at('at_customer', true).ok, true);
check('and records what was confirmed', at('at_customer', true).presence, 'customer_home');
check('unconfirmed is refused', at('at_customer', false).ok, false);
check('their place needs no confirmation', at('at_provider', false).ok, true);
check('and is still recorded correctly', at('at_provider', false).presence, 'at_provider');

console.log('\n— it fails closed —');
// The tempting shortcut is to default the confirmation to true and let the
// consent checkbox carry it, which makes the most important rule in the app
// the one nobody actively answered.
for (const missing of [undefined, null, 0, '', 'yes', 'true']) {
  check(
    `${JSON.stringify(missing)} is not a confirmation`,
    checkPresence({ location: 'at_customer', confirmed: missing === true, providerName: 'Maya' }).ok,
    false
  );
}

console.log('\n— what people are told —');
const refusal = at('at_customer', false);
check('the refusal says why', /empty house/i.test(refusal.message), true);
check('the notice for a job at yours does too', /empty house/i.test(presenceNotice({ location: 'at_customer', providerName: 'Maya' })), true);
check('the notice for their place says you go to them', /go to them/i.test(presenceNotice({ location: 'at_provider', providerName: 'Maya' })), true);
check('a finished booking reads back plainly', presenceLabel('customer_home'), 'At your place, with you there');

console.log('\n— the payment options a customer ticks —');
const offer = { offeredMethods: ['cash', 'venmo'], offeredCustoms: ['Bank transfer'] };
check(
  'several at once is the point',
  agreedPaymentOptions({ methods: ['cash', 'venmo'], customs: [], ...offer }).methods,
  ['cash', 'venmo']
);
check(
  'a method the provider never offered is dropped',
  agreedPaymentOptions({ methods: ['cash', 'zelle'], customs: [], ...offer }).methods,
  ['cash']
);
check(
  'a custom label they never wrote is dropped',
  agreedPaymentOptions({ methods: [], customs: ['Gold bars'], ...offer }).customs,
  []
);
check(
  'a custom label matches case-insensitively',
  agreedPaymentOptions({ methods: [], customs: ['bank TRANSFER'], ...offer }).customs,
  ['Bank transfer']
);
check(
  'and comes back in the provider’s own casing',
  agreedPaymentOptions({ methods: [], customs: ['bank transfer'], ...offer }).customs[0],
  'Bank transfer'
);
check(
  'nothing ticked is nothing agreed',
  agreedPaymentOptions({ methods: [], customs: [], ...offer }),
  { methods: [], customs: [] }
);
check(
  'a string where an array belongs is not a tick',
  agreedPaymentOptions({ methods: 'cash', customs: null, ...offer }),
  { methods: [], customs: [] }
);
check(
  'order follows the provider’s list, not the browser’s',
  agreedPaymentOptions({ methods: ['venmo', 'cash'], customs: [], ...offer }).methods,
  ['cash', 'venmo']
);

console.log(`\nall passed (${passed} assertions)`);
