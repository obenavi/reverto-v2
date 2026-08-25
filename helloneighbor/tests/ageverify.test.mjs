/**
 * Decision-table tests for the age check.
 *
 * This is the logic that decides whether a real 14-year-old gets locked out of
 * their own account, or an adult gets waved through as a teenager. Both
 * failures are expensive and neither is visible in a build, so the table is
 * pinned here.
 *
 * Run with: npm test
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

// The thresholds live in lib/ages.ts and are re-exported from lib/ageverify.ts.
// Inlining that file's real source rather than a copy of the numbers is the
// whole point: if someone edits the floor, this suite sees the edit.
const ages = readFileSync(new URL('../lib/ages.ts', import.meta.url), 'utf8');

const src = readFileSync(new URL('../lib/ageverify.ts', import.meta.url), 'utf8')
  .replace(/import[\s\S]*?from '\.\/supabase';/, '')
  .replace(/import[\s\S]*?from '\.\/guardian';/, '')
  .replace(/import[\s\S]*?from '\.\/ages';/, '')
  .replace(/export \{ MINIMUM_AGE \} from '\.\/ages';/, ages)
  .replace(/export async function recordVerification[\s\S]*?\n}\n/, '');

const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const { judge, stillNeedsGuardian, MINIMUM_AGE, MINIMUM_BUFFER_YEARS } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);

let failures = 0;

// The floor and the buffer together decide the youngest age that can auto-pass.
// Raising one without the other silently sends a whole cohort to manual review,
// which is how this broke once already.
{
  const threshold = MINIMUM_AGE + MINIMUM_BUFFER_YEARS;
  const ok = threshold === 16;
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} youngest auto-passing age is ${threshold} (floor ${MINIMUM_AGE} + buffer ${MINIMUM_BUFFER_YEARS})` +
      `${ok ? '' : ' — expected 16; 14- and 15-year-olds should need review, 16+ should not'}`
  );
}

const cases = [
  [15, 15.2, 0.9, 'review', 'inside the challenge zone above the floor'],
  [16, 16.4, 0.9, 'passed', 'clears the floor with margin, and agrees'],
  [17, 16.1, 0.8, 'passed', 'within tolerance'],
  [14, 26.0, 0.9, 'review', 'adult posing as a teenager goes to a human'],
  [25, 14.0, 0.9, 'review', 'teenager posing as an adult goes to a human'],
  [14, 12.0, 0.9, 'failed', 'materially below the floor is refused'],
  [16, 16.2, 0.3, 'review', 'agreement at low confidence is not evidence'],
  [30, 31.0, 0.9, 'passed', 'adult operator, consistent'],
  [14, 14.0, 0.9, 'review', 'exactly at the floor must never auto-pass'],
];


for (const [declared, age, confidence, expected, why] of cases) {
  const got = judge({ age, confidence, provider: 'test' }, declared).status;
  const ok = got === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} declared=${declared} estimate=${age} conf=${confidence} -> ${got}` +
      `${ok ? '' : ` (expected ${expected})`}  · ${why}`
  );
}

// A pass on the face check must never stand in for a guardian's consent.
for (const [age, expected] of [[14, true], [15, true], [16, false], [40, false]]) {
  const got = stillNeedsGuardian(age);
  const ok = got === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} age ${age} still needs a guardian: ${got}`);
}

console.log(`\nminimum age ${MINIMUM_AGE}`);
if (failures > 0) {
  console.error(`${failures} failed`);
  process.exit(1);
}
console.log('all passed');
