/**
 * Plan limits and the weekly window.
 *
 * The week boundary decides when someone's profile stops being sold out, so an
 * off-by-one here is a day of lost work for a real person.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/plans.ts', import.meta.url), 'utf8')
  .replace(/import type[\s\S]*?from '\.\/types';/, '');

const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { PLANS, capacity, weekStart, weekEnd, kindAllowedOnPlan, plan, planPrice, isFreePlan } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log('— prices —');
// Basic being free is the whole shape of the pricing, not a placeholder. A
// paid entry tier charges the hardest side of the marketplace before anybody
// has been booked, and makes the fee flat while the plan caps the earnings.
check('basic is free', PLANS.basic.priceCents, 0);
check('and reads as free rather than $0', planPrice('basic'), 'Free');
check('pro is $25', PLANS.pro.priceCents, 2500);
check('pro+ is $30', PLANS.pro_plus.priceCents, 3000);
check('every paid plan costs more than the free one', [PLANS.pro.priceCents, PLANS.pro_plus.priceCents].every((c) => c > PLANS.basic.priceCents), true);

console.log('\n— what each plan allows —');
check('basic allows one service', PLANS.basic.maxServices, 1);
check('basic caps bookings at 2 a week', PLANS.basic.weeklyBookings, 2);
// A free tier with no ceiling is not a free tier. Both limits have to exist,
// or there is nothing to upgrade for and no reason anyone ever pays.
check('the free tier is limited on both axes', [PLANS.basic.maxServices, PLANS.basic.weeklyBookings].every((v) => typeof v === 'number' && v > 0), true);
check('pro has no service cap', PLANS.pro.maxServices, null);
check('pro has no weekly cap', PLANS.pro.weeklyBookings, null);
check('only pro+ covers more than one kid', [PLANS.basic.maxProfiles, PLANS.pro.maxProfiles, PLANS.pro_plus.maxProfiles], [1, 1, 3]);

console.log('\n— the premade list —');
check('basic may list a car wash', kindAllowedOnPlan('basic', 'car'), true);
check('basic may NOT write its own', kindAllowedOnPlan('basic', 'other'), false);
check('pro may write its own', kindAllowedOnPlan('pro', 'other'), true);
check('an unknown plan falls back to basic', plan(null).id, 'basic');

console.log('\n— the weekly cap —');
check('1 of 2 used is not sold out', capacity('basic', 1).soldOut, false);
check('2 of 2 used is sold out', capacity('basic', 2).soldOut, true);
check('over the cap stays sold out', capacity('basic', 9).soldOut, true);
check('remaining never goes negative', capacity('basic', 9).remaining, 0);
check('pro is never sold out', capacity('pro', 500).soldOut, false);

console.log('\n— the week window —');
// 2026-09-02 is a Wednesday.
const wed = new Date('2026-09-02T12:00:00Z');
check('week starts Monday', weekStart(wed).toISOString(), '2026-08-31T00:00:00.000Z');
check('week ends the next Monday', weekEnd(wed).toISOString(), '2026-09-07T00:00:00.000Z');

// Sunday is the trap: getUTCDay() is 0, so a naive shift lands a week early.
const sun = new Date('2026-09-06T23:59:00Z');
check('Sunday still belongs to the Monday that began it', weekStart(sun).toISOString(), '2026-08-31T00:00:00.000Z');
check('Monday 00:00 is its own week start', weekStart(new Date('2026-08-31T00:00:00Z')).toISOString(), '2026-08-31T00:00:00.000Z');
check('the following Monday starts a new week', weekStart(new Date('2026-09-07T00:00:00Z')).toISOString(), '2026-09-07T00:00:00.000Z');

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
