/**
 * Structural checks on the agreements.
 *
 * Not a substitute for a lawyer — nothing here is. These catch the mechanical
 * failures, and they pin the specific phrases counsel's review told us to
 * delete. Those are the ones most likely to creep back, because each of them
 * reads as stronger than what replaced it.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/liability.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  ALL_AGREEMENTS, GENERAL_TERMS, CUSTOMER_AGREEMENT, PROVIDER_AGREEMENT,
  GUARDIAN_AGREEMENT, COMMUNITY_AGREEMENT, CALIFORNIA_ADDENDUM,
  CONSENTS, LIABILITY_VERSION, DISPUTE_STEPS, consentsFor, requiredConsentIds,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const textOf = (doc) => doc.clauses.flatMap((c) => [c.plain, ...c.body]).join(' ');
const ALL = ALL_AGREEMENTS.map(textOf).join(' ');
const LOWER = ALL.toLowerCase();

console.log('— the documents hold together —');
check('there is one agreement per role, plus an addendum', ALL_AGREEMENTS.length, 6);
for (const doc of ALL_AGREEMENTS) {
  check(`${doc.id}: clauses numbered 1..n`, doc.clauses.map((c) => c.n), doc.clauses.map((_, i) => i + 1));
  check(`${doc.id}: every clause has a plain line`, doc.clauses.filter((c) => !c.plain?.trim()).length, 0);
  check(`${doc.id}: every clause has a body`, doc.clauses.filter((c) => c.body.length === 0).length, 0);
  check(`${doc.id}: no summary just repeats its title`,
    doc.clauses.filter((c) => c.plain.trim() === c.title.trim()).length, 0);
  check(`${doc.id}: has an audience and a preamble`, Boolean(doc.audience && doc.preamble), true);
}

console.log('\n— the phrases counsel told us to delete —');
// Each of these was in the previous draft. Each reads as stronger than what
// replaced it, which is exactly why they will creep back.
check('no absolute "we are not a money transmitter"',
  /is not a money transmitter/i.test(ALL), false);
check('money regulation is stated conditionally instead',
  /whether a particular feature is regulated|does not intend to provide money|holds no funds/i.test(ALL), true);
check('no sweeping "everything that follows is your responsibility"',
  /everything that follows from that is your responsibility/i.test(ALL), false);
check('messages are not retained "indefinitely"',
  /retain[^.]*indefinitely/i.test(ALL), false);
check('a retention period is stated instead', /retained for two years/i.test(ALL), true);
check('no unqualified "providers work for themselves"',
  /providers work for themselves\./i.test(ALL), false);
check('classification is qualified by conduct',
  LOWER.includes('contractual classification does not determine legal classification'), true);
check('off-platform evidence is not barred',
  /will generally be closed without a finding/i.test(ALL), false);
check('off-platform is described as a limit on investigating',
  /ability to investigate/i.test(ALL), true);

console.log('\n— the promises that must not be quietly dropped —');
check('no criminal background checks, said plainly', LOWER.includes('criminal background check'), true);
check('no insurance', LOWER.includes('does not currently provide, arrange, broker'), true);
check('not an employer', LOWER.includes('not an employer'), true);
check('not an emergency service', LOWER.includes('not an emergency service'), true);
check('no duty to rescue', LOWER.includes('to rescue anyone'), true);
check('gross negligence cannot be released', LOWER.includes('gross negligence'), true);
check('a guardian cannot waive a minor’s claims',
  LOWER.includes('does not release, waive, or limit any claim belonging to the young person'), true);
check('minors may disaffirm', LOWER.includes('disaffirm'), true);
check('local law controls where it gives nonwaivable rights',
  LOWER.includes('does not permit to be waived'), true);
check('statutory rights are preserved', LOWER.includes('statutory rights preserved'), true);
check('severability is present', LOWER.includes('severability'), true);
check('child labor and work permits are covered', LOWER.includes('work permit'), true);
check('the prohibited-services list is present', LOWER.includes('babysitting'), true);
// Forbidden marketing words, unless substantiated. None are.
for (const word of ['is vetted', 'we vet', 'certified provider', 'trusted provider']) {
  check(`nothing claims "${word}"`, LOWER.includes(word), false);
}

console.log('\n— the California addendum —');
const ca = textOf(CALIFORNIA_ADDENDUM);
check('cites the classification statute', ca.includes('2775'), true);
check('cites the minor disaffirmance statute', ca.includes('6710'), true);
check('cites Tunkl on release scrutiny', ca.includes('Tunkl'), true);
check('cites the privacy statute', ca.includes('1798.100'), true);

console.log('\n— survival points at real clauses —');
const survival = GENERAL_TERMS.clauses.find((c) => c.title.includes('Ending your account'));
const referenced = [...survival.body.join(' ').matchAll(/Clauses ([\d,\s and]+)/g)]
  .flatMap((mm) => mm[1].match(/\d+/g) ?? []).map(Number);
check('it names clauses', referenced.length > 0, true);
check('every one exists', referenced.filter((n) => !GENERAL_TERMS.clauses.some((c) => c.n === n)), []);
check('the release survives', referenced.includes(8), true);
check('the damages cap survives', referenced.includes(20), true);
check('the local-law clause survives', referenced.includes(2), true);

console.log('\n— every cross-reference points somewhere real —');
// Renumbering a clause silently breaks these, and a document that cites a
// clause that does not exist is worse than one that cites none.
const allText = ALL_AGREEMENTS
  .flatMap((d) => d.clauses.flatMap((c) => [c.plain, ...c.body]))
  .concat(CONSENTS.map((c) => c.refers))
  .join(' ');

const referencedNumbers = new Set();
for (const mm of allText.matchAll(/[Cc]lauses? (\d+)/g)) referencedNumbers.add(Number(mm[1]));
for (const mm of allText.matchAll(/General Terms (\d+)(?:,\s*(\d+))?/g)) {
  referencedNumbers.add(Number(mm[1]));
  if (mm[2]) referencedNumbers.add(Number(mm[2]));
}

const dangling = [...referencedNumbers].filter(
  (n) => !GENERAL_TERMS.clauses.some((c) => c.n === n)
);
check('no reference points at a clause that does not exist', dangling, []);
// And the two that carry the most weight point at the right thing.
check('"clause 6" is still the prohibited list',
  GENERAL_TERMS.clauses.find((c) => c.n === 6).title.includes('not available'), true);
check('"clause 8" is still the release',
  GENERAL_TERMS.clauses.find((c) => c.n === 8).title.includes('Release'), true);

console.log('\n— separate consents —');
check('consent ids are unique', new Set(CONSENTS.map((c) => c.id)).size, CONSENTS.length);
check('every consent has text', CONSENTS.filter((c) => !c.text.trim()).length, 0);
check('every consent names the clause it refers to', CONSENTS.filter((c) => !c.refers.trim()).length, 0);
// The ids are stored, so they carry their own version: changing wording must
// mean a new id, never a silent rewrite of what somebody agreed to.
check('every id is versioned', CONSENTS.filter((c) => !/\.v\d+$/.test(c.id)).length, 0);

for (const audience of ['customer', 'provider', 'guardian', 'community', 'minor']) {
  check(`${audience} has its own consents`, consentsFor(audience).length > 0, true);
  check(`${audience} has required ones`, requiredConsentIds(audience).length > 0, true);
}

// Counsel named these as separate acceptances rather than one "I agree".
const customerText = consentsFor('customer').map((c) => c.text).join(' ').toLowerCase();
check('the customer separately accepts risk', customerText.includes('accept the risks'), true);
check('separately accepts the release', customerText.includes('i release helloneighbor'), true);
check('separately accepts arbitration', customerText.includes('arbitration'), true);
check('separately accepts the class waiver', customerText.includes('class action'), true);
check('separately consents to service SMS', customerText.includes('text messages about my bookings'), true);
check('is told about the premises duty', customerText.includes('stay at the property'), true);

const guardianText = consentsFor('guardian').map((c) => c.text).join(' ').toLowerCase();
check('the guardian separately authorises', guardianText.includes('authority to make this decision'), true);
check('separately accepts child-labor responsibility', guardianText.includes('child labor'), true);
check('is told their signature does not bind the minor',
  guardianText.includes('does not sign away any claim belonging to the young person'), true);

const communityText = consentsFor('community').map((c) => c.text).join(' ').toLowerCase();
check('a group owner accepts responsibility', communityText.includes('responsible for my own people'), true);
check('and that we are not their partner', communityText.includes('not my employer, partner'), true);

console.log('\n— marketing must stay optional —');
const marketing = CONSENTS.filter((c) => c.id.includes('marketing'));
check('marketing consents exist', marketing.length > 0, true);
// Making account use conditional on marketing consent is not permitted.
check('none of them is required', marketing.filter((c) => c.required).length, 0);
check('service messages are separate and required',
  CONSENTS.filter((c) => c.id.includes('sms.service')).every((c) => c.required), true);

console.log('\n— versioning —');
check('the version looks like a date', /^\d{4}-\d{2}-\d{2}(\.\d+)?$/.test(LIABILITY_VERSION), true);
check('the dispute steps are spelled out', DISPUTE_STEPS.length >= 5, true);

const clauses = ALL_AGREEMENTS.reduce((a, d) => a + d.clauses.length, 0);
console.log(`\n${ALL_AGREEMENTS.length} agreements, ${clauses} clauses, ${CONSENTS.length} consents`);
console.log(failures === 0 ? 'all passed' : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
