/**
 * Scheduling rules: travel gaps, tight pairs, late collisions, day phrasing.
 *
 * These decide whether a 14-year-old gets double-booked across town, so the
 * table is pinned here rather than left to a build to notice.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/schedulingRules.ts', import.meta.url), 'utf8')
  .replace(/import[\s\S]*?from '\.\/supabase';/, '')
  .replace(/export async function blockOverlappingSlots[\s\S]*?\n}\n/, '')
  .replace(/export async function releaseBlockedSlots[\s\S]*?\n}\n/, '');

const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { requiredGapMinutes, findTightPairs, lateWouldCollide, whenPhrase, lateLabel } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log('— required gap —');
check('15-min job with travel -> 10 (floor)', requiredGapMinutes(15, true), 10);
check('60-min job with travel -> 30', requiredGapMinutes(60, true), 30);
check('180-min job with travel -> 45 (ceiling)', requiredGapMinutes(180, true), 45);
check('60-min job, no travel -> 0', requiredGapMinutes(60, false), 0);

const job = (id, start, end, loc = 'at_customer') => ({
  bookingId: id,
  serviceTitle: id,
  locationType: loc,
  startsAt: `2026-09-01T${start}:00Z`,
  endsAt: `2026-09-01T${end}:00Z`,
  clientName: 'C',
});

console.log('\n— tight pairs —');
check(
  'two 1h jobs 10 min apart, both away -> flagged',
  findTightPairs([job('a', '14:00', '15:00'), job('b', '15:10', '16:10')]).length,
  1
);
check(
  'same pair 45 min apart -> fine',
  findTightPairs([job('a', '14:00', '15:00'), job('b', '15:45', '16:45')]).length,
  0
);
check(
  'both at the provider’s own place, 5 min apart -> no alert',
  findTightPairs([
    job('a', '14:00', '15:00', 'at_provider'),
    job('b', '15:05', '16:05', 'at_provider'),
  ]).length,
  0
);
check(
  'one at provider, one away, 5 min apart -> flagged',
  findTightPairs([
    job('a', '14:00', '15:00', 'at_provider'),
    job('b', '15:05', '16:05', 'at_customer'),
  ]).length,
  1
);

const overlap = findTightPairs([job('a', '14:00', '15:00'), job('b', '14:30', '15:30')]);
check('genuinely overlapping pair is marked overlapping', overlap[0]?.overlapping, true);
check('overlapping gap is negative', overlap[0]?.gapMinutes, -30);

console.log('\n— late collisions —');
const first = job('a', '14:00', '15:00');
const next = job('b', '15:40', '16:40');
check('10 min late, 40 min gap, needs 30 -> no collision', lateWouldCollide(first, next, '10'), false);
check('20 min late, 40 min gap, needs 30 -> collides', lateWouldCollide(first, next, '20'), true);
check('30+ late always collides with a next job', lateWouldCollide(first, next, '30+'), true);
check('no next job -> never collides', lateWouldCollide(first, null, '30+'), false);

console.log('\n— phrasing —');
const now = new Date('2026-09-01T09:00:00Z');
check('same day -> today', whenPhrase('2026-09-01T14:00:00Z', now), 'today');
check('next day -> tomorrow', whenPhrase('2026-09-02T14:00:00Z', now), 'tomorrow');
check('within the week -> on <weekday>', whenPhrase('2026-09-04T14:00:00Z', now).startsWith('on '), true);
check('30+ reads as words', lateLabel('30+'), 'more than 30 minutes');
check('20 reads as minutes', lateLabel('20'), '20 minutes');

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
