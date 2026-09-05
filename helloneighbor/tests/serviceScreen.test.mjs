/**
 * The floor under a provider-written service.
 *
 * Two things are being checked, and the second matters more. The first is that
 * the obvious refusals refuse. The second is that the ALLOWED cases are
 * allowed — a blocklist that eats haircuts and tennis coaching does not make
 * the app safer, it makes the feature useless and pushes people into writing
 * "other" and explaining in a message, which is worse than either.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function load(file) {
  const js = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { screenServiceText, normalizeForScreening, SERVICE_EXAMPLES, SERVICE_LIMITS } =
  await load('lib/serviceScreen.ts');

let passed = 0;
function blocked(label, text, category) {
  const r = screenServiceText(text);
  assert.equal(r.ok, false, `${label} — "${text}" was allowed through`);
  if (category) {
    assert.equal(r.category, category, `${label} — wrong category for "${text}"`);
  }
  assert.ok(r.message.length > 30, `${label} — the refusal should explain the rule`);
  console.log('ok   blocks:', label);
  passed += 1;
}
function allowed(label, ...parts) {
  const r = screenServiceText(...parts);
  assert.equal(
    r.ok,
    true,
    `${label} — refused as ${r.ok ? '' : r.category} on "${r.ok ? '' : r.matched}"`
  );
  console.log('ok   allows:', label);
  passed += 1;
}

console.log('\n— the thing this exists for —');
blocked('babysitting', 'Babysitting evenings and weekends', 'care_of_a_person');
blocked('baby sitting, spaced', 'baby sitting for busy parents', 'care_of_a_person');
blocked('childcare', 'Reliable childcare in my home', 'care_of_a_person');
blocked('nanny', 'Part time nanny available', 'care_of_a_person');
blocked('a phrase with none of those words', 'Looking after your kids while you pop out', 'care_of_a_person');
blocked('watching children', 'Watching children after school', 'care_of_a_person');
blocked('the school run', 'I can do your school run every morning', 'care_of_a_person');
blocked('walking a child to school', 'Walking your son to school and back', 'care_of_a_person');
blocked('eldercare', 'Companion care for seniors', 'care_of_a_person');
blocked('sitting with a grandparent', 'Sitting with your grandma for a few hours', 'care_of_a_person');
blocked('bedtime', 'Dinner and bedtime while you are out', 'care_of_a_person');

console.log('\n— lazy obfuscation —');
blocked('leetspeak', 'b@bysitting av@ilable', 'care_of_a_person');
blocked('shouting', 'BABYSITTING AND CHILDCARE', 'care_of_a_person');
blocked('a fancy hyphen', 'child‑care in your home', 'care_of_a_person');
blocked('padded spacing', 'child   care   evenings', 'care_of_a_person');

console.log('\n— the other categories —');
blocked('driving', 'I can drive you to appointments', 'transport');
blocked('lifts', 'Giving lifts around town', 'transport');
blocked('electrical', 'Small electrical jobs and rewiring', 'licensed_or_hazardous');
blocked('roofing', 'Roof repairs, cheap', 'licensed_or_hazardous');
blocked('gutters', 'Gutter cleaning with my own ladder', 'heights_or_machinery');
blocked('chainsaw', 'Tree felling with a chainsaw', 'heights_or_machinery');
blocked('pest control', 'Pest control and fumigation', 'chemicals_or_pests');
blocked('pools', 'Pool cleaning weekly', 'water');
blocked('swimming lessons', 'Swimming lessons for beginners', 'water');
blocked('weapons', 'Knife sharpening service', 'weapons');
blocked('alcohol', 'Beer run for your party', 'age_restricted_goods');
blocked('medication', 'Medication reminders and pills sorted', 'medical');
blocked('massage', 'Relaxing massage at your home', 'intimate');
blocked('overnight', 'House sitting while you are away', 'overnight');
blocked('sleepover', 'Happy to do a sleepover', 'overnight');

console.log('\n— what has to keep working —');
for (const example of SERVICE_EXAMPLES) allowed(example, example);
allowed('the ones the founder named', 'Haircuts', 'Car detailing', 'Sport training');
allowed('coaching a child, because a parent is home', 'Football training for your kid in your garden');
allowed('tutoring', 'Maths tutoring, grades 4 to 7');
allowed('car care is not care of a person', 'Car care and interior valet');
allowed('a website is not a site visit', 'Building you a simple website');
allowed('dog walking', 'Dog walking, 30 minutes');
allowed('dog sitting in the day', 'Daytime dog visits while you are at work');
allowed('trash cans', 'Trash cans out and back');
allowed('lawn mowing', 'Mowing the front lawn');
allowed('an empty listing', '', null, undefined);

console.log('\n— the copy beside the field —');
assert.ok(SERVICE_EXAMPLES.length >= 8, 'give people enough examples to see the shape');
assert.ok(SERVICE_LIMITS.length >= 5, 'and the limits, in the same place');
assert.ok(
  SERVICE_LIMITS.some((l) => /looking after a person/i.test(l)),
  'the first limit should be the one the whole rule is about'
);
passed += 3;

console.log('\n— normalisation —');
assert.equal(normalizeForScreening('  Baby   SITTING!!  '), 'baby sitting');
assert.equal(normalizeForScreening('Car-detailing'), 'car detailing');
passed += 2;

console.log('\n— the route screens before it writes —');
// The old order inserted an ACTIVE row and hid it after the model answered,
// which left a banned listing publicly bookable for the length of an API call.
const route = readFileSync(join(root, 'app/api/operators/services/route.ts'), 'utf8');
const insertAt = route.indexOf('.insert({');
const screenAt = route.indexOf('screenServiceText(');
assert.ok(screenAt > -1, 'the services route no longer runs the deterministic screen');
assert.ok(screenAt < insertAt, 'the screen has to run before anything is written');
assert.ok(
  route.slice(insertAt, insertAt + 500).includes('active: false'),
  'a new listing must be inserted inactive and only turned on by a verdict'
);
assert.ok(
  route.indexOf('reviewContent(') < route.indexOf('.update({ active: true })'),
  'the model has to answer before a listing is made live'
);
passed += 4;

console.log('\n— and screens edits too —');
// Screening only on create makes "add something bland, then rewrite it" the
// obvious way past every check on the page.
const patch = route.slice(route.indexOf('export async function PATCH'));
assert.ok(/screenServiceText\(/.test(patch), 'an edit is new text and must be screened');
assert.ok(/reviewContent\(/.test(patch), 'an edit must go to the model as well');
passed += 2;

console.log('\n— the guidelines describe it —');
const guidelines = readFileSync(join(root, 'lib/guidelines.ts'), 'utf8');
assert.ok(/You are not limited to the list/.test(guidelines), 'say that people can name their own');
assert.ok(
  /no exceptions and no upper age limit/.test(guidelines),
  'the care rule applies to adults too, and the guidelines have to say so'
);
assert.ok(
  /that is a lesson, not custody/i.test(guidelines),
  'coaching a child is allowed and the reason should be written down'
);
passed += 3;

console.log(`\nall passed (${passed} assertions)`);
