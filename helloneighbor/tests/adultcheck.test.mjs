/**
 * The waterfall that decides whether a parent account belongs to an adult.
 *
 * A false "yes" here hands a minor's bookings, money and curfew to whoever
 * asked. The decision table is pinned so it cannot drift quietly.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/adultcheck.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  CHALLENGE_AGE, ADULT_AGE, ESTIMATION_CONFIDENCE_FLOOR,
  METHOD_ORDER, isStrong, judgeEstimation, adultStatus, nextStep, remainingSignals,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const pass = (method) => ({ method, passed: true, detail: '' });
const fail = (method) => ({ method, passed: false, detail: '' });

console.log('— the buffer —');
// The gap between these two is the entire safety margin. Closing it would make
// the selfie check a coin flip at the boundary, so the relationship is pinned.
check('the challenge age sits well above the real one', CHALLENGE_AGE > ADULT_AGE + 5, true);
check('challenge age is 25', CHALLENGE_AGE, 25);
check('the real gate is 18', ADULT_AGE, 18);

console.log('\n— what a selfie may conclude —');
check('a clear 30 clears', judgeEstimation({ age: 30, confidence: 0.9 }).cleared, true);
check('exactly the challenge age clears', judgeEstimation({ age: 25, confidence: 0.9 }).cleared, true);
check('24 does not clear', judgeEstimation({ age: 24, confidence: 0.9 }).cleared, false);
// The dangerous case: a genuine adult of 20 who looks their age. Not cleared,
// not rejected — they go to the next step.
check('a real 20-year-old is not cleared', judgeEstimation({ age: 20, confidence: 0.95 }).cleared, false);
check('and is not rejected either', adultStatus([fail('estimation')]), 'pending');
check('a confident 40 with low confidence is not evidence', judgeEstimation({ age: 40, confidence: 0.3 }).cleared, false);
check('the confidence floor is a half', ESTIMATION_CONFIDENCE_FLOOR, 0.5);

console.log('\n— one strong signal is enough —');
check('a document match verifies', adultStatus([pass('document')]), 'verified');
check('a person saying yes verifies', adultStatus([pass('manual')]), 'verified');
check('document is strong', isStrong('document'), true);
check('a card is not', isStrong('card'), false);
check('a selfie is not', isStrong('estimation'), false);

console.log('\n— two weak signals, and they must be different —');
check('card alone is not enough', adultStatus([pass('card')]), 'pending');
check('selfie alone is not enough', adultStatus([pass('estimation')]), 'pending');
check('card plus selfie verifies', adultStatus([pass('card'), pass('estimation')]), 'verified');
// Retrying the same check until it passes is one signal, not two.
check('the same check twice is still one signal', adultStatus([pass('estimation'), pass('estimation')]), 'pending');

console.log('\n— only a person may say no —');
check('a failed selfie does not reject', adultStatus([fail('estimation')]), 'pending');
check('a failed card does not reject', adultStatus([fail('card'), fail('estimation')]), 'pending');
check('a failed document does not reject', adultStatus([fail('document')]), 'pending');
check('a manual refusal rejects', adultStatus([fail('manual')]), 'rejected');
// A refusal stands even next to passes: the person saw something the machines did not.
check('a refusal outranks a passed document', adultStatus([pass('document'), fail('manual')]), 'rejected');

console.log('\n— what to offer next —');
check('nothing tried: start with the card', nextStep([]), 'card');
check('card done: try the selfie', nextStep([pass('card')]), 'estimation');
check('both weak tried and failed: ask for ID', nextStep([fail('card'), fail('estimation')]), 'document');
check('everything failed: a person looks', nextStep([fail('card'), fail('estimation'), fail('document')]), 'manual');
check('already verified: nothing to do', nextStep([pass('document')]), null);
check('rejected: nothing to do', nextStep([fail('manual')]), null);
// Cheapest first, always.
check('the order is cheapest first', METHOD_ORDER, ['card', 'estimation', 'document', 'manual']);

console.log('\n— telling someone where they are —');
check('nothing done: two to go', remainingSignals([]), 2);
check('one weak passed: one to go', remainingSignals([pass('card')]), 1);
check('verified: none', remainingSignals([pass('card'), pass('estimation')]), 0);
check('a failed attempt does not count toward it', remainingSignals([fail('estimation')]), 2);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
