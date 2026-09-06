/**
 * When the subscription clock starts, and how a month is counted.
 *
 * Both halves cost real money if they are wrong: an early start charges for a
 * month the account could not work, and a bad month boundary either bills twice
 * or skips a cycle.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

// Strip the server-only imports; every function under test here is pure.
const src = readFileSync(new URL('../lib/billing.ts', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/export async function startBillingIfReady[\s\S]*$/m, '')
  + '\nconst MINOR_BADGE_LIMIT = 18;\n'
  // billingState calls isFree from lib/promos; inline the real implementation
  // rather than a stub, so a change to it shows up here.
  + readFileSync(new URL('../lib/promos.ts', import.meta.url), 'utf8')
      .match(/export function isFree[\s\S]*?\n}/)[0]
      .replace('export ', '')
  // Same for the pilot switch: the real implementations, so a change to either
  // one shows up as a billing failure rather than passing against a stub.
  + '\n'
  + readFileSync(new URL('../lib/pilot.ts', import.meta.url), 'utf8')
      .match(/export function pilotFreeUntil[\s\S]*?\n}/)[0]
      .replace('export ', '')
  + '\n'
  + readFileSync(new URL('../lib/pilot.ts', import.meta.url), 'utf8')
      .match(/export function effectiveFreeUntil[\s\S]*?\n}/)[0]
      .replace('export ', '')
  + '\nlet warned = false;\n'
  // And the free-tier check, from the real plan table — so making Basic paid
  // again shows up here as a billing failure.
  + readFileSync(new URL('../lib/plans.ts', import.meta.url), 'utf8')
      .match(/export const PLANS[\s\S]*?\n};/)[0]
      .replace('export ', '')
  + '\n'
  + readFileSync(new URL('../lib/plans.ts', import.meta.url), 'utf8')
      .match(/export function isFreePlan[\s\S]*?\n}/)[0]
      .replace('export ', '');

const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { addMonth, billingState, supervisionSettled } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const month = (iso) => addMonth(new Date(iso)).toISOString();

console.log('— a month later —');
check('mid-month is unremarkable', month('2026-03-15T10:00:00Z'), '2026-04-15T10:00:00.000Z');
check('the time of day is kept', month('2026-03-15T23:59:59Z'), '2026-04-15T23:59:59.000Z');
check('December rolls the year', month('2026-12-10T00:00:00Z'), '2027-01-10T00:00:00.000Z');

console.log('\n— short months, which is where this goes wrong —');
// setMonth would turn this into 3 March and skip a billing month entirely.
check('31 Jan clamps to 28 Feb', month('2027-01-31T09:00:00Z'), '2027-02-28T09:00:00.000Z');
check('31 Jan clamps to 29 Feb in a leap year', month('2028-01-31T09:00:00Z'), '2028-02-29T09:00:00.000Z');
check('31 Mar clamps to 30 Apr', month('2026-03-31T09:00:00Z'), '2026-04-30T09:00:00.000Z');
check('30 Apr stays the 30th', month('2026-04-30T09:00:00Z'), '2026-05-30T09:00:00.000Z');
check('29 Feb in a leap year lands on 29 Mar', month('2028-02-29T09:00:00Z'), '2028-03-29T09:00:00.000Z');

console.log('\n— who is settled —');
check('an adult needs nobody', supervisionSettled(19, 'none'), true);
check('18 is an adult here', supervisionSettled(18, 'none'), true);
check('17 with nobody behind them is not settled', supervisionSettled(17, 'none'), false);
check('a waiver settles it', supervisionSettled(17, 'waiver'), true);
check('a linked parent settles it', supervisionSettled(14, 'parent_account'), true);
check('14 with nobody is not settled', supervisionSettled(14, 'none'), false);

console.log('\n— what the dashboard is told —');
// A PAID plan by default, because these cases are about when charging starts
// and on the free tier it never does. The free tier gets its own block below.
const row = (over) => ({
  age: 15, supervision: 'none', status: 'active', plan: 'pro',
  plan_started_at: null, plan_renews_at: null, ...over,
});

check('no adult yet: not charged', billingState(row({})).reason, 'awaiting_adult');
check('adult, but no anchor set: not charged', billingState(row({ supervision: 'waiver' })).reason, 'awaiting_approval');
check('anchor set: charging', billingState(row({
  supervision: 'parent_account', plan_started_at: '2026-08-01T00:00:00Z',
})).reason, 'billing');

// The trap: an account with an anchor whose parent later unlinked. It stops
// being able to work, and must stop reading as "billing".
check('losing the adult stops the charge reading', billingState(row({
  supervision: 'none', plan_started_at: '2026-08-01T00:00:00Z',
})).reason, 'awaiting_adult');

console.log('\n— a free period —');
const future = new Date(Date.now() + 30 * 86400000).toISOString();
const past = new Date(Date.now() - 1 * 86400000).toISOString();

check('inside a promo reads as free', billingState(row({
  supervision: 'waiver', plan_started_at: '2026-08-01T00:00:00Z', free_until: future,
})).reason, 'free_period');
check('and reports the date', billingState(row({
  supervision: 'waiver', free_until: future,
})).freeUntil, future);
check('an expired promo goes back to billing', billingState(row({
  supervision: 'waiver', plan_started_at: '2026-08-01T00:00:00Z', free_until: past,
})).reason, 'billing');
check('no promo is unaffected', billingState(row({
  supervision: 'waiver', plan_started_at: '2026-08-01T00:00:00Z',
})).reason, 'billing');
// The one that matters: a promo does not let an unsupervised minor operate.
// It only means nobody is charged for an account they cannot use.
console.log('\n— the free tier —');
// Basic costs nothing, so none of the "when does charging start" answers apply
// to it, and showing one would be telling somebody a false thing about money.
const free = (over) => billingState(row({ plan: 'basic', supervision: 'waiver', ...over })).reason;
check('a free plan is its own state', free({}), 'free_plan');
check('being approved does not change it', free({ plan_started_at: '2026-08-01T00:00:00Z' }), 'free_plan');
check('nor does a promo on top of it', free({ free_until: '2099-01-01T00:00:00Z' }), 'free_plan');
check('and no renewal date is offered', billingState(row({
  plan: 'basic', supervision: 'waiver', plan_renews_at: '2026-10-01T00:00:00Z',
})).renewsAt, null);
// The one thing that still outranks it: a minor with nobody behind them cannot
// take work, free or not.
check('no adult still comes first', free({ supervision: 'none' }), 'awaiting_adult');

check('supervision still comes first', billingState(row({
  supervision: 'none', free_until: future,
})).reason, 'awaiting_adult');

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
