/**
 * The escalation ladder and who is currently blocked.
 *
 * Two failures matter in opposite directions: someone dangerous still able to
 * book, and someone ordinary banned over one bad afternoon.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/enforcement.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  SEVERE_CATEGORIES, ORDINARY_CATEGORIES, SUSPENSION_DAYS,
  severityOf, categoryLabel, recommendedAction, isCurrentlyBlocked, blockedMessage,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log('— what counts as serious —');
check('violence is severe', severityOf('violence'), 'severe');
check('a threat is severe', severityOf('threat'), 'severe');
check('sexual conduct is severe', severityOf('sexual'), 'severe');
check('putting a minor at risk is severe', severityOf('minor_risk'), 'severe');
check('not turning up is not', severityOf('no_show'), 'ordinary');
check('being rude is not', severityOf('rude'), 'ordinary');
// An unknown string must never be treated as serious by accident, nor as a
// reason to crash — it falls to the ordinary ladder.
check('an unrecognised category is ordinary', severityOf('something_new'), 'ordinary');
check('and has a label anyway', categoryLabel('something_new'), 'Something else');
// The two lists must not overlap, or the ladder contradicts itself.
check('no category is in both lists', ORDINARY_CATEGORIES.filter((o) =>
  SEVERE_CATEGORIES.some((s) => s.value === o.value)).length, 0);

console.log('\n— the ladder, ordinary problems —');
const ladder = (priorWarnings, priorSuspensions, category = 'rude') =>
  recommendedAction({ category, priorWarnings, priorSuspensions }).action;

check('first problem: a warning', ladder(0, 0), 'warning');
check('second problem: still a warning', ladder(1, 0), 'warning');
check('third: suspension', ladder(2, 0), 'suspension');
check('after a suspension, it happens again: ban', ladder(2, 1), 'ban');
// A prior suspension outranks the warning count, however few warnings there are.
check('a prior suspension outranks the count', ladder(0, 1), 'ban');

console.log('\n— serious problems skip the ladder —');
check('violence on a clean record: straight to suspension', ladder(0, 0, 'violence'), 'suspension');
check('a threat on a clean record: same', ladder(0, 0, 'threat'), 'suspension');
// The point of "no warning stage": a clean record must not soften it.
check('never a warning, whatever the history', ladder(0, 0, 'minor_risk'), 'suspension');
check('and the reason says why', recommendedAction({ category: 'violence', priorWarnings: 0, priorSuspensions: 0 }).why.includes('No warning stage'), true);

console.log('\n— who is blocked right now —');
const at = (iso, action, expires = null) => ({ action, created_at: iso, expires_at: expires });
const now = new Date('2026-09-01T12:00:00Z');

check('nothing on record: not blocked', isCurrentlyBlocked([], now).blocked, false);
check('a warning does not block', isCurrentlyBlocked([at('2026-08-01T00:00:00Z', 'warning')], now).blocked, false);
check('a ban blocks', isCurrentlyBlocked([at('2026-08-01T00:00:00Z', 'ban')], now).blocked, true);

console.log('\n— suspensions lapse on their own —');
check('a live suspension blocks', isCurrentlyBlocked(
  [at('2026-08-25T00:00:00Z', 'suspension', '2026-09-08T00:00:00Z')], now).blocked, true);
check('a lapsed one does not', isCurrentlyBlocked(
  [at('2026-08-01T00:00:00Z', 'suspension', '2026-08-15T00:00:00Z')], now).blocked, false);
// Expiring exactly now counts as lapsed — nobody stays suspended a second longer.
check('expiring right now has lapsed', isCurrentlyBlocked(
  [at('2026-08-18T00:00:00Z', 'suspension', '2026-09-01T12:00:00Z')], now).blocked, false);
check('an open-ended suspension blocks until lifted', isCurrentlyBlocked(
  [at('2026-08-01T00:00:00Z', 'suspension', null)], now).blocked, true);

console.log('\n— the latest row wins —');
check('lifting a ban unblocks', isCurrentlyBlocked([
  at('2026-08-01T00:00:00Z', 'ban'),
  at('2026-08-20T00:00:00Z', 'lifted'),
], now).blocked, false);
// The trap: rows arriving out of order. Sorting by date, not by position.
check('order in the array does not matter', isCurrentlyBlocked([
  at('2026-08-20T00:00:00Z', 'lifted'),
  at('2026-08-01T00:00:00Z', 'ban'),
], now).blocked, false);
check('a ban after a lift blocks again', isCurrentlyBlocked([
  at('2026-08-01T00:00:00Z', 'ban'),
  at('2026-08-20T00:00:00Z', 'lifted'),
  at('2026-08-28T00:00:00Z', 'ban'),
], now).blocked, true);

console.log('\n— what the person is told —');
// Never why, never who reported them.
check('a ban message names no reporter', blockedMessage('ban').toLowerCase().includes('report'), false);
check('a suspension message says we are looking', blockedMessage('suspension').includes('look'), true);
check('not blocked says nothing', blockedMessage(null), '');

check('suspensions run a fortnight', SUSPENSION_DAYS, 14);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
