/**
 * Who says the money changed hands.
 *
 * The rule under test is that the PROVIDER's word settles a booking. A
 * customer saying "I paid" is a claim — a transfer sent to the wrong handle
 * looks identical to a good one from the sender's side, and the person who
 * would notice is the one who did not receive it. Several cases below exist
 * only to stop somebody "simplifying" that into "either side can close it".
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function load(file) {
  const source = readFileSync(join(root, file), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const {
  summarize,
  latestByParty,
  canClaim,
  derivedPaymentStatus,
  proofRejection,
  PROOF_WARNING,
  MAX_PROOF_BYTES,
} = await load('lib/receipts.ts');

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, `${label} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  console.log('ok  ', label);
  passed += 1;
}

const at = (n) => new Date(Date.UTC(2026, 8, 5, 12, n)).toISOString();
const say = (party, claim, minute, hasProof = false) => ({
  party,
  claim,
  createdAt: at(minute),
  hasProof,
});

const state = (rows) => summarize(rows, 'Maya').state;

console.log('\n— the provider settles it —');
check('nobody has said anything', state([]), 'unclaimed');
check('the customer alone does not settle it', state([say('customer', 'paid', 1)]), 'awaiting_provider');
check('the provider alone does', state([say('provider', 'paid', 1)]), 'settled');
check('both agreeing settles it', state([say('customer', 'paid', 1), say('provider', 'paid', 2)]), 'settled');
check('the provider saying no is not settled', state([say('provider', 'not_paid', 1)]), 'unpaid');
check('order does not matter', state([say('provider', 'paid', 5), say('customer', 'paid', 1)]), 'settled');

console.log('\n— a disagreement stays a disagreement —');
const clash = [say('customer', 'paid', 1), say('provider', 'not_paid', 2)];
check('is its own state', state(clash), 'disputed');
check('and is flagged as a conflict', summarize(clash, 'Maya').conflict, true);
check('a settled booking is not', summarize([say('provider', 'paid', 1)], 'Maya').conflict, false);
check('the customer alone is not either', summarize([say('customer', 'paid', 1)], 'Maya').conflict, false);

console.log('\n— corrections append, they do not overwrite —');
const corrected = [say('provider', 'not_paid', 1), say('provider', 'paid', 9)];
check('the later word wins', state(corrected), 'settled');
check('and the earlier one is still in the list', corrected.length, 2);
const reversed = [say('provider', 'paid', 1), say('provider', 'not_paid', 9)];
check('a correction can go the other way too', state(reversed), 'unpaid');
check('latestByParty picks by time, not position', latestByParty(reversed).provider.claim, 'not_paid');
check('and returns null for a silent party', latestByParty(reversed).customer, null);
check('same-minute claims do not throw', typeof state([say('provider', 'paid', 3), say('provider', 'not_paid', 3)]), 'string');

console.log('\n— what the buttons offer —');
check('a fresh booking offers both to the customer', canClaim('customer', 'paid', []), true);
check('and both to the provider', canClaim('provider', 'not_paid', []), true);
check('saying the same thing twice is not offered', canClaim('provider', 'paid', [say('provider', 'paid', 1)]), false);
check('but the opposite still is', canClaim('provider', 'not_paid', [say('provider', 'paid', 1)]), true);
check("one party's claim does not silence the other", canClaim('customer', 'paid', [say('provider', 'paid', 1)]), true);

console.log('\n— the column the dashboard already renders —');
check('settled reads as captured', derivedPaymentStatus('settled'), 'captured');
check('a disagreement does not', derivedPaymentStatus('disputed'), 'pending');
check('nor does the customer alone', derivedPaymentStatus('awaiting_provider'), 'pending');
check('nor unpaid', derivedPaymentStatus('unpaid'), 'pending');

console.log('\n— proof —');
check('a screenshot is fine', proofRejection({ type: 'image/png', size: 1000 }), null);
check('a PDF is fine', proofRejection({ type: 'application/pdf', size: 1000 }), null);
check('a video is not', typeof proofRejection({ type: 'video/mp4', size: 1000 }), 'string');
check('an executable is not', typeof proofRejection({ type: 'application/x-msdownload', size: 10 }), 'string');
check('an empty file is not', typeof proofRejection({ type: 'image/png', size: 0 }), 'string');
check('an oversized one is not', typeof proofRejection({ type: 'image/png', size: MAX_PROOF_BYTES + 1 }), 'string');
check('exactly at the limit is', proofRejection({ type: 'image/png', size: MAX_PROOF_BYTES }), null);

console.log('\n— the warning above the file picker —');
check('says the other person sees it', /other side of this booking will see/i.test(PROOF_WARNING), true);
check('and says why that matters', /balance/i.test(PROOF_WARNING), true);

console.log('\n— the platform does not settle anything —');
const headline = summarize(clash, 'Maya').headline;
check('a clash points at the two of them, not at us', /open a dispute|sort it out/i.test(headline), true);
check('and never promises a refund', /refund|we will settle|we decide/i.test(headline), false);

console.log(`\nall passed (${passed} assertions)`);
