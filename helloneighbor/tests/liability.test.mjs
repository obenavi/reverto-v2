/**
 * Structural checks on the terms.
 *
 * Not a substitute for a lawyer reading them — nothing here is. These catch
 * the failures that are mechanical rather than legal: a clause that lost its
 * plain-language summary, a numbering gap, a cross-reference in the survival
 * clause that points at nothing, or a version that was not bumped.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/liability.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { AGREEMENT, LIABILITY_VERSION, CUSTOMER_WAIVER, PROVIDER_WAIVER, DISPUTE_STEPS } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log('— the document holds together —');
check('clauses are numbered 1..n with no gaps',
  AGREEMENT.map((c) => c.n), AGREEMENT.map((_, i) => i + 1));
check('every clause has a plain-language line',
  AGREEMENT.filter((c) => !c.plain?.trim()).length, 0);
check('every clause has a body', AGREEMENT.filter((c) => c.body.length === 0).length, 0);
check('every clause has a title', AGREEMENT.filter((c) => !c.title?.trim()).length, 0);
// The summary is what most people will actually read, so it has to be a
// sentence rather than a restatement of the heading.
check('no summary is just the title',
  AGREEMENT.filter((c) => c.plain.trim() === c.title.trim()).length, 0);

console.log('\n— the survival clause points at real clauses —');
const survival = AGREEMENT.find((c) => c.title.includes('Ending your account'));
const referenced = [...survival.body.join(' ').matchAll(/Clauses ([\d,\s and]+)/g)]
  .flatMap((match) => match[1].match(/\d+/g) ?? [])
  .map(Number);
check('it names some clauses', referenced.length > 0, true);
check('every clause it names exists',
  referenced.filter((n) => !AGREEMENT.some((c) => c.n === n)), []);
// Releasing and capping liability are worthless if they die with the account.
check('the release survives', referenced.includes(6), true);
check('the damages cap survives', referenced.includes(17), true);
check('the indemnity survives', referenced.includes(16), true);

console.log('\n— the promises we must never quietly drop —');
const all = AGREEMENT.flatMap((c) => [c.plain, ...c.body]).join(' ').toLowerCase();
check('it says we run no background checks', all.includes('background check'), true);
check('it says there is no insurance', all.includes('no insurance') || all.includes('does not provide, arrange'), true);
check('it says we are not an employer', all.includes('not an employer'), true);
// The three honest limits. If someone edits these out to sound stronger, the
// document gets weaker, so they are pinned.
check('it admits gross negligence cannot be released', all.includes('gross negligence'), true);
check('it warns a guardian cannot sign away a minor’s claims', all.includes('cannot sign away a minor'), true);
check('it has a severability clause', all.includes('severability'), true);

console.log('\n— what people tick —');
check('the customer ticks several separate lines', CUSTOMER_WAIVER.length >= 4, true);
check('the provider ticks several separate lines', PROVIDER_WAIVER.length >= 4, true);
check('no tick is empty',
  [...CUSTOMER_WAIVER, ...PROVIDER_WAIVER].filter((t) => !t.trim()).length, 0);
// Each side must be told the two things they are most likely to assume wrongly.
check('the customer is told about background checks',
  CUSTOMER_WAIVER.some((t) => t.toLowerCase().includes('background check')), true);
check('the customer is told there is no insurance',
  CUSTOMER_WAIVER.some((t) => t.toLowerCase().includes('insurance')), true);
check('the provider is told they are not an employee',
  PROVIDER_WAIVER.some((t) => t.toLowerCase().includes('not my employer')), true);
check('the provider is told about their own taxes',
  PROVIDER_WAIVER.some((t) => t.toLowerCase().includes('tax')), true);
// Both are told the thing that keeps this honest: we limit claims against US.
check('the customer keeps their other rights',
  CUSTOMER_WAIVER.some((t) => t.includes('every other right')), true);
check('the provider keeps theirs',
  PROVIDER_WAIVER.some((t) => t.includes('every other right')), true);

console.log('\n— versioning —');
check('the version looks like a date', /^\d{4}-\d{2}-\d{2}(\.\d+)?$/.test(LIABILITY_VERSION), true);
check('the dispute steps are spelled out', DISPUTE_STEPS.length >= 5, true);

console.log(`\n${AGREEMENT.length} clauses`);
console.log(failures === 0 ? 'all passed' : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
