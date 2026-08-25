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

console.log(failures === 0 ? '\nall passed' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
