/**
 * The switch that makes the whole app free for a pilot.
 *
 * The interesting cases are the two failure directions, and they are not
 * symmetric. A pilot that quietly fails to start is annoying. A typo that
 * silently means "free forever" turns off the only revenue the product has,
 * and nothing about the running app would look wrong while it happened — so
 * an unreadable value is ignored, and that is what most of this file checks.
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

const { pilotFreeUntil, effectiveFreeUntil, inPilot } = await load('lib/pilot.ts');

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, `${label} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  console.log('ok  ', label);
  passed += 1;
}

console.log('\n— reading the date —');
check('a plain ISO date', pilotFreeUntil('2026-12-31'), '2026-12-31T00:00:00.000Z');
check('a full timestamp', pilotFreeUntil('2026-12-31T18:00:00Z'), '2026-12-31T18:00:00.000Z');
check('surrounding whitespace', pilotFreeUntil('  2026-12-31  '), '2026-12-31T00:00:00.000Z');
check('unset means no pilot', pilotFreeUntil(undefined), null);
check('empty means no pilot', pilotFreeUntil(''), null);
check('whitespace means no pilot', pilotFreeUntil('   '), null);

console.log('\n— a typo must not mean "free forever" —');
// Each of these is something a person plausibly types into a dashboard field.
for (const bad of ['soon', 'next year', 'yes', 'true', '31/12/2026', 'forever', '2026-13-45']) {
  check(`${JSON.stringify(bad)} is ignored`, pilotFreeUntil(bad), null);
}

console.log('\n— the later of the two always wins —');
const PILOT = '2026-12-31T00:00:00.000Z';
check('no promo, pilot applies', effectiveFreeUntil(null, PILOT), PILOT);
check('no pilot, promo applies', effectiveFreeUntil('2026-10-01T00:00:00.000Z', null), '2026-10-01T00:00:00.000Z');
check('neither', effectiveFreeUntil(null, null), null);
check(
  'a promo running past the pilot is not cut short',
  effectiveFreeUntil('2027-06-01T00:00:00.000Z', PILOT),
  '2027-06-01T00:00:00.000Z'
);
check(
  'an expired promo does not pull somebody out of the pilot',
  effectiveFreeUntil('2020-01-01T00:00:00.000Z', PILOT),
  PILOT
);
check('an empty column is the same as none', effectiveFreeUntil('', PILOT), PILOT);

console.log('\n— whether a pilot is running —');
// inPilot reads the environment, so set it around each case.
const original = process.env.PILOT_FREE_UNTIL;
process.env.PILOT_FREE_UNTIL = '2099-01-01';
check('a future date is a running pilot', inPilot(new Date('2026-09-06')), true);
process.env.PILOT_FREE_UNTIL = '2020-01-01';
check('a past date is a finished pilot', inPilot(new Date('2026-09-06')), false);
delete process.env.PILOT_FREE_UNTIL;
check('no date is no pilot', inPilot(new Date('2026-09-06')), false);
if (original === undefined) delete process.env.PILOT_FREE_UNTIL;
else process.env.PILOT_FREE_UNTIL = original;

console.log('\n— it ends on its own —');
// The whole point of a date rather than a boolean: nobody has to remember.
check(
  'the day after is not free',
  inPilot.length >= 0 && effectiveFreeUntil(null, PILOT) < '2027-01-01T00:00:00.000Z',
  true
);

console.log('\n— it is wired into billing —');
const billing = readFileSync(join(root, 'lib/billing.ts'), 'utf8');
assert.ok(
  /effectiveFreeUntil/.test(billing),
  'billingState must go through the pilot, or a pilot bills people anyway'
);
assert.ok(
  !/isFree\(row\.free_until\)/.test(billing),
  'billingState is reading the raw column again, which skips the pilot'
);
assert.ok(
  /effectiveFreeUntil\(data\.free_until\)/.test(billing),
  'the renewal anchor must respect the pilot too, or the first bill lands mid-pilot'
);
passed += 3;

console.log('\n— supervision still comes first —');
// A minor with no adult behind them cannot work. Free does not change that.
assert.ok(
  billing.indexOf('supervisionSettled') < billing.indexOf('isFree('),
  'the adult check has to run before the free check'
);
passed += 1;

console.log(`\nall passed (${passed} assertions)`);
