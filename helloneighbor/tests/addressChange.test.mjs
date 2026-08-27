/**
 * Changing where somebody lives.
 *
 * The design does not try to prove residency. It removes what lying would win:
 * a change drops every group membership, and one across a state line pauses the
 * account. These tests are mostly about those two costs applying every time
 * they should — a version where they can be dodged is the same as having none.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

// Concatenate the real zip module rather than stubbing it, so a change to the
// ranges shows up here. Its `export` keywords go so the two files merge into
// one module scope — the range table has to stay in scope for stateForZip.
const zipSrc = readFileSync(new URL('../lib/zipstate.ts', import.meta.url), 'utf8')
  .replace(/^export /gm, '');

const src =
  zipSrc +
  '\n' +
  readFileSync(new URL('../lib/addressChange.ts', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '');

const m = await import(
  'data:text/javascript;base64,' +
    Buffer.from(
      transpileModule(src, { compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' } })
        .outputText
    ).toString('base64')
);
const { planAddressChange, ADDRESS_CHANGE_COOLDOWN_DAYS } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const NOW = new Date('2026-09-15T12:00:00Z');
const plan = (over = {}) =>
  planAddressChange(
    {
      currentZip: '02139', currentState: 'MA',
      newZip: '02141', newState: 'MA',
      lastChangedAt: null,
      ...over,
    },
    NOW
  );

console.log('— an ordinary move down the road —');
check('is allowed', plan().allowed, true);
// The whole deterrent. Moving zip means leaving your groups, every time.
check('costs them their groups', plan().dropsMemberships, true);
check('and they are told before confirming',
  plan().warnings.some((w) => w.includes('leave every neighborhood group')), true);
check('does not need review', plan().holdForReview, false);

console.log('\n— no change at all —');
check('same address is refused', plan({ newZip: '02139', newState: 'MA' }).allowed, false);
check('and says so plainly',
  plan({ newZip: '02139', newState: 'MA' }).error.includes('already your address'), true);

console.log('\n— crossing a state line —');
const crossing = plan({ newZip: '90210', newState: 'CA' });
check('is allowed but held', crossing.allowed, true);
check('flags the crossing', crossing.crossesState, true);
check('holds the account for review', crossing.holdForReview, true);
check('drops memberships too', crossing.dropsMemberships, true);
// Said in terms of the child, not of policy.
check('explains why in terms of the rules',
  crossing.warnings.some((w) => w.includes('young people working')), true);

console.log('\n— a zip that does not match the state —');
// 90210 is California. Claiming it is in New York is a flag, not a refusal:
// some zips really do straddle a line and locking that person out is wrong.
const odd = plan({ newZip: '90210', newState: 'NY' });
check('is still allowed', odd.allowed, true);
check('but held for review', odd.holdForReview, true);
check('records the mismatch', odd.zipStateCheck, 'mismatch');
check('and says a state line can explain it',
  odd.warnings.some((w) => w.includes('near a state line')), true);
// An unallocated zip is a real thing and must not read as a lie.
check('an unknown zip is not a mismatch', plan({ newZip: '00100', newState: 'MA' }).zipStateCheck, 'unknown');
check('and is not held on its own', plan({ newZip: '00100', newState: 'MA' }).holdForReview, false);

console.log('\n— the cooldown —');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000).toISOString();
check('a change yesterday blocks another', plan({ lastChangedAt: daysAgo(1) }).allowed, false);
check('so does one 89 days ago', plan({ lastChangedAt: daysAgo(89) }).allowed, false);
check('91 days ago is fine', plan({ lastChangedAt: daysAgo(91) }).allowed, true);
check('never having changed is fine', plan({ lastChangedAt: null }).allowed, true);
check('the window is three months', ADDRESS_CHANGE_COOLDOWN_DAYS, 90);
// Someone who really moved must have a way through that is not a wait.
check('the refusal points at a human',
  plan({ lastChangedAt: daysAgo(1) }).error.includes('write to us'), true);
check('and counts the days down',
  plan({ lastChangedAt: daysAgo(89) }).error.includes('1 day'), true);

console.log('\n— the costs cannot be dodged —');
// Every allowed change that moves zip drops memberships. No exceptions.
const movers = [
  plan(),
  plan({ newZip: '90210', newState: 'CA' }),
  plan({ newZip: '00100', newState: 'MA' }),
  plan({ currentZip: null, currentState: null, newZip: '02139', newState: 'MA' }),
];
check('every zip move drops memberships',
  movers.filter((p) => p.allowed && !p.dropsMemberships).length, 0);
// A first-time set is not "crossing" — there was nowhere to cross from.
check('setting an address for the first time does not read as crossing',
  plan({ currentZip: null, currentState: null, newZip: '02139', newState: 'MA' }).crossesState, false);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
