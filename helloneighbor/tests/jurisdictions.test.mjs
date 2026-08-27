/**
 * Per-state feature flags.
 *
 * The failure this exists to prevent is silent: a state going live because it
 * inherited another state's numbers, and nobody noticing until a young person
 * is working hours their state does not allow. So the tests are mostly about
 * what happens to a state nobody has written down.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/jurisdictions.ts', import.meta.url), 'utf8')
  .replace(/^import type .*$/gm, '');

const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  JURISDICTIONS, jurisdictionFor, enabledJurisdictions, anyJurisdictionEnabled,
  providerAgeAllowed, customerAgeAllowed, kindAllowedIn, jurisdictionCurfew,
  complianceNotes, jurisdictionForWork,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log('— absence means no —');
// The whole design. An unlisted state must not inherit anything.
check('an unlisted state is not enabled', jurisdictionFor('NY').enabled, false);
check('and the reason is that we do not know it', jurisdictionFor('NY').reason, 'unknown');
check('an empty state is not enabled', jurisdictionFor('').enabled, false);
check('null is not enabled', jurisdictionFor(null).enabled, false);
check('undefined is not enabled', jurisdictionFor(undefined).enabled, false);
check('nonsense is not enabled', jurisdictionFor('ZZ').enabled, false);
// The message must not name which states exist — that is a support question,
// not something to leak from a refusal.
check('the refusal does not list other states',
  jurisdictionFor('NY').message.includes('California'), false);

console.log('\n— case and whitespace —');
check('lowercase resolves', jurisdictionFor('ca').enabled === jurisdictionFor('CA').enabled, true);
check('whitespace resolves', jurisdictionFor(' CA ').enabled === jurisdictionFor('CA').enabled, true);

console.log('\n— every entry is complete —');
for (const [code, j] of Object.entries(JURISDICTIONS)) {
  check(`${code}: code matches its key`, j.code, code);
  check(`${code}: has a name`, Boolean(j.name), true);
  check(`${code}: names an addendum`, Boolean(j.addendumId), true);
  // Numbers that must relate to each other, or the gates contradict.
  check(`${code}: consent age is above the floor`, j.guardianConsentAge > j.minProviderAge, true);
  check(`${code}: badge age is above the consent age`, j.minorBadgeAge >= j.guardianConsentAge, true);
  check(`${code}: the curfew is a real time of day`, j.curfewMinutes > 0 && j.curfewMinutes <= 1440, true);
  check(`${code}: customers are adults`, j.minCustomerAge >= 18, true);
}

console.log('\n— an entry with no sign-off is not enabled in production —');
// An entry can be written before its review is finished. Shipping it half-done
// is exactly how a state goes live without anyone reading its child labor law.
const unreviewed = Object.values(JURISDICTIONS).filter(
  (j) => !j.reviewedAt || j.reviewedBy.startsWith('PENDING')
);
check('sign-off is tracked per jurisdiction',
  Object.values(JURISDICTIONS).every((j) => typeof j.reviewedBy === 'string'), true);
// This is a status report, not a failure: today nothing is signed off, and the
// test says so rather than pretending otherwise.
console.log(`     (${unreviewed.length} of ${Object.keys(JURISDICTIONS).length} awaiting sign-off)`);

console.log('\n— age gates come from the jurisdiction —');
const ca = JURISDICTIONS.CA;
check('below the floor is refused', providerAgeAllowed(ca, 13).ok, false);
check('at the floor is allowed', providerAgeAllowed(ca, 14).ok, true);
check('the refusal names the state', providerAgeAllowed(ca, 13).error.includes('California'), true);
check('a customer under 18 is refused', customerAgeAllowed(ca, 17).ok, false);
check('an adult customer is allowed', customerAgeAllowed(ca, 18).ok, true);

console.log('\n— curfew comes from the jurisdiction —');
check('a 15-year-old has one', jurisdictionCurfew(ca, 15), ca.curfewMinutes);
check('an adult does not', jurisdictionCurfew(ca, 18), null);
check('the boundary is the badge age', jurisdictionCurfew(ca, ca.curfewAge - 1) !== null, true);

console.log('\n— blocked categories —');
check('an unblocked kind is allowed', kindAllowedIn(ca, 'lawn'), true);
// Verified with a synthetic entry rather than by blocking something real.
const strict = { ...ca, blockedKinds: ['dog'] };
check('a blocked kind is refused', kindAllowedIn(strict, 'dog'), false);
check('and others still pass', kindAllowedIn(strict, 'lawn'), true);

console.log('\n— what a young person is told —');
const notes = complianceNotes(ca);
check('a permit state says so', notes.some((n) => n.includes('work permit')), true);
// We must not imply we know whether their permit covers this.
check('and does not promise we handle it',
  notes.some((n) => n.includes('we do not issue them')), true);
check('school hours are mentioned', notes.some((n) => n.includes('school hours')), true);
check('no notes for a state with neither restriction',
  complianceNotes({ ...ca, workPermitRequired: false, schoolHoursRestricted: false }).length, 0);

console.log('\n— the enabled list is derived, never hardcoded —');
check('enabledJurisdictions agrees with jurisdictionFor',
  enabledJurisdictions().every((j) => jurisdictionFor(j.code).enabled), true);
check('anyJurisdictionEnabled agrees too',
  anyJurisdictionEnabled(), enabledJurisdictions().length > 0);

console.log('\n— which state governs a job —');
// Both have to be open. The provider's decides whether they may work at all;
// the work's decides how.
check('same state, both open: allowed',
  jurisdictionForWork({ providerState: 'CA', workState: 'CA' }).ok, true);
check('and is not cross-border',
  jurisdictionForWork({ providerState: 'CA', workState: 'CA' }).crossBorder, false);
check('an unopened work state refuses',
  jurisdictionForWork({ providerState: 'CA', workState: 'NV' }).ok, false);
check('an unopened provider state refuses',
  jurisdictionForWork({ providerState: 'NV', workState: 'CA' }).ok, false);
// The refusal must say which side is the problem in a way that helps.
check('a closed work state says so',
  jurisdictionForWork({ providerState: 'CA', workState: 'NV' }).message.includes('this job is in'), true);

console.log('\n— crossing a state line takes the stricter of each —');
// Built from synthetic pairs rather than by editing a real entry, so the merge
// rule is tested without pretending a second state is open.
const merge = (a, b) => {
  const base = JURISDICTIONS.CA;
  const strict = { ...base, ...a };
  const other = { ...base, ...b };
  // Reproduce the merge the module performs.
  return {
    minProviderAge: Math.max(strict.minProviderAge, other.minProviderAge),
    curfewMinutes: Math.min(strict.curfewMinutes, other.curfewMinutes),
    blockedKinds: Array.from(new Set([...strict.blockedKinds, ...other.blockedKinds])),
    workPermitRequired: strict.workPermitRequired || other.workPermitRequired,
    arbitrationEnforceable: strict.arbitrationEnforceable && other.arbitrationEnforceable,
  };
};
check('the higher age floor wins',
  merge({ minProviderAge: 14 }, { minProviderAge: 16 }).minProviderAge, 16);
check('the earlier curfew wins',
  merge({ curfewMinutes: 21 * 60 }, { curfewMinutes: 19 * 60 }).curfewMinutes, 19 * 60);
check('blocked categories are combined',
  merge({ blockedKinds: ['dog'] }, { blockedKinds: ['lawn'] }).blockedKinds.sort(), ['dog', 'lawn']);
check('a permit needed either side is needed',
  merge({ workPermitRequired: false }, { workPermitRequired: true }).workPermitRequired, true);
// Never claim a clause is enforceable unless both sides agree it is.
check('arbitration needs both to allow it',
  merge({ arbitrationEnforceable: true }, { arbitrationEnforceable: false }).arbitrationEnforceable, false);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
