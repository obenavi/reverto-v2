/**
 * The youngest providers work near home.
 *
 * Two things are being checked. The first is the rule itself. The second, and
 * the reason several of these cases exist, is that the rule fails CLOSED: a
 * fourteen-year-old with no zip on record is refused, not waved through,
 * because "we cannot tell" must not become "then it is fine" for exactly the
 * accounts carrying the least information.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function load(file) {
  const source = readFileSync(join(root, file), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { jobNearHome, nearHomeRequired, normalizeZip, nearHomeNotice } =
  await load('lib/proximity.ts');

let passed = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, `${label} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  console.log('ok  ', label);
  passed += 1;
}

const base = {
  closeToHomeAge: 16,
  providerZip: '02139',
  workZip: '02139',
  atProviderHome: false,
  sharedCommunityId: null,
  providerName: 'Maya',
};

const reason = (over) => jobNearHome({ ...base, ...over }).reason;
const allowed = (over) => jobNearHome({ ...base, ...over }).allowed;

console.log('\n— who the rule applies to —');
check('14 is inside it', nearHomeRequired(14, 16), true);
check('15 is inside it', nearHomeRequired(15, 16), true);
check('16 is outside it', nearHomeRequired(16, 16), false);
check('17 is outside it', nearHomeRequired(17, 16), false);
check('a 16-year-old is not checked at all', reason({ providerAge: 16, workZip: '99999' }), 'old_enough');
check('and is allowed anywhere', allowed({ providerAge: 16, workZip: '99999' }), true);

console.log('\n— their own house —');
check('a job they host is always fine', reason({ providerAge: 14, atProviderHome: true, workZip: '99999' }), 'at_own_home');
check('even with no zip on file', allowed({ providerAge: 14, atProviderHome: true, providerZip: null, workZip: '' }), true);

console.log('\n— the neighborhood —');
check('same zip is close enough', reason({ providerAge: 14 }), 'same_zip');
check('a different zip is not', reason({ providerAge: 14, workZip: '02141' }), 'too_far');
check('and is refused', allowed({ providerAge: 14, workZip: '02141' }), false);
check('a shared group beats the zip', reason({ providerAge: 14, workZip: '99999', sharedCommunityId: 'g1' }), 'same_group');

console.log('\n— failing closed —');
check('no zip on the account is a refusal', reason({ providerAge: 14, providerZip: null }), 'no_provider_zip');
check('not an allowance', allowed({ providerAge: 14, providerZip: null }), false);
check('an empty zip on the account too', allowed({ providerAge: 14, providerZip: '' }), false);
check('no zip on the job is a refusal', reason({ providerAge: 14, workZip: '' }), 'no_work_zip');
check('a short zip does not pass as one', allowed({ providerAge: 14, workZip: '021' }), false);

console.log('\n— zip shapes —');
check('plain five digits', normalizeZip('02139'), '02139');
check('ZIP+4 keeps the first five', normalizeZip('02139-4307'), '02139');
check('spaces are ignored', normalizeZip('  02139 '), '02139');
check('four digits is not a zip', normalizeZip('0213'), null);
check('letters are not a zip', normalizeZip('abcde'), null);
check('a nine-digit run still gives five', normalizeZip('021394307'), '02139');
check('ZIP+4 on both sides still matches', reason({ providerAge: 14, providerZip: '02139-1111', workZip: '02139-9999' }), 'same_zip');

console.log('\n— what the refusal says —');
const far = jobNearHome({ ...base, providerAge: 14, workZip: '02141' });
assert.equal(far.allowed, false);
check('does not leak where they live', far.message.includes('02139'), false);
check('names the age rule', /under 16/.test(far.message), true);
check('and points at the way round it', /neighborhood group/i.test(far.message), true);
check('the page notice does not leak it either', nearHomeNotice('Maya', 16).includes('02139'), false);

console.log(`\nall passed (${passed} assertions)`);
