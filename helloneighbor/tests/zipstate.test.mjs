/**
 * Postal code to state.
 *
 * A wrong answer here sends a booking to the wrong child labor law, so the
 * ranges are spot-checked against real zips at the edges of their blocks —
 * which is where an off-by-one in a range table shows up.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/zipstate.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { stateForZip, zipMatchesState } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const at = (zip) => {
  const r = stateForZip(zip);
  return r.known ? r.state : null;
};

console.log('— real places —');
check('Cambridge MA', at('02139'), 'MA');
check('Beverly Hills CA', at('90210'), 'CA');
check('Manhattan NY', at('10001'), 'NY');
check('Chicago IL', at('60601'), 'IL');
check('Houston TX', at('77001'), 'TX');
check('Seattle WA', at('98101'), 'WA');
check('Miami FL', at('33101'), 'FL');
check('Denver CO', at('80202'), 'CO');
check('Anchorage AK', at('99501'), 'AK');
check('Honolulu HI', at('96813'), 'HI');
check('Washington DC', at('20500'), 'DC');

console.log('\n— the edges, where an off-by-one hides —');
check('01000 is the bottom of MA', at('01001'), 'MA');
check('02799 is the top of MA', at('02799'), 'MA');
check('02800 is RI', at('02800'), 'RI');
check('96199 is the top of CA', at('96199'), 'CA');
check('96700 is HI, not CA', at('96700'), 'HI');
check('19699 is PA', at('19699'), 'PA');
check('19700 is DE', at('19700'), 'DE');
// The two DC blocks with Virginia between them.
check('20100 is VA, not DC', at('20100'), 'VA');
check('20200 is back to DC', at('20200'), 'DC');
// Texas has a second block out past New Mexico.
check('88500 is TX, not NM', at('88500'), 'TX');
check('88499 is NM', at('88499'), 'NM');

console.log('\n— formatting —');
check('zip+4 works', at('02139-1234'), 'MA');
check('whitespace works', at('  90210 '), 'CA');
check('too short is unknown', at('0213'), null);
check('letters are unknown', at('ABCDE'), null);
check('empty is unknown', at(''), null);
check('null is unknown', at(null), null);
// An unallocated block is a real thing, not a lie.
check('an unallocated block is unknown', at('00100'), null);

console.log('\n— comparing against a claim —');
check('agreeing is a match', zipMatchesState('90210', 'CA'), 'match');
check('lowercase still matches', zipMatchesState('90210', 'ca'), 'match');
check('disagreeing is a mismatch', zipMatchesState('90210', 'NY'), 'mismatch');
// Neither of these may be treated as lying.
check('an unknown zip is unknown', zipMatchesState('00100', 'CA'), 'unknown');
check('no claim is unknown', zipMatchesState('90210', null), 'unknown');
check('no zip is unknown', zipMatchesState(null, 'CA'), 'unknown');

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
