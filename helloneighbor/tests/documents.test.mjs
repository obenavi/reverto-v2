/**
 * The ID + face-match decision.
 *
 * The failure that matters is a pass that should not have been one: an ID that
 * is not theirs, a face that does not match, or a synthetic camera feed. Each
 * has its own row here.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/documents.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const { judgeDocument, FACE_MATCH_FLOOR } = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

/** A clean result. Each test spoils exactly one thing. */
const good = (over = {}) => ({
  provider: 'test',
  documentValid: true,
  ageFromDocument: 34,
  faceMatch: 0.94,
  livenessPassed: true,
  injectionSuspected: false,
  ...over,
});

console.log('— the happy path —');
check('a clean check passes', judgeDocument(good(), 18).passed, true);
check('and says so without repeating anything identifying', judgeDocument(good(), 18).detail.includes('34'), false);
check('the detail records the threshold, not the age', judgeDocument(good(), 18).detail.includes('18 or over'), true);

console.log('\n— the age on the card —');
check('exactly the threshold passes', judgeDocument(good({ ageFromDocument: 18 }), 18).passed, true);
check('one year under does not', judgeDocument(good({ ageFromDocument: 17 }), 18).passed, false);
check('a refusal names no number either', judgeDocument(good({ ageFromDocument: 17 }), 18).detail.includes('17'), false);
check('no readable date of birth fails', judgeDocument(good({ ageFromDocument: null }), 18).passed, false);

console.log('\n— the sibling bar is higher —');
// The same 19-year-old, both ways round.
check('19 passes as a parent', judgeDocument(good({ ageFromDocument: 19 }), 18).passed, true);
check('19 fails as a sibling', judgeDocument(good({ ageFromDocument: 19 }), 21).passed, false);
check('21 passes as a sibling', judgeDocument(good({ ageFromDocument: 21 }), 21).passed, true);

console.log('\n— the face has to be theirs —');
check('a strong match passes', judgeDocument(good({ faceMatch: 0.95 }), 18).passed, true);
check('exactly the floor passes', judgeDocument(good({ faceMatch: FACE_MATCH_FLOOR }), 18).passed, true);
check('just under the floor fails', judgeDocument(good({ faceMatch: FACE_MATCH_FLOOR - 0.01 }), 18).passed, false);
// Somebody else's real, valid ID showing a real adult. The age is fine; the
// face is not — and the age must not rescue it.
check("a valid adult ID with the wrong face fails", judgeDocument(good({ faceMatch: 0.4 }), 18).passed, false);

console.log('\n— proving a person was there —');
check('failed liveness fails', judgeDocument(good({ livenessPassed: false }), 18).passed, false);
check('a suspected injection fails', judgeDocument(good({ injectionSuspected: true }), 18).passed, false);
// An injection is reported as telling us nothing, not as an accusation.
check('and is described as inconclusive', judgeDocument(good({ injectionSuspected: true }), 18).detail.includes('proves nothing'), true);
// A provider that cannot answer is not a provider that has cleared it — the
// module defaults an absent field to "suspected", so this must never pass.
check('an unreadable document fails', judgeDocument(good({ documentValid: false }), 18).passed, false);

console.log('\n— the injection check outranks everything —');
// Every other field is perfect. It still must not pass.
check('a perfect result with an injection still fails', judgeDocument(good({ injectionSuspected: true, faceMatch: 1 }), 18).passed, false);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
