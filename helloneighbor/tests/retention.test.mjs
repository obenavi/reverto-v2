/**
 * Deleting messages when we said we would, and never while something needs them.
 *
 * The worst bug this file could have is deleting the messages a live dispute
 * turns on, because the timer happened to fire that day. Holds are therefore
 * checked before the clock, and these tests exist mostly to keep that ordering.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/retention.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  retentionDecision, retentionCutoff, holdReason,
  MESSAGE_RETENTION_DAYS, POST_RESOLUTION_HOLD_DAYS,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const NOW = new Date('2026-09-15T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const facts = (over = {}) => ({
  bookingEndedAt: daysAgo(800),
  hasOpenDispute: false,
  hasOpenReport: false,
  resolvedAt: null,
  hasEnforcement: false,
  ...over,
});

console.log('— the clause 18 promise —');
check('two years', MESSAGE_RETENTION_DAYS, 730);
check('an old booking is deleted', retentionDecision(facts(), NOW).deleteMessages, true);
check('a recent one is not', retentionDecision(facts({ bookingEndedAt: daysAgo(30) }), NOW).deleteMessages, false);
check('and says why', retentionDecision(facts({ bookingEndedAt: daysAgo(30) }), NOW).because, 'too_recent');
check('exactly at the boundary is deleted',
  retentionDecision(facts({ bookingEndedAt: daysAgo(730) }), NOW).deleteMessages, true);
check('a day short is not',
  retentionDecision(facts({ bookingEndedAt: daysAgo(729) }), NOW).deleteMessages, false);

console.log('\n— holds beat the clock —');
// The whole point. A four-year-old conversation with an open dispute stays.
check('an open dispute holds an ancient booking',
  retentionDecision(facts({ bookingEndedAt: daysAgo(1500), hasOpenDispute: true }), NOW).deleteMessages, false);
check('and names the reason',
  retentionDecision(facts({ hasOpenDispute: true }), NOW).because, 'open_dispute');
check('an open report holds it',
  retentionDecision(facts({ bookingEndedAt: daysAgo(1500), hasOpenReport: true }), NOW).because, 'open_report');
check('an enforcement action holds it',
  retentionDecision(facts({ bookingEndedAt: daysAgo(1500), hasEnforcement: true }), NOW).because, 'enforcement');

console.log('\n— the appeal window after a resolution —');
// Somebody who loses on Friday may write on Monday. Deleting by then would
// make the appeal unanswerable.
check('resolved yesterday: held',
  retentionDecision(facts({ resolvedAt: daysAgo(1) }), NOW).deleteMessages, false);
check('and says it is the appeal window',
  retentionDecision(facts({ resolvedAt: daysAgo(1) }), NOW).because, 'recent_resolution');
check('resolved 89 days ago: still held',
  retentionDecision(facts({ resolvedAt: daysAgo(89) }), NOW).deleteMessages, false);
check('resolved 91 days ago on an old booking: deleted',
  retentionDecision(facts({ resolvedAt: daysAgo(91) }), NOW).deleteMessages, true);
// But the resolution window expiring does not override the main clock.
check('resolved long ago but booking is recent: still held',
  retentionDecision(facts({ bookingEndedAt: daysAgo(100), resolvedAt: daysAgo(95) }), NOW).because, 'too_recent');
check('the appeal window is ninety days', POST_RESOLUTION_HOLD_DAYS, 90);

console.log('\n— several holds at once —');
// Order matters only for the message; nothing with any hold is ever deleted.
check('everything held at once still refuses',
  retentionDecision(facts({
    hasOpenDispute: true, hasOpenReport: true, hasEnforcement: true, resolvedAt: daysAgo(1),
  }), NOW).deleteMessages, false);

console.log('\n— the query cutoff —');
const cutoff = new Date(retentionCutoff(NOW));
check('the cutoff is two years back',
  Math.round((NOW - cutoff) / 86_400_000), MESSAGE_RETENTION_DAYS);
// The cutoff is a pre-filter only; holds are still applied per row afterwards.
check('a booking at the cutoff would be deleted only if unheld',
  retentionDecision(facts({ bookingEndedAt: cutoff.toISOString() }), NOW).deleteMessages, true);

console.log('\n— explaining a hold —');
check('an open dispute reads plainly', holdReason('open_dispute').includes('dispute'), true);
check('the appeal window names its length', holdReason('recent_resolution').includes('90'), true);
check('the ordinary case names the period', holdReason('too_recent').includes('730'), true);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
