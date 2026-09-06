# Compliance matrix and launch gating

Two things counsel's review asked to exist as written documents rather than as
intentions. This is the working copy; it is not legal advice and it is not a
substitute for the reviews it lists.

Nothing here is complete. That is the point of writing it down.

## Before a jurisdiction is enabled

A state or country is not enabled because it resembles one that already is.
Each needs its own row, filled in by counsel for that place, before the feature
flag is turned on. A service being permitted in California says nothing about
anywhere else.

| Question | CA | Other states |
|---|---|---|
| Minimum provider age | — | not reviewed |
| Minimum customer age | — | not reviewed |
| Child-labor restrictions and hours | — | not reviewed |
| Work permit required | — | not reviewed |
| Permitted and prohibited occupations | — | not reviewed |
| School-hours restrictions | — | not reviewed |
| Curfew / latest working hour | — | not reviewed |
| Independent-contractor test | Lab. Code § 2775 | not reviewed |
| Business licence or registration | — | not reviewed |
| Background-check requirements | — | not reviewed |
| Insurance requirements | — | not reviewed |
| Consumer-protection rules | — | not reviewed |
| Minor consent and disaffirmance | Fam. Code § 6710 | not reviewed |
| Arbitration and class-waiver limits | Tunkl, 60 Cal. 2d 92 | not reviewed |
| Privacy and biometric rules | Civ. Code § 1798.100 et seq. | not reviewed |
| Payment and money-transmission rules | see "Money never passes through" below | not reviewed |
| Fees charged to workers (employment-agency / job-listing statutes) | — | not reviewed |
| Mandatory reporting obligations | — | not reviewed |
| Local tax obligations | — | not reviewed |

Rows marked "—" need counsel input. The California column names the statutes
the addendum already cites; it is not a finding that the analysis is done.

## What the platform can already restrict by

Feature gating exists for these, and is what a jurisdiction row turns on:

- user location (postal code on the account)
- service location (the group a booking sits in)
- provider and customer age (age floors at 14 / 18 / 21)
- service category (the prohibited list, blocked at listing and at booking)
- time of day (curfew, checked against the end of the job)
- payment method (per-provider; every method settles directly between the two people)
- licensing requirements (regulated categories blocked outright)

These are now per-state, in `lib/jurisdictions.ts`. A state with no entry there
is not enabled and nothing works for anyone in it — absence means "no", never
"default to California".

**No jurisdiction currently has a counsel sign-off**, and an entry without one
is refused in production. As things stand a production deploy refuses every
signup in every state. That is the intended behaviour: the fix is a lawyer's
name in that file, not a code change.

The jurisdiction of a job is the state the **work** happens in, recorded per
booking from the customer's address — not the provider's home state. It matters
at a state line: a young person who lives one side and works the other is under
the other state's child labor law.

Where the two differ, the stricter of each rule applies field by field, rather
than one state's entry being taken wholesale. Neither legislature wrote its
number expecting the other's to override it, so picking one would silently relax
something. Both states must be open or the booking is refused.

The work state is derived from the customer's zip code where the zip falls in
an allocated block, and only falls back to what they selected when it does not.
The ranges are in `lib/zipstate.ts`.

Remaining known limit: a range table cannot see the handful of zip prefixes that
genuinely straddle a state line, and it says nothing about whether the address
within that zip is real. A geocoder would close both. Worth doing before two
adjacent states are open; a mismatch today is flagged for review rather than
refused, so nobody living on a county line is locked out.

## Money never passes through the platform

Every payment for a job is settled directly between the neighbour and the
provider — cash, Venmo, Cash App, Zelle, PayPal. HelloNeighbor records which
method was agreed and the amount. It does not hold, move, escrow, capture,
refund or reverse any of it.

This is enforced in three places, deliberately, because it was previously
enforced in one and that one was a filter on an array:

- `tests/no-customer-payments.test.mjs` fails the build on any code that
  creates, captures, refunds or transfers a payment, or that takes a card in
  the app.
- Migration `028_no_platform_payments.sql` dropped the card-hold column and
  removed `'stripe'` from the bookings payment-method constraint, so an insert
  that tries fails at the database.
- General Terms clause 15 states it, and both a customer and a provider tick a
  consent to it (`customer.payment.v2`, `provider.payment.v1`).

**What this buys.** It keeps the platform out of money transmission — state
licensing plus FinCEN MSB registration plus surety bonds — and out of PCI
scope and chargeback liability. For a product run by one person that is the
largest single regulatory saving available.

**What it does not buy.** It does nothing about the risk that actually matters
here, which is a young person going to a stranger's house. Negligent-referral
and negligent-undertaking claims do not turn on who processed the payment. It
is a licensing decision, not a safety one, and it should not be described
internally as though it reduced liability for harm.

**What it costs.** A dispute finding can no longer move money, because there is
no money to move: there is no hold to release, nothing to refund, and nothing
to withhold while both sides are heard. A resolution now produces a record and,
where warranted, an enforcement action against an account. Clause 14 says so.
That is a real reduction in what the platform can do for a wronged user, and it
is the trade being made.

**The open question this raises, sized correctly.** An earlier draft of this
section overstated it, and an overstated risk in a compliance document is its
own kind of error — it spends attention that a real item needs.

The concern is not that HelloNeighbor is anyone's employer. It plainly is not,
and that was never the test: employment-agency statutes exist precisely to
regulate intermediaries who are *not* the employer, so "we are only a platform"
neither helps nor hurts.

Three things do help, and together they make this a low-priority item:

- **Nobody here is employed.** These are one-off independent services between
  two private people. Most of these statutes are written around procuring
  *employment*, and there is no employment relationship anywhere in the chain
  to procure.
- **The fee is not a placement fee.** It is a flat monthly charge for software
  access, owed whether somebody gets one booking or twenty, and not tied to any
  particular job. Statutes in this area are generally aimed at a fee for
  obtaining a specific position.
- **Nobody pays to be listed at all.** Basic is free. Where these schemes bite
  hardest is on *advance* fees charged to a job seeker, and there are none.

The comparables point the same way. Thumbtack, Angi, Bark and TaskRabbit all
charge providers subscriptions or lead fees and are not regulated as employment
agencies, for the same reason: independent contracting is not employment.

**What is actually left.** Two things, and they are narrow:

- Some states define the regulated activity more broadly than "employment" —
  procuring *work or engagements* — and a few regulate "job listing services"
  as a separate category with disclosure and refund rules rather than licensing.
  California has such a scheme in its Civil Code alongside the employment-agency
  provisions. It is aimed at services that list *jobs to job seekers*;
  HelloNeighbor lists *providers to customers*, which is the other direction,
  and that distinction is the thing to put in front of counsel.
- **The providers are minors**, which is the part with no comparable. Thumbtack
  does not have fourteen-year-olds on it. Whether any fee arrangement involving
  a minor's earnings needs different treatment is a question for the child-labor
  review, where it belongs, rather than a separate line item here.

So: one paragraph in the child-labor brief, not a workstream. Keep the row in
the matrix so the question is asked; do not treat it as a launch blocker.

## Launch gating

Do not enable paid features or minor-provider functionality until every line is
done. Ticks are for work actually finished, not started.

### Legal review
- [ ] State-by-state compliance review (matrix above filled in for each)
- [ ] California worker-classification review
- [ ] Child-labor review, including work permits and school hours
- [ ] Privacy and minor-data review
- [ ] Payment-regulation review before any card, wallet, balance, refund or payout
- [ ] Employment-agency / job-listing question — one paragraph inside the child-labor brief, not a separate review
- [ ] SMS / TCPA compliance review
- [ ] Consumer-law review of the release, cap, arbitration clause and class waiver
- [ ] Tax review
- [ ] International review, per country, before any non-US launch

### Insurance
- [ ] Insurance assessment and placement

Deferred by the founder during development. Nothing in the app advertises
insurance, a protection fund, a guarantee, or damage reimbursement, and General
Terms clause 16 states plainly that there is none — so the deferral is a
disclosed absence rather than a misrepresentation. **This must be revisited
before launch**, and clause 16 must be updated the day cover exists.

### Built
- [x] Separate agreements per role, plus a jurisdictional addendum
- [x] Separate consent checkboxes, recorded individually with their exact text
- [x] Guardian consent flow, with the minor's own assent recorded separately
- [x] Prohibited-service controls
- [x] Curfew, checked against the end of the job
- [x] Adult verification for guardian and group-owner accounts
- [x] Enforcement ladder, append-only, with re-registration blocking
- [x] Dispute evidence, private bucket, short-lived admin links
- [x] Moderation via the supervisor pass on user-generated text
- [x] Audit trail for identity checks, consents and enforcement

### Still to build
- [x] Incident-response plan, written down — `docs/INCIDENT_RESPONSE.md`
- [x] Law-enforcement request process, written down — `docs/LAW_ENFORCEMENT.md`
- [x] One-tap safety reporting from an active booking
- [x] Emergency contact and guardian escalation path
- [x] Check-in / check-out, which is what makes the curfew observable
- [x] Documented message-retention job enforcing the two-year period in clause 18
- [ ] Moderator access controls and training notes
- [ ] Written enforcement standards and periodic review for inconsistency
- [x] Per-state feature flags
- [ ] Appeal workflow surfaced in the app rather than by email

## The adults-only route, in code

Almost every hard question in this document comes from minors: child labor,
work permits, school hours, guardian consent, curfews, and the facial age check
that exists only to catch a wrong declared age. An adults-only configuration
has none of them.

So `lib/jurisdictions.ts` has exactly one way to open a state in production
without a counsel sign-off:

```ts
minProviderAge: 18,
minCustomerAge: 18,
adultsOnlyBeta: { attestedBy: 'your name', attestedAt: '2026-09-06' },
```

Both floors must be 18 or the attestation is void and the state stays shut —
and that misconfiguration fails as its OWN error rather than falling through to
"not reviewed", so somebody who wrote their name in that field finds out
immediately that the state is not open, and why. The escape hatch cannot be
widened into the thing it was an escape from.

Where the floor is 18 the facial age check is not offered at all
(`ageCheckAppliesIn`). That removes the single highest-risk item in the
codebase — a biometric identifier under Illinois BIPA and its equivalents —
without needing anybody's opinion, because there is no minor left for it to
catch.

`attestedBy` is meant to be an uncomfortable field. Put your own name in it if
you are the one making the calls. What it must never hold is a lawyer who has
not read the file.

## Recommended sequence

1. California closed beta, **adults only**.
2. Minor-provider pilot, after child-labor, privacy, guardian controls and
   insurance are operational.
3. State-by-state expansion, one matrix row at a time.
4. International only after country-specific review.
