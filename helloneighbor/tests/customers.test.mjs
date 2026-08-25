/**
 * Customer profiles and standing.
 *
 * The failure that matters most is the friendly one: labelling an ordinary
 * first-time neighbour as risky would make this a barrier rather than a help,
 * and would be wrong about almost everybody it flagged.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/customers.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  standingLabel, standingText, averageRating, checkBio,
  MIN_CUSTOMER_BIO, ESTABLISHED_BOOKINGS,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const standing = (over = {}) =>
  standingLabel({ completed: 0, rating: null, reviewCount: 0, cancellations: 0, ...over });

console.log('— everyone is new once —');
check('nobody with no history is flagged', standing(), 'new');
check('and the text does not sound like a warning', standingText('new', 0).includes('New here'), true);
check('one job makes them known', standing({ completed: 1 }), 'known');
check('three jobs makes them established', standing({ completed: 3 }), 'established');
check('the threshold is three', ESTABLISHED_BOOKINGS, 3);

console.log('\n— when to say something —');
// One bad rating from one job says more about that job than about the person.
check('a single low rating does not flag', standing({ completed: 1, rating: 2, reviewCount: 1 }), 'known');
check('two low ratings do', standing({ completed: 2, rating: 2, reviewCount: 2 }), 'attention');
check('exactly 3.0 is not low', standing({ completed: 2, rating: 3, reviewCount: 2 }), 'known');
check('just under 3 is', standing({ completed: 2, rating: 2.9, reviewCount: 2 }), 'attention');
// A good record does not immunise someone whose ratings went bad.
check('a long good history is still flagged when ratings drop',
  standing({ completed: 20, rating: 2.1, reviewCount: 6 }), 'attention');

console.log('\n— cancelling repeatedly is its own problem —');
// A young person who cleared an afternoon for nothing should be told.
check('two cancellations do not flag', standing({ completed: 5, cancellations: 2 }), 'established');
check('three do', standing({ completed: 5, cancellations: 3 }), 'attention');
check('even with a perfect rating',
  standing({ completed: 9, rating: 5, reviewCount: 9, cancellations: 4 }), 'attention');

console.log('\n— averages —');
check('no ratings averages to null', averageRating([]), null);
check('one rating is itself', averageRating([4]), 4);
check('an average rounds to one place', averageRating([5, 4, 4]), 4.3);
check('a whole number stays whole', averageRating([4, 4, 4]), 4);

console.log('\n— the bio has to say something —');
check('a real bio passes', checkBio(
  'We are a family of four on Maple Street with a fenced yard and a friendly labrador. Usually home during jobs.'
).ok, true);
check('empty fails', checkBio('').ok, false);
check('"hi" fails', checkBio('hi').ok, false);
// Length alone is gameable, so the word count catches padding.
check('padded nonsense fails', checkBio('a'.repeat(MIN_CUSTOMER_BIO + 10)).ok, false);
check('repeated single letters fail', checkBio('a '.repeat(40)).ok, false);
check('a wall of text fails', checkBio('word '.repeat(400)).ok, false);
// Exactly at the floor, with real words, passes.
check('a short but real bio passes', checkBio(
  'Two of us here, small garden out back, dog is friendly and stays inside.'
).ok, true);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
