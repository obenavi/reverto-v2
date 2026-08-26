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
| Payment and money-transmission rules | — | not reviewed |
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
- payment method (per-provider, and the card path is off)
- licensing requirements (regulated categories blocked outright)

Not yet built: per-state feature flags. Today the age floors and the prohibited
list are global constants, which is safe only because one jurisdiction is live.
**Enabling a second state requires this to exist first.**

## Launch gating

Do not enable paid features or minor-provider functionality until every line is
done. Ticks are for work actually finished, not started.

### Legal review
- [ ] State-by-state compliance review (matrix above filled in for each)
- [ ] California worker-classification review
- [ ] Child-labor review, including work permits and school hours
- [ ] Privacy and minor-data review
- [ ] Payment-regulation review before any card, wallet, balance, refund or payout
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
- [ ] Documented message-retention job enforcing the two-year period in clause 18
- [ ] Law-enforcement request process, written down
- [ ] Incident-response plan, written down
- [ ] Moderator access controls and training notes
- [ ] Written enforcement standards and periodic review for inconsistency
- [ ] Per-state feature flags
- [ ] Appeal workflow surfaced in the app rather than by email

## Recommended sequence

1. California closed beta, **adults only**.
2. Minor-provider pilot, after child-labor, privacy, guardian controls and
   insurance are operational.
3. State-by-state expansion, one matrix row at a time.
4. International only after country-specific review.
