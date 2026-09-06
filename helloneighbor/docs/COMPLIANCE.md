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

**The open question this raises.** The only money HelloNeighbor takes is a
subscription from the *provider* — the young person or the adult behind their
account — for the right to be listed and booked. Several states regulate fees
charged to job seekers by employment agencies and job-listing services, and
charging the worker rather than the customer is the pattern those statutes
were written for. Whether they reach a software subscription is exactly the
kind of question that needs counsel and not a guess. It is now a row in the
matrix and a line in the gating list below. It is unresolved.

**What the free tier changes about it.** Basic now costs nothing: one service,
two bookings a week, no card, no end date. A number of the statutes in this
area single out *advance* fees charged to a job seeker — money taken before any
work has been obtained — and several prohibit them outright while treating a
fee owed after placement differently. Nobody on HelloNeighbor pays anything to
be listed; a fee is only owed by somebody who has already been getting booked
and wants past the limits. That does not answer the question, and it must not
be written down anywhere as though it did. It moves the question from the
hardest version to an arguable one, which is worth having done before counsel
reads it rather than after.

## Launch gating

Do not enable paid features or minor-provider functionality until every line is
done. Ticks are for work actually finished, not started.

### Legal review
- [ ] State-by-state compliance review (matrix above filled in for each)
- [ ] California worker-classification review
- [ ] Child-labor review, including work permits and school hours
- [ ] Privacy and minor-data review
- [ ] Payment-regulation review before any card, wallet, balance, refund or payout
- [ ] Employment-agency / job-listing review of charging the provider a subscription
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
- [x] One-tap safety reporting from an active booking
- [x] Emergency contact and guardian escalation path
- [x] Check-in / check-out, which is what makes the curfew observable
- [x] Documented message-retention job enforcing the two-year period in clause 18
- [ ] Law-enforcement request process, written down
- [ ] Incident-response plan, written down
- [ ] Moderator access controls and training notes
- [ ] Written enforcement standards and periodic review for inconsistency
- [x] Per-state feature flags
- [ ] Appeal workflow surfaced in the app rather than by email

## Recommended sequence

1. California closed beta, **adults only**.
2. Minor-provider pilot, after child-labor, privacy, guardian controls and
   insurance are operational.
3. State-by-state expansion, one matrix row at a time.
4. International only after country-specific review.
