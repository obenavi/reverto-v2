/**
 * Who gets contacted when a young person needs an adult, and in what order.
 *
 * The failure that matters is a chain that stops early. An escalation is not a
 * phone tree where the first answer ends it — if a fourteen-year-old pressed a
 * panic button, their aunt hearing about it ten minutes later costs nothing.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

// Strip the server-only halves; the ordering and wording are pure.
const src = readFileSync(new URL('../lib/contacts.ts', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  ;

const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { escalationMessage, MAX_EMERGENCY_CONTACTS, CONTACT_RELATIONSHIPS } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

const msg = (trigger, over = {}) =>
  escalationMessage({ trigger, youngPersonName: 'Sam', where: '14 Maple St', when: 'just now', ...over });

console.log('— what each message says —');
check('panic names the person', msg('panic').includes('Sam'), true);
check('panic gives the address', msg('panic').includes('14 Maple St'), true);
// The single most important sentence in the whole feature. We send texts; we
// do not dispatch anyone, and the person reading this at 7pm must know that.
check('panic tells them to call 911', msg('panic').includes('911'), true);
check('panic says we cannot send anyone', msg('panic').includes('cannot send anyone'), true);
check('panic tells them to call the kid', msg('panic').toLowerCase().includes('call them'), true);

console.log('\n— a missing check-out is not an emergency —');
// This one fires on a timer and will mostly be a kid who forgot. Wording it
// like a crisis would train everyone to ignore it.
check('it says it may be nothing', msg('no_check_out').includes('may be nothing'), true);
check('and does not shout about 911', msg('no_check_out').includes('911'), false);
check('but still asks them to check', msg('no_check_out').includes('check on them'), true);

console.log('\n— a safety report —');
check('names the person', msg('safety_report').includes('Sam'), true);
check('asks them to check on them', msg('safety_report').includes('check on them'), true);

console.log('\n— missing details do not produce broken text —');
check('no address still reads properly',
  msg('panic', { where: null }).includes('undefined') || msg('panic', { where: null }).includes(' at .'), false);
check('no time still reads properly',
  msg('panic', { where: null, when: null }).includes('undefined'), false);
check('every trigger produces something',
  ['panic', 'safety_report', 'no_check_out', 'manual'].filter((t) => !msg(t).trim()).length, 0);

console.log('\n— the list of contacts —');
// One is a single point of failure; five is a list nobody maintains.
check('at most three', MAX_EMERGENCY_CONTACTS, 3);
check('relationships include a neighbor', CONTACT_RELATIONSHIPS.some((r) => r.value === 'neighbor'), true);
check('and someone else', CONTACT_RELATIONSHIPS.some((r) => r.value === 'other'), true);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
