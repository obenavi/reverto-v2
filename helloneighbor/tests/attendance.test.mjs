/**
 * Check-in, check-out, and the missing check-out.
 *
 * Two failures matter in opposite directions: a young person still at a
 * stranger's house that nobody notices, and a parent paged every third booking
 * because a kid put their phone in a drawer. The second is the one that
 * destroys the first — an alert everyone learns to ignore is worse than none.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/attendance.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  attendanceState, canCheckIn, canCheckOut, minutesOnSite, ranPastCurfew,
  attendanceLabel, OVERDUE_GRACE_MINUTES, EARLY_CHECK_IN_MINUTES,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

// A job from 2pm to 3pm.
const booking = (over = {}) => ({
  status: 'confirmed',
  startsAt: '2026-09-15T14:00:00Z',
  endsAt: '2026-09-15T15:00:00Z',
  checkedInAt: null,
  checkedOutAt: null,
  ...over,
});
const at = (iso) => new Date(iso);

console.log('— where a booking is —');
check('before the job: upcoming', attendanceState(booking(), at('2026-09-15T13:00:00Z')), 'upcoming');
check('checked in, mid-job: on site',
  attendanceState(booking({ checkedInAt: '2026-09-15T14:02:00Z' }), at('2026-09-15T14:30:00Z')), 'on_site');
check('checked in and out: complete',
  attendanceState(booking({ checkedInAt: '2026-09-15T14:02:00Z', checkedOutAt: '2026-09-15T14:58:00Z' }),
    at('2026-09-15T16:00:00Z')), 'complete');
// Never checked in at all is not an alarm — plenty of people will forget the
// first tap too, and there is nothing to escalate about.
check('never checked in, job over: no record',
  attendanceState(booking(), at('2026-09-15T16:00:00Z')), 'no_record');

console.log('\n— the grace period —');
const onSite = booking({ checkedInAt: '2026-09-15T14:02:00Z' });
check('ten minutes over: still on site', attendanceState(onSite, at('2026-09-15T15:10:00Z')), 'on_site');
check('forty minutes over: still on site', attendanceState(onSite, at('2026-09-15T15:40:00Z')), 'on_site');
check('at the grace boundary: still on site', attendanceState(onSite, at('2026-09-15T15:45:00Z')), 'on_site');
check('a minute past it: overdue', attendanceState(onSite, at('2026-09-15T15:46:00Z')), 'overdue');
check('the grace is three quarters of an hour', OVERDUE_GRACE_MINUTES, 45);
// Long enough that "forgot" and "still there" have separated; short enough to
// still be worth knowing.
check('it is longer than half an hour', OVERDUE_GRACE_MINUTES > 30, true);
check('and no longer than an hour', OVERDUE_GRACE_MINUTES <= 60, true);

console.log('\n— checking out late clears it —');
// A kid who remembers at 6pm is not overdue any more. Nothing counts against them.
check('a late check-out reads as complete',
  attendanceState(booking({ checkedInAt: '2026-09-15T14:02:00Z', checkedOutAt: '2026-09-15T18:00:00Z' }),
    at('2026-09-15T18:01:00Z')), 'complete');

console.log('\n— when check-in is offered —');
check('an hour early: not yet', canCheckIn(booking(), at('2026-09-15T13:00:00Z')), false);
check('thirty minutes early: yes', canCheckIn(booking(), at('2026-09-15T13:30:00Z')), true);
check('on time: yes', canCheckIn(booking(), at('2026-09-15T14:00:00Z')), true);
check('late: still yes', canCheckIn(booking(), at('2026-09-15T14:40:00Z')), true);
check('already checked in: no',
  canCheckIn(booking({ checkedInAt: '2026-09-15T14:00:00Z' }), at('2026-09-15T14:10:00Z')), false);
// A cancelled booking must never offer check-in — that is somebody about to
// turn up somewhere they are no longer expected.
check('a cancelled booking: no',
  canCheckIn(booking({ status: 'cancelled' }), at('2026-09-15T14:00:00Z')), false);
check('the early window is half an hour', EARLY_CHECK_IN_MINUTES, 30);

console.log('\n— checking out —');
check('cannot check out without checking in', canCheckOut(booking()), false);
check('can once checked in', canCheckOut(booking({ checkedInAt: '2026-09-15T14:00:00Z' })), true);
check('cannot twice',
  canCheckOut(booking({ checkedInAt: '2026-09-15T14:00:00Z', checkedOutAt: '2026-09-15T15:00:00Z' })), false);

console.log('\n— how long they were there —');
check('unknown before check-out', minutesOnSite(booking({ checkedInAt: '2026-09-15T14:00:00Z' })), null);
check('a clean hour',
  minutesOnSite(booking({ checkedInAt: '2026-09-15T14:00:00Z', checkedOutAt: '2026-09-15T15:00:00Z' })), 60);
check('rounds to the minute',
  minutesOnSite(booking({ checkedInAt: '2026-09-15T14:00:00Z', checkedOutAt: '2026-09-15T14:31:40Z' })), 32);
// Clock skew must not produce a negative duration on a guardian's screen.
check('never negative',
  minutesOnSite(booking({ checkedInAt: '2026-09-15T15:00:00Z', checkedOutAt: '2026-09-15T14:00:00Z' })), 0);

console.log('\n— ran past curfew after the fact —');
// The booking check refuses a job that WOULD run late. This catches one that
// did anyway, and only tells the guardian — nothing is blocked retroactively.
const localMinutesOf = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();
check('finished before curfew: fine',
  ranPastCurfew({ checkedOutAt: '2026-09-15T20:30:00Z', curfewMinutes: 21 * 60, localMinutesOf }), false);
check('finished after curfew: flagged',
  ranPastCurfew({ checkedOutAt: '2026-09-15T21:40:00Z', curfewMinutes: 21 * 60, localMinutesOf }), true);
check('exactly at curfew: fine',
  ranPastCurfew({ checkedOutAt: '2026-09-15T21:00:00Z', curfewMinutes: 21 * 60, localMinutesOf }), false);
check('no curfew: never flagged',
  ranPastCurfew({ checkedOutAt: '2026-09-15T23:00:00Z', curfewMinutes: null, localMinutesOf }), false);
check('no check-out: nothing to judge',
  ranPastCurfew({ checkedOutAt: null, curfewMinutes: 21 * 60, localMinutesOf }), false);

console.log('\n— what a guardian reads —');
check('on site', attendanceLabel('on_site'), 'There now');
// Deliberately not "MISSING" or an alarm word. Most of these are a forgotten tap.
check('overdue is stated plainly', attendanceLabel('overdue'), 'Has not marked it finished');
check('no record is not an accusation', attendanceLabel('no_record').includes('No check-in'), true);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
