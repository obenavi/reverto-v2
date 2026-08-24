/**
 * The cancellation message a customer actually receives.
 *
 * Wording is the whole feature here: the difference between "reschedule for a
 * different day" and "any other time that day" is a booking kept or lost.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

function load(path, strip = []) {
  let src = readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const re of strip) src = src.replace(re, '');
  return transpileModule(src, {
    compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
  }).outputText;
}

// parentCancel imports only relationshipWord from parents; inline it.
const js = load('../lib/parentCancel.ts', [/import[\s\S]*?from '\.\/parents';/]).replace(
  'export function cancellationMessage',
  `function relationshipWord(v) { return v === 'mom' ? 'mom' : v === 'dad' ? 'dad' : 'legal guardian'; }
export function cancellationMessage`
);

const { cancellationMessage, CANCELLATION_WARNING } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);

let failures = 0;
const check = (label, cond, detail = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` — ${detail}`}`);
};

const now = new Date('2026-09-01T09:00:00Z');
const base = {
  parentName: 'Pat Alex',
  childName: 'Alex',
  relationship: 'mom',
  serviceTitle: 'Car wash',
  startsAt: '2026-09-02T14:00:00Z',
  now,
};

const wholeDay = cancellationMessage({ ...base, scope: 'day' });
console.log(`\n  ${wholeDay}\n`);
check('names the parent', wholeDay.includes('This is Pat Alex.'), wholeDay);
check('states the relationship', wholeDay.includes("Alex's mom"), wholeDay);
check('names the service', wholeDay.includes('Car wash'), wholeDay);
check('says tomorrow, not a date', wholeDay.includes('tomorrow'), wholeDay);
check('offers a different day', wholeDay.includes('different day'), wholeDay);
check('does not mention hours', !wholeDay.includes('between'), wholeDay);

const hours = cancellationMessage({
  ...base,
  scope: 'hours',
  unavailableFrom: '2026-09-02T13:00:00Z',
  unavailableTo: '2026-09-02T18:00:00Z',
});
console.log(`  ${hours}\n`);
check('states the unavailable window', hours.includes('between'), hours);
check('offers the same day outside those hours', hours.includes('outside those hours'), hours);
check('still offers a different day', hours.includes('different day'), hours);
check('says the child is not available', hours.includes("isn't available"), hours);

const dad = cancellationMessage({ ...base, relationship: 'dad', scope: 'day' });
check('dad reads as dad', dad.includes("Alex's dad"), dad);
const guardian = cancellationMessage({ ...base, relationship: 'legal_guardian', scope: 'day' });
check('legal guardian reads in words', guardian.includes("Alex's legal guardian"), guardian);

const sameDay = cancellationMessage({ ...base, startsAt: '2026-09-01T16:00:00Z', scope: 'day' });
check('same day reads as today', sameDay.includes('today'), sameDay);
const later = cancellationMessage({ ...base, startsAt: '2026-09-20T16:00:00Z', scope: 'day' });
check('a distant date names the day', later.includes('on '), later);

check('the warning mentions reputation cost', /review|customer/i.test(CANCELLATION_WARNING));

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
