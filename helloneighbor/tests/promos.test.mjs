/**
 * Promotion codes.
 *
 * Two failures matter: a code that keeps working after it should stop, and a
 * refusal message that tells a stranger which codes are real.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/promos.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { normalizePromoCode, checkPromo, extendFreeUntil, isFree, freeDaysLeft } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log('— the code itself —');
check('a plain code normalizes', normalizePromoCode('FREEMONTH'), 'FREEMONTH');
check('lowercase is fine', normalizePromoCode('freemonth'), 'FREEMONTH');
check('whitespace is trimmed', normalizePromoCode('  FREE MONTH '), 'FREEMONTH');
check('dashes are allowed', normalizePromoCode('EARLY-2026'), 'EARLY-2026');
check('too short is rejected', normalizePromoCode('AB'), null);
check('empty is rejected', normalizePromoCode(''), null);
check('a leading dash is rejected', normalizePromoCode('-NOPE'), null);
check('symbols are rejected', normalizePromoCode('FREE!MONTH'), null);
// Long enough not to be guessed in a handful of tries.
check('over 32 characters is rejected', normalizePromoCode('A'.repeat(33)), null);

console.log('\n— when a code works —');
const NOW = new Date('2026-09-15T12:00:00Z');
const promo = (over = {}) => ({
  id: 'p1', code: 'FREEMONTH', description: 'Early testers',
  freeDays: 30, maxRedemptions: null, redemptions: 0,
  expiresAt: null, active: true, ...over,
});
const run = (over = {}, already = false) =>
  checkPromo({ promo: promo(over), alreadyRedeemed: already, now: NOW });

check('a live code works', run().ok, true);
check('and gives its days', run().freeDays, 30);
check('an inactive code does not', run({ active: false }).ok, false);
check('an expired code does not', run({ expiresAt: '2026-09-01T00:00:00Z' }).ok, false);
check('expiring exactly now does not', run({ expiresAt: '2026-09-15T12:00:00Z' }).ok, false);
check('expiring tomorrow does', run({ expiresAt: '2026-09-16T00:00:00Z' }).ok, true);
check('an exhausted code does not', run({ maxRedemptions: 5, redemptions: 5 }).ok, false);
check('one under the cap does', run({ maxRedemptions: 5, redemptions: 4 }).ok, true);
check('unlimited never exhausts', run({ maxRedemptions: null, redemptions: 9999 }).ok, true);
check('a missing code does not', checkPromo({ promo: null, alreadyRedeemed: false, now: NOW }).ok, false);

console.log('\n— refusals must not leak which codes exist —');
// A code is a short guessable string. Distinguishing "no such code" from
// "used up" tells someone probing which strings are real.
const messages = [
  checkPromo({ promo: null, alreadyRedeemed: false, now: NOW }).message,
  run({ active: false }).message,
  run({ expiresAt: '2026-09-01T00:00:00Z' }).message,
  run({ maxRedemptions: 1, redemptions: 1 }).message,
];
check('every refusal reads the same', new Set(messages).size, 1);
// Except this one: somebody who already used a code and forgot is not probing,
// and "not valid" would send them to support for nothing.
check('already-redeemed is named', run({}, true).reason, 'already_redeemed');
check('and says so plainly', run({}, true).message.includes('already used'), true);
check('which is a different message', messages.includes(run({}, true).message), false);

console.log('\n— extending the free period —');
const from = (current, days) =>
  extendFreeUntil({ currentFreeUntil: current, freeDays: days, now: NOW });

check('no existing date starts from now', from(null, 30), '2026-10-15T12:00:00.000Z');
// The case that makes a second code worth redeeming: it ADDS.
check('an existing future date is extended', from('2026-10-15T12:00:00Z', 30), '2026-11-14T12:00:00.000Z');
// Overwriting here would silently take 60 days away from a 90-day holder.
check('a shorter code never shortens a longer one',
  new Date(from('2026-12-15T12:00:00Z', 30)) > new Date('2026-12-15T12:00:00Z'), true);
// Adding to a past date would give less than the code promised.
check('an expired date starts from now instead', from('2026-01-01T00:00:00Z', 30), '2026-10-15T12:00:00.000Z');

console.log('\n— where somebody stands —');
check('a future date is free', isFree('2026-10-01T00:00:00Z', NOW), true);
check('a past date is not', isFree('2026-09-01T00:00:00Z', NOW), false);
check('exactly now is not', isFree('2026-09-15T12:00:00Z', NOW), false);
check('no date is not', isFree(null, NOW), false);

check('days left rounds up', freeDaysLeft('2026-09-25T18:00:00Z', NOW), 11);
check('a past date is zero, never negative', freeDaysLeft('2026-01-01T00:00:00Z', NOW), 0);
check('no date is zero', freeDaysLeft(null, NOW), 0);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
