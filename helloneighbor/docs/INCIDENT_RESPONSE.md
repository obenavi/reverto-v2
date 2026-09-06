# Incident response

Written before it is needed, because the first time something goes wrong is
the worst possible moment to be deciding who does what.

This is a real plan for a one-person operation, not a corporate template. If
that changes, this document changes with it.

## Who

Right now: one person. Named in `ADMIN_PASSWORD`'s owner and reachable at
`safety@helloneighbor.app`, monitored during waking hours and **not** overnight.

The app says so. `/safety` opens by telling people to call their local
emergency number first and states plainly that nobody is monitoring the app
around the clock. That sentence must stay true; if it stops being true in
either direction, change the sentence.

## The five things that count as an incident

Ordered by how fast they have to be answered.

| | Answer within | Examples |
|---|---|---|
| **1. Someone is in danger now** | Immediately | A safety alert fired; a report describing violence, threats, or sexual conduct; a provider who did not check out and is not answering |
| **2. A child-safety concern** | Same day | Grooming-shaped behaviour; an adult trying to book a minor off-platform; anything involving photographs of a minor |
| **3. A breach or exposure** | Same day | Credentials leaked; the service-role key in a client bundle; a page serving another account's data |
| **4. Harm after a booking** | 72 hours | Injury, property damage, theft, a dispute that escalates |
| **5. Everything else** | Within the stated target in `lib/reports.ts` | Content, spam, disagreements |

## What happens for each

### 1. Someone is in danger

1. **Do not investigate first.** Call emergency services if there is any
   reasonable belief someone is at immediate risk, and say plainly that you are
   a platform operator with limited information.
2. Contact the guardian on file, then the emergency contacts by priority.
   `lib/escalation.ts` does this automatically for a safety alert — confirm it
   actually sent rather than assuming.
3. Suspend the other account immediately. Suspension is reversible; a delay is
   not.
4. Write down what you knew and when, in the enforcement record, before you
   start forgetting it.

### 2. A child-safety concern

1. Suspend immediately, both accounts if it is not yet clear which is which.
2. Preserve everything: the conversation, the booking, any attachments.
   **Do not delete anything**, including content that appears to break the
   rules — deletion can destroy evidence somebody else needs.
3. Report to NCMEC's CyberTipline where the concern involves suspected child
   sexual exploitation. This is a legal obligation for a US provider once you
   have actual knowledge, not a judgement call.
4. Preserve the account and its data pending any law-enforcement contact, and
   note the preservation in the retention record so the cleanup job does not
   take it (`lib/retention.ts` holds anything under a legal hold).

### 3. A breach or exposure

1. Rotate the affected credential first, before working out the blast radius.
   Supabase keys, `SESSION_SECRET`, Twilio, Anthropic — all rotatable in
   minutes.
2. Work out who is affected and what was exposed. `moderation_reviews`,
   `enforcement_actions`, `consent_records` and `address_changes` are
   append-only and will tell you what happened even if something else was
   tampered with.
3. Notify. State breach-notification laws set deadlines measured in days, and
   most require notice to affected people and some require notice to a state
   attorney general. Where minors are involved, assume the strictest reading.
   **Get advice on the notification itself** — the content and timing of a
   breach notice is one of the few places where getting it wrong compounds the
   original problem.

### 4. Harm after a booking

1. Both parties can already file a dispute with evidence. Point them at it.
2. Be clear about what the platform can and cannot do, in the words the terms
   use: a finding decides what happens to accounts, never who owes whom, and it
   moves no money because no money was ever held.
3. If there is an injury to a minor, tell the guardian even if nobody asked you
   to.
4. Record it. A pattern of small harms is only visible if the small ones were
   written down.

### 5. Everything else

Through the admin queue, against the response target the app publishes.

## Preservation

The retention job in `lib/retention.ts` deletes messages after two years and
holds anything attached to an open dispute. **A legal hold is a manual act** —
if you need something kept beyond that, record the hold before the next sweep
runs, not after.

## After any incident above level 4

Write down, the same week:

- what happened, in one paragraph
- what the app did automatically, and whether it worked
- what you did manually that the app should have done
- one change, if there is an obvious one

That last line is the point of the document. The plan is worth less than the
habit of updating it.
