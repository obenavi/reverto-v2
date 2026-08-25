/**
 * Curfew: how late a young person may still be working.
 *
 * The rule is about the END of a job, not its start, and it is a wall-clock
 * rule, so every case here is written in local time and converted to the UTC
 * instant the database would actually store.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/curfew.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  PLATFORM_CURFEW_MINUTES,
  CURFEW_AGE_LIMIT,
  formatCurfew,
  effectiveCurfewMinutes,
  localMinutes,
  localDateKey,
  withinCurfew,
  latestStartMinutes,
  isValidTimezone,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const NY = 'America/New_York';
// New York is UTC-4 in summer (EDT) and UTC-5 in winter (EST).
const summer = (localHour, localMin = 0) =>
  new Date(Date.UTC(2026, 6, 15, localHour + 4, localMin)).toISOString();
const winter = (localHour, localMin = 0) =>
  new Date(Date.UTC(2026, 11, 15, localHour + 5, localMin)).toISOString();

console.log('— the platform floor —');
check('platform curfew is 9pm', PLATFORM_CURFEW_MINUTES, 21 * 60);
check('it applies to everyone under 18', CURFEW_AGE_LIMIT, 18);
check('9pm formats as 9pm', formatCurfew(PLATFORM_CURFEW_MINUTES), '9pm');
check('7:30pm formats with minutes', formatCurfew(19 * 60 + 30), '7:30pm');
check('noon is 12pm, not 0pm', formatCurfew(12 * 60), '12pm');
check('midnight is 12am', formatCurfew(0), '12am');

console.log('\n— stricter wins —');
check('a 15-year-old gets the platform cap', effectiveCurfewMinutes(15, null), 21 * 60);
check('an adult has no curfew by default', effectiveCurfewMinutes(19, null), null);
check('a parent limit of 7pm beats the 9pm cap', effectiveCurfewMinutes(15, 19 * 60), 19 * 60);
check('a parent cannot push past 9pm', effectiveCurfewMinutes(15, 23 * 60), 21 * 60);
check('a parent limit still binds an 18-year-old they set it on', effectiveCurfewMinutes(18, 20 * 60), 20 * 60);
// The birthday is the boundary: 17 is capped, 18 is not.
check('17 is capped', effectiveCurfewMinutes(17, null), 21 * 60);
check('18 is not', effectiveCurfewMinutes(18, null), null);

console.log('\n— reading the clock in the right zone —');
check('8pm EDT reads as 8pm', localMinutes(new Date(summer(20)), NY), 20 * 60);
check('8pm EST reads as 8pm too', localMinutes(new Date(winter(20)), NY), 20 * 60);
check('local midnight is 0, not 1440', localMinutes(new Date(summer(24)), NY), 0);
check('the date key follows the zone', localDateKey(new Date(summer(20)), NY), '2026-07-15');
// 8pm in New York is already tomorrow in UTC — a naive UTC read gets this wrong.
check('a late job is still today locally', localDateKey(new Date('2026-07-16T00:30:00Z'), NY), '2026-07-15');

console.log('\n— the case that started this: two hours at 7:30pm —');
const twoHoursAt730 = withinCurfew({
  startsAt: summer(19, 30), durationMin: 120, timezone: NY, curfewMinutes: 21 * 60,
});
check('7:30pm + 2h is refused', twoHoursAt730.allowed, false);
check('because it ends at 9:30pm', twoHoursAt730.endsAtMinutes, 21 * 60 + 30);

const twoHoursAt7 = withinCurfew({
  startsAt: summer(19), durationMin: 120, timezone: NY, curfewMinutes: 21 * 60,
});
check('7:00pm + 2h lands exactly on curfew and is allowed', twoHoursAt7.allowed, true);

// One minute later is the whole point of checking the end time.
check('7:01pm + 2h is refused', withinCurfew({
  startsAt: summer(19, 1), durationMin: 120, timezone: NY, curfewMinutes: 21 * 60,
}).allowed, false);

console.log('\n— a short job at the same hour is fine —');
check('7:30pm + 30min is allowed', withinCurfew({
  startsAt: summer(19, 30), durationMin: 30, timezone: NY, curfewMinutes: 21 * 60,
}).allowed, true);

console.log('\n— a tighter parent curfew —');
check('7:30pm + 30min is refused under a 7pm parent curfew', withinCurfew({
  startsAt: summer(19, 30), durationMin: 30, timezone: NY, curfewMinutes: 19 * 60,
}).allowed, false);

console.log('\n— daylight saving —');
// Same wall-clock job, six months apart, different UTC offsets. Both must agree.
check('8pm + 1h in July is allowed', withinCurfew({
  startsAt: summer(20), durationMin: 60, timezone: NY, curfewMinutes: 21 * 60,
}).allowed, true);
check('8pm + 1h in December is allowed', withinCurfew({
  startsAt: winter(20), durationMin: 60, timezone: NY, curfewMinutes: 21 * 60,
}).allowed, true);
check('8:30pm + 1h in December is refused', withinCurfew({
  startsAt: winter(20, 30), durationMin: 60, timezone: NY, curfewMinutes: 21 * 60,
}).allowed, false);

console.log('\n— running past midnight —');
// 2am looks like a very early finish if you only compare times.
const overnight = withinCurfew({
  startsAt: summer(23), durationMin: 180, timezone: NY, curfewMinutes: 21 * 60,
});
check('11pm + 3h is refused', overnight.allowed, false);
check('and is flagged as crossing midnight', overnight.crossesMidnight, true);
check('even though it "ends at 2am"', overnight.endsAtMinutes, 2 * 60);

console.log('\n— latest possible start —');
check('a 2h job must start by 7pm', latestStartMinutes(21 * 60, 120), 19 * 60);
check('a 30min job must start by 8:30pm', latestStartMinutes(21 * 60, 30), 20 * 60 + 30);
check('a 3h job under a 7pm curfew must start by 4pm', latestStartMinutes(19 * 60, 180), 16 * 60);

console.log('\n— the timezone comes from the browser, so it is untrusted —');
check('a real zone is accepted', isValidTimezone('America/Chicago'), true);
check('nonsense is rejected', isValidTimezone('Mars/Olympus_Mons'), false);
check('empty is rejected', isValidTimezone(''), false);
check('a non-string is rejected', isValidTimezone(42), false);
check('UTC is a real zone', isValidTimezone('UTC'), true);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
