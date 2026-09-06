# Law-enforcement and legal requests

What happens when a police officer, a lawyer, or a court asks for user data.

Written now because the wrong time to work this out is while someone is on the
phone saying it is urgent. Two mistakes are available and they point in
opposite directions: handing over a fifteen-year-old's data to whoever asked,
or refusing to help while somebody is in danger. This document exists so
neither happens by accident.

## Where to send people

`safety@helloneighbor.app`, marked LAW ENFORCEMENT REQUEST. Published on
`/safety` and in the Privacy Policy.

## What is required before anything is disclosed

**Every request must be in writing, on official letterhead or from an official
domain, and must name the legal authority it is made under.** A phone call is
not a request. "We can get a warrant if you make us" is not a warrant.

| What is asked for | What is needed |
|---|---|
| Basic subscriber information — name, phone, signup date, state | A subpoena, or an emergency request as below |
| Booking records, addresses, message metadata | A subpoena |
| **Message content** | A search warrant. Not a subpoena — content is different |
| Anything at all, faster | See the emergency exception |

Where the account belongs to a minor, treat every category one step stricter
and say so in the reply.

## The emergency exception, and its limits

Disclosure without legal process is permitted where there is a good-faith
belief that an emergency involving danger of death or serious physical injury
requires disclosure without delay.

That is a real exception and it should be used when it applies. It is also the
one most likely to be invoked when it does not. So:

- The request must describe **the specific emergency**, not assert that one
  exists.
- Disclose only what is needed to address it — a location, a phone number, a
  last-known booking. Not the account.
- Write down who asked, when, what they said, what was given, and why it was
  judged an emergency. Same day.

If it does not clearly qualify, say: *"This does not appear to meet the
emergency standard. Send a subpoena or warrant and we will respond promptly.
If that is wrong, tell me what the immediate danger is and I will reconsider
straight away."*

## Telling the user

**The default is to tell them.** A person whose data was handed over should
know it was, unless a court has ordered otherwise or telling them would create
a risk to somebody.

Do not notify where:

- a non-disclosure order accompanies the request, or
- the account is the subject of a child-safety investigation, or
- notice would foreseeably endanger someone.

Where notice is delayed by an order, note the date it expires and tell them
then.

## Preservation requests

A preservation request is not a disclosure request. It asks that data be kept,
not handed over, and it does not need a warrant.

Honour it: place a hold before the retention sweep in `lib/retention.ts` runs,
which deletes messages after two years. The hold is manual. Record it.

## Civil subpoenas and lawyers

Same rules, less urgency, and one addition: a civil subpoena from a party in a
dispute between two users is not a reason to hand over the other user's data
without telling them. Notify, give them time to object, and say so in the
reply.

Anyone can already get **their own** booking record and messages by asking, per
General Terms clause 14. That is usually what a lawyer actually needs, and it
does not require anything from a court.

## What to keep

A log, in one place, of every request: date, requester, authority cited, what
was asked, what was given, what was refused, whether the user was told.

Keep it even for requests that were refused. A pattern of requests about one
account is itself information, and the log is the only place it shows up.

## When to stop and get advice

- Anything that is not obviously covered above.
- Any request from outside the United States.
- Any request accompanied by a non-disclosure order.
- The first request of any kind, whatever it is. Getting the first one right is
  worth a lawyer's hour.
