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
const { PLANS, capacity, weekStart, weekEnd, kindAllowedOnPlan, plan } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log('— prices —');
check('basic is $15', PLANS.basic.priceCents, 1500);
check('pro is $25', PLANS.pro.priceCents, 2500);
check('pro+ is $30', PLANS.pro_plus.priceCents, 3000);

console.log('\n— what each plan allows —');
check('basic caps services at 3', PLANS.basic.maxServices, 3);
check('basic caps bookings at 4 a week', PLANS.basic.weeklyBookings, 4);
check('pro has no service cap', PLANS.pro.maxServices, null);
check('pro has no weekly cap', PLANS.pro.weeklyBookings, null);
check('only pro+ covers more than one kid', [PLANS.basic.maxProfiles, PLANS.pro.maxProfiles, PLANS.pro_plus.maxProfiles], [1, 1, 3]);

console.log('\n— the premade list —');
check('basic may list a car wash', kindAllowedOnPlan('basic', 'car'), true);
check('basic may NOT write its own', kindAllowedOnPlan('basic', 'other'), false);
check('pro may write its own', kindAllowedOnPlan('pro', 'other'), true);
check('an unknown plan falls back to basic', plan(null).id, 'basic');

console.log('\n— the weekly cap —');
check('3 of 4 used is not sold out', capacity('basic', 3).soldOut, false);
check('4 of 4 used is sold out', capacity('basic', 4).soldOut, true);
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
