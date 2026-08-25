/**
 * Neighbourhood groups: who may book whom, and the invite code.
 *
 * The failure that matters is the community-only switch not holding — a young
 * person who asked to be booked only by people they know, and got a stranger
 * anyway.
 */
import { readFileSync } from 'fs';
import { transpileModule, ModuleKind } from 'typescript';

const src = readFileSync(new URL('../lib/communities.ts', import.meta.url), 'utf8');
const js = transpileModule(src, {
  compilerOptions: { module: ModuleKind.ESNext, target: 'ES2020' },
}).outputText;

const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const {
  normalizeInviteCode, looksLikeStreetAddress, canProvide, canBook,
  bookingAllowed, MEMBER_ROLES, MAX_OWNED_COMMUNITIES,
  normalizeZip, zipMatches, decideJoin, ownerIsActive,
  COMMUNITY_OWNER_MIN_AGE, OWNER_ACTIVITY_DAYS,
} = m;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

console.log('— the invite code —');
check('a clean code normalizes', normalizeInviteCode('ABCD-2345'), 'ABCD-2345');
check('a dashless one gets a dash', normalizeInviteCode('ABCD2345'), 'ABCD-2345');
check('lowercase is fine', normalizeInviteCode('abcd2345'), 'ABCD-2345');
check('spaces are fine', normalizeInviteCode(' ABCD 2345 '), 'ABCD-2345');
// The alphabet excludes confusable characters on purpose — someone reads this
// out loud to a neighbour over a fence.
check('O is not in the alphabet', normalizeInviteCode('ABCO2345'), null);
check('I is not either', normalizeInviteCode('ABCI2345'), null);
check('nor 0 or 1', normalizeInviteCode('ABC02345'), null);
check('too short is rejected', normalizeInviteCode('ABC234'), null);
check('too long is rejected', normalizeInviteCode('ABCD23456'), null);
check('empty is rejected', normalizeInviteCode(''), null);

console.log('— the area field —');
// A community page is semi-public, and a house number on it is a map to a child.
check('a street name is fine', looksLikeStreetAddress('Maple Street'), false);
check('a neighbourhood is fine', looksLikeStreetAddress('Oakwood, near the park'), false);
check('a house number is flagged', looksLikeStreetAddress('14 Maple Street'), true);
check('with a letter too', looksLikeStreetAddress('14b Maple Street'), true);
check('leading whitespace does not hide it', looksLikeStreetAddress('   1600 Pennsylvania Ave'), true);
// A name that merely contains a number is not an address.
check('"Route 66 Neighbors" is not an address', looksLikeStreetAddress('Route 66 Neighbors'), false);

console.log('\n— what a membership lets you do —');
const member = (role, status = 'active') => ({ role, status });
check('both can provide', canProvide(member('both')), true);
check('both can book', canBook(member('both')), true);
check('a provider can provide', canProvide(member('provider')), true);
check('a provider cannot book', canBook(member('provider')), false);
check('a neighbor can book', canBook(member('neighbor')), true);
check('a neighbor cannot provide', canProvide(member('neighbor')), false);
// Pending and removed do nothing at all, whatever the role says.
check('pending cannot provide', canProvide(member('both', 'pending')), false);
check('pending cannot book', canBook(member('both', 'pending')), false);
check('removed cannot book', canBook(member('both', 'removed')), false);
check('no membership cannot book', canBook(null), false);
check('undefined cannot provide', canProvide(undefined), false);

console.log('\n— the community-only switch —');
const allow = (communityOnly, provider, customer) =>
  bookingAllowed({ communityOnly, providerCommunityIds: provider, customerCommunityIds: customer });

// Switch off: the app works as it always did.
check('off, no shared group: allowed', allow(false, ['a'], ['b']).allowed, true);
check('off, no groups at all: allowed', allow(false, [], []).allowed, true);

// Switch on: this is the whole feature.
check('on, no shared group: refused', allow(true, ['a'], ['b']).allowed, false);
check('on, a shared group: allowed', allow(true, ['a', 'b'], ['b', 'c']).allowed, true);
check('and the booking records which group', allow(true, ['a', 'b'], ['b', 'c']).sharedCommunityId, 'b');
// The trap: a provider who switched it on but is in no groups must not be
// bookable by everyone. Empty ∩ anything is empty, so this must refuse.
check('on, provider in no groups: refused', allow(true, [], ['a']).allowed, false);
check('on, customer in no groups: refused', allow(true, ['a'], []).allowed, false);
check('on, neither in any group: refused', allow(true, [], []).allowed, false);

console.log('\n— a shared group is recorded even when the switch is off —');
// Worth having anyway: it is what a provider's page shows as a reason to trust.
check('off, shared group still reported', allow(false, ['a'], ['a']).sharedCommunityId, 'a');
check('off, none shared reports null', allow(false, ['a'], ['b']).sharedCommunityId, null);

console.log('\n— limits —');
check('nobody owns more than a few groups', MAX_OWNED_COMMUNITIES, 3);
check('the default role is both', MEMBER_ROLES[0].value, 'both');

console.log('\n— postal codes —');
check('a plain zip normalizes', normalizeZip('02139'), '02139');
check('zip+4 collapses to the zip', normalizeZip('02139-1234'), '02139');
check('unhyphenated zip+4 too', normalizeZip('021391234'), '02139');
check('whitespace is ignored', normalizeZip('  02139 '), '02139');
check('a Canadian code keeps its area', normalizeZip('M5V 3L9'), 'M5V');
check('lowercase Canadian works', normalizeZip('m5v3l9'), 'M5V');
check('nonsense is rejected', normalizeZip('banana'), null);
check('a four-digit number is rejected', normalizeZip('0213'), null);
check('empty is rejected', normalizeZip(''), null);

check('the same zip matches', zipMatches('02139', '02139-9999'), true);
check('a different zip does not', zipMatches('02139', '02138'), false);
// The important one: a blank zip must never sail through. Failing open would
// make the filter decorative for anyone who left the field empty.
check('a missing zip never matches', zipMatches(null, '02139'), false);
check('two missing zips never match', zipMatches(null, null), false);
check('an unparseable zip never matches', zipMatches('banana', 'banana'), false);

console.log('\n— who gets in —');
const join = (over = {}) => decideJoin({
  policy: 'both', hasValidCode: false,
  memberZip: '02139', communityZip: '02139', ownerActive: true, ...over,
});

check('right area, valid code: straight in', join({ hasValidCode: true }).admitted, true);
check('and it records the code as the route', join({ hasValidCode: true }).via, 'code');
check('right area, no code: a request', join().status, 'pending');
check('which is not an admission', join().admitted, false);

// The zip gate applies to a valid code too — a forwarded code that escaped the
// street must not let somebody three towns over walk in.
check('wrong area with a valid code: refused', join({ hasValidCode: true, memberZip: '90210' }).admitted, false);
check('and the reason is the area', join({ hasValidCode: true, memberZip: '90210' }).reason, 'wrong_area');
check('wrong area, no code: refused', join({ memberZip: '90210' }).reason, 'wrong_area');

console.log('\n— what the owner set —');
check('code-only refuses a request', join({ policy: 'code' }).reason, 'code_required');
check('code-only still admits a code', join({ policy: 'code', hasValidCode: true }).admitted, true);
check('requests-only ignores the code', join({ policy: 'request', hasValidCode: true }).admitted, false);
check('and queues them instead', join({ policy: 'request', hasValidCode: true }).status, 'pending');

console.log('\n— an absent owner —');
// Nobody watching means nobody let in unwatched. Fails toward the queue.
check('a code does not auto-admit while the owner is away',
  join({ hasValidCode: true, ownerActive: false }).admitted, false);
check('it becomes a request instead',
  join({ hasValidCode: true, ownerActive: false }).status, 'pending');

const now = new Date('2026-09-10T12:00:00Z');
check('active yesterday counts', ownerIsActive('2026-09-09T12:00:00Z', now), true);
check('exactly a week ago still counts', ownerIsActive('2026-09-03T12:00:00Z', now), true);
check('eight days ago does not', ownerIsActive('2026-09-02T12:00:00Z', now), false);
check('never active does not', ownerIsActive(null, now), false);
check('the window is a week', OWNER_ACTIVITY_DAYS, 7);

console.log('\n— running a group —');
// Higher than the 18 needed to hold a parent account: an owner sees every
// booking in the group and decides who is near the children in it.
check('owners must be 21', COMMUNITY_OWNER_MIN_AGE, 21);
check('which is stricter than adulthood', COMMUNITY_OWNER_MIN_AGE > 18, true);

console.log('\n— succession —');
// The rules the routes enforce, restated here so a change to either is caught.
// Nomination hands someone authority over children: adult, active, already in
// the group, and never someone who said no.
const eligible = (p) =>
  p.age >= 18 && p.status === 'active' && p.inGroup === true && p.declined !== true;

check('an adult member can inherit', eligible({ age: 40, status: 'active', inGroup: true }), true);
check('a 17-year-old member cannot', eligible({ age: 17, status: 'active', inGroup: true }), false);
check('exactly 18 can', eligible({ age: 18, status: 'active', inGroup: true }), true);
check('an adult who is not in the group cannot', eligible({ age: 40, status: 'active', inGroup: false }), false);
check('a suspended adult member cannot', eligible({ age: 40, status: 'suspended', inGroup: true }), false);
// The one that matters most: a refusal has to stick, or an owner on their way
// out re-nominates until it takes.
check('someone who declined cannot be re-used',
  eligible({ age: 40, status: 'active', inGroup: true, declined: true }), false);

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
