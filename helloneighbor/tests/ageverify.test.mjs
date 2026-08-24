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

const src = readFileSync(new URL('../lib/ageverify.ts', import.meta.url), 'utf8')
  .replace(/import[\s\S]*?from '\.\/supabase';/, '')
  .replace(/import[\s\S]*?from '\.\/guardian';/, 'const CONSENT_AGE_LIMIT = 16;')
  .replace(/export async function recordVerification[\s\S]*?\n}\n/, '');

const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const { judge, stillNeedsGuardian, MINIMUM_AGE } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);

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

let failures = 0;

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
