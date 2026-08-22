# HelloNeighbor

A marketplace where kids and teens run small neighborhood businesses — trash cans,
car washes, dog walks, babysitting, tutoring — and neighbors book them directly.

> **This app lives in a subdirectory on purpose.** The repository root is
> [Reverto](../docs/PLAN.md), an unrelated production app. HelloNeighbor is
> self-contained under `helloneighbor/`: its own `package.json`, its own
> dependencies, its own Supabase schema. Nothing here touches Reverto, and
> Netlify does not build it.

---

## Quick start

```bash
cd helloneighbor
npm install
cp .env.example .env.local   # then fill it in — see below
npm run dev                  # http://localhost:3000
```

The landing page, `/join`, and both login screens render with no configuration
at all. Everything past that needs Supabase.

## What you need to configure

| Variable | Needed for | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything | same page, `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | everything | same page, `service_role` (server-only) |
| `SESSION_SECRET` | login sessions | `openssl rand -base64 32` |
| `ADMIN_PASSWORD` | `/admin` | you pick it |
| `STRIPE_SECRET_KEY` | card payments | Stripe → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | card payments | same page |
| `STRIPE_WEBHOOK_SECRET` | payment status sync | `stripe listen`, or the endpoint's signing secret |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS | Twilio console |
| `ANTHROPIC_API_KEY` | supervisor agent | console.anthropic.com |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | bot challenge | dash.cloudflare.com → Turnstile (free) |
| `CRON_SECRET` | nightly sweep | set by Vercel when you add the cron |
| `NEXT_PUBLIC_SITE_URL` | shareable booking links | your deployed URL |

**Degrading gracefully is deliberate.** Without Twilio, messages are logged to
the server console and login codes are returned to the browser so you can still
test the flow — that fallback is disabled in production. Without Stripe, card
payments are refused with a clear message and cash-style bookings still work.

## Safety model

Three rules are enforced in code, not just written down:

1. **Babysitting and other care work are banned.** Removed from the catalog, rejected
   by a database check constraint, and called out in the guidelines. Migration 002
   retypes and hides any listing that predates the ban.
2. **All communication stays in the app.** A conversation opens automatically with
   every booking and is seeded with the neighbor's introduction plus a payment poll,
   so neither side ever needs to swap phone numbers. The thread is what an
   administrator reads when a dispute is opened.
3. **Both parties accept the guidelines.** Operators tick four acknowledgements at
   signup; neighbors accept at the confirm step. Acceptance is stored with a
   `TERMS_VERSION` on the subscriber and booking rows, so a dispute can be judged
   against the text each party actually saw.

⚠️ **A disclaimer is not legal protection.** `lib/guidelines.ts` contains a
limitation-of-liability clause because you asked for one, but a platform putting
minors in contact with strangers carries real exposure that no wording removes.
Before launch, get this reviewed by a lawyer, and look into insurance, identity
verification, and whether COPPA applies to your under-13 signups.

## Ages, and who can operate

- **Minimum 13.** COPPA governs under-13, so nobody on the platform falls inside it.
- **No upper limit.** Adults can offer services too.
- **Under 16 needs a guardian's approval** by email before the account goes live.
- **Under 18 is labelled to customers** — the booking page shows the provider's age and
  explains what it means, because a customer comparing a 15-year-old to a professional
  is comparing different things. Lower price, school-shaped availability, less
  experience. Saying it up front is fairer to the young person than a disappointed
  customer.

Two thresholds, deliberately different: `CONSENT_AGE_LIMIT` (16) and
`MINOR_BADGE_LIMIT` (18) in `lib/guardian.ts`.

## The age check

Facial **age estimation** — a photo in, a number out — used as a signal that a
declared age is plausible.

**What it is not.** It does not look for individual "teenage" features, and
specifically not acne: that affects most 12–24 year olds *and* plenty of adults,
and clear skin proves nothing. A classifier keyed on it would be confidently
wrong in both directions, which is worse than no check because a wrong answer
gets trusted. Purpose-built estimation models work on overall facial geometry
learned from large labelled datasets, and publish per-band error figures —
roughly 1.0–1.5 years mean error for 13–19 year olds.

**No image is ever stored.** The photo lives in memory for one provider call
and is dropped. Only the number is kept. There is no column in the schema that
can hold a face, and `/api/age-verification` performs no write of the buffer —
that is a property of the code, not a policy, and it should stay that way.

This matters because a retained face image or template is a biometric
identifier under **Illinois BIPA** — private right of action, per-violation
statutory damages — plus Texas CUBI, Washington's equivalent, and GDPR Article
9. Collecting one from a 13-year-old is exactly the fact pattern that draws a
class action. Consent is a separate, explicit step before the camera opens,
because BIPA wants notice and agreement *before* capture, not implied by it.

**It decides nothing on its own.** The decision table (`judge()` in
`lib/ageverify.ts`, pinned by `npm test`):

| Situation | Outcome |
|---|---|
| Estimate materially below 13 | **failed** |
| Estimate within 3 years of the floor | **review** — the error bar straddles the line |
| Estimate more than 4 years from declared | **review** |
| Agrees, but confidence under 50% | **review** |
| Agrees with margin and confidence | **passed** |
| Provider errors or times out | **review** — fails to a human, never to a pass |

An estimate of exactly 13 for a declared 13 goes to review. A machine does not
get to be the thing that decides a child may work.

**It does not replace guardian consent.** Under-16s still need a guardian, pass
or not — `stillNeedsGuardian()`, also pinned by the tests.

Set `AGE_PROVIDER_URL` and `AGE_PROVIDER_API_KEY` to switch it on. Left blank,
the feature is off and applications go to manual review, which still works.

## Guardian consent

Operators under 16 give a parent or guardian's name and **email** at signup, plus
their own email. The guardian's address must differ from the applicant's own —
case-insensitively, enforced by a database constraint as well as the form, because
a minor using a second address of their own would defeat the entire mechanism.

That guardian gets an email with a signed link to `/consent/<token>`, where they
read what the app is, tick four acknowledgements, and type their name to sign.
Name, timestamp, and IP are recorded.

**An under-16 account cannot be approved until that happens.** The Approve
button is disabled in the admin UI and `/api/admin/subscribers` returns 409
independently, so the gate does not depend on the UI. Admins can re-send the
link. Adults skip all of this.

## Rate limiting and the bot challenge

Two independent layers in front of every public route.

**Rate limits** are counted in Postgres (`rate_limit_hit()`), not in process —
serverless instances share no memory, so an in-process counter resets on every
cold start. Budgets live in `LIMITS` in `lib/ratelimit.ts`:

| Route | Limit |
|---|---|
| join, guardian consent | 3 / hour / IP |
| request login code | 5 / 15 min, per IP **and** per phone |
| verify login code | 10 / 15 min, per IP **and** per phone |
| admin login | 10 / 15 min / IP |
| booking, ping | 10 / hour / IP |
| chat message | 20 / min / conversation |
| ad-hoc SMS | 20 / hour / sender |

Login routes are limited per phone as well as per IP: per-IP alone would let
someone walk a six-digit code from a botnet, or use the app to spam SMS at
someone else's handset. The limiter fails **open** — an outage must not take
signups down — which is why the challenge below is the other half.

**Cloudflare Turnstile** guards join, booking, and ping. Free, no account
needed to develop against. With the keys unset the challenge is skipped and the
server does not verify, so local development works untouched; **set them before
launch.**

## The supervisor agent

`lib/supervisor.ts` reviews every signup, service listing, chat message, and
booking note against the guidelines using Claude with a structured (Zod) verdict:
`pass` / `review` / `block`, a 0–100 risk score, and categories. Flags land in the
**Flags** tab of `/admin`.

Where it runs, and why the timing differs:

| Content | When | On `block` |
|---|---|---|
| Signup | inline | recorded; the application still goes to a human |
| Service listing | inline | listing is hidden immediately — it is publicly bookable the moment it exists |
| Booking note | background | recorded |
| Chat message | background | recorded — holding a message behind a model call would make the thread feel broken |

**On "make sure they're a real human":** the agent scores how machine-generated the
*writing* looks (`automation_suspicion`) and escalates a `pass` to `review` above 70.
That is a content signal, not identity verification — nothing reading a text field
can prove a human sent it. Real bot defense is rate limiting plus a challenge
(Cloudflare Turnstile or hCaptcha) in front of the signup and booking forms. That
is not built yet and should be.

Without `ANTHROPIC_API_KEY` the app still runs; content is recorded as `review`
rather than silently passing.

## Database

Run the migrations in `supabase/migrations/` in order, either by pasting them into
the Supabase SQL Editor or with `supabase db push`.

`001_init_schema.sql` creates 11 tables — `subscribers`, `services`, `slots`, `bookings`, `pings`,
`reviews`, `gallery_photos`, `disputes`, `referrals`, `boosts`,
`operator_profiles` — and enables RLS on all of them.

`002_safety_chat_moderation.sql` adds the babysitting ban, terms-acceptance columns,
`conversations` + `messages`, and `moderation_reviews`.

**The access model matters:** the browser never writes. Every mutation goes
through a route handler holding the service role key. RLS policies therefore
describe only what an anonymous visitor may *read* — an active operator's public
storefront. Tables holding neighbors' names, phones, and addresses (`bookings`,
`pings`, `disputes`, `referrals`, `boosts`) have no anon policy at all, so they
are unreadable without the service key.

## Testing the full flow locally

1. **`/join`** — sign up as "Alex", `(555) 123-4567`, age 16.
2. **`/admin/login`** — enter `ADMIN_PASSWORD`, then approve Alex.
3. **`/login`** — enter the same phone. Without Twilio the six-digit code is
   shown on screen; with Twilio it arrives by text.
4. **`/dashboard`** — add a service, open a slot, then copy your link from
   **My link**.
5. **`/b/<operatorId>`** — book yourself: service → time → details → confirm.
   Leaving the note blank prompts you before the booking goes through; accepting
   the guidelines is required.
6. You land straight in the chat thread, where the opening message and the
   provider's payment poll are already waiting. Pick a method — it updates the
   booking.
7. Back in **`/dashboard`**, the thread is under **Messages** and the booking under
   **Bookings**. Mark it done; on a card booking that captures the held payment.

Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.

For webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## How payment works

**Card payments are off.** Stripe Connect requires account holders to be 18+ and
most operators here are minors, so that question is unresolved. The code path is
still in the repo — `lib/stripe.ts`, `lib/payments.ts`, the two `/api/stripe/*`
routes — and putting `'stripe'` back into `PAYMENT_METHODS` in `lib/catalog.ts`
re-enables it. `/api/bookings` rejects it independently of the UI.

What operators offer today: **cash**, **Venmo**, **Cash App**, **Zelle**, and
**PayPal**. Money never touches the platform; HelloNeighbor records what was
agreed and keeps the conversation as evidence.

**Timing is negotiated in the thread.** The neighbor's opening message asks how
the provider wants paying — in advance, or cash on the spot:

- An operator who ticks **"I'd rather be paid in advance"** in their profile has
  it answered for them on every booking, and the payment note posts immediately.
- Everyone else gets a two-option poll in the thread and answers per booking.

When the answer is *advance*, the thread posts a copy-and-paste payment note:

> Sarah paid for Car wash on Aug 23 at 2:00 PM. See you there!

The neighbor pastes that into the note field of their Venmo/Cash App/Zelle/PayPal
transfer. It is what ties an otherwise anonymous transfer to a specific booking
when a dispute is opened — the payment apps give the platform no visibility of
their own.

Handles come from the operator's profile and appear on the payment options
themselves, so the neighbor knows where to send it.

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/` | anyone | Landing page |
| `/join` | anyone | Operator self-registration |
| `/login` | operator | Phone + SMS code |
| `/dashboard` | operator | Bookings, schedule, pings, services, profile, link, gallery, reviews |
| `/b/[operatorId]` | anyone | Public booking, four steps |
| `/m/[token]` | neighbor | Their conversation thread; the token is the credential, so the page is noindex |
| `/guidelines` | anyone | Community guidelines and terms |
| `/admin/login` · `/admin` | admin | Approvals, all bookings, disputes |

API routes live under `app/api/`: `auth/*`, `operators/*` (session-scoped),
`admin/*` (admin-scoped), plus public `bookings`, `pings`, and the
`stripe/create-intent`, `stripe/webhook`, `sms/send` endpoints.

## Layout

```
app/          routes — pages and API handlers
components/   UI; components/dashboard/ holds the eight operator tabs
lib/          supabase, stripe, sms, session, guards, types, formatting
supabase/     the schema migration
docs/         the original setup guide and build summary
```

## Deploying

See [DEPLOY.md](./DEPLOY.md) — Vercel steps, the full environment variable
table, the post-deploy checklist, and an honest read on what an App Store
submission would actually involve.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
```

## Reporting, blocking, and the safety queue

Every conversation carries a **Report or block this person** link. The reporter
picks a reason, optionally blocks at the same time, and the report lands in the
**Reports** tab of `/admin` — which opens first whenever anything is waiting.

- **Reports are always from a party to the thing reported.** An operator is
  identified by session, a neighbor by the signed token on their conversation.
  There is no anonymous reporting endpoint to abuse.
- **Safety, inappropriate-content and age reports jump the queue** and text
  `SAFETY_ALERT_PHONE` immediately rather than waiting to be noticed.
- **Blocks are enforced, not cosmetic.** One row per operator/neighbor-phone
  pair stops bookings, messages and pings in both directions. The refusal is
  deliberately vague — confirming a block invites retaliation.
- **Reports outlive the accounts they concern.** Deleting a subscriber nulls
  `reporter_id` but keeps the report, so removing an account cannot erase an
  abuse record.
- `acknowledged_at` is stamped when an admin starts reviewing, and the queue
  marks anything past `RESPONSE_TARGET_HOURS` as overdue — which is what makes
  a "timely response" claim measurable.

`/safety` is the published contact page: how to report, how blocking works,
what is checked automatically, and the email address for parents and guardians.

## Push notifications

Web push via VAPID, working on installed PWAs including iOS 16.4+. Operators
get alerts for new bookings and messages; neighbors get them for replies on
their conversation. `public/sw.js` handles display and click-through, and
deliberately caches nothing — bookings and availability are live data.

Subscriptions are bound to whoever the caller already is, and endpoints the
push service rejects with 404/410 are deleted rather than retried forever.
Unset VAPID keys disable the whole feature cleanly.

On iPhone the Push API only exists once the app is installed to the home
screen, so the opt-in explains that rather than silently disappearing.

## Installing it on a phone

The app is a PWA: `/manifest.webmanifest`, icons, standalone display, theme
color. On Android Chrome offers an install prompt; on iOS it is Share → Add to
Home Screen. Once installed it opens without browser chrome and behaves like an
app. This works the moment the site is deployed — no app store involved.

## Things that were half-built, and now are not

Four features had data and admin tooling but no way for a user to reach them:

- **Disputes could be resolved but never opened.** `/api/disputes` now lets either
  party raise one from the conversation; the booking is resolved from the caller's
  own credential, so nobody can dispute a booking they are not part of.
- **Reviews could be displayed and replied to but never written.** `/api/reviews`
  takes one review per completed booking, from the neighbor on it.
- **No in-app account deletion**, which the privacy policy promises and App Store
  Guideline 5.1.1(v) requires. Deletion scrubs personal data and keeps the shell —
  hard-deleting would cascade away the *other* party's booking history and the
  record a dispute depends on. Refused while a booking is confirmed or a dispute
  is open.
- **A neighbor who lost their SMS lost the booking.** `/my-bookings` re-texts the
  links, and answers identically whether or not the number is known — a differing
  response would make it a way to test whether a phone number uses the app.

And the one that mattered most: **an administrator resolving a dispute could not
read the conversation.** The guidelines promise both parties that in-app messages
are what gets reviewed. `AdminConversation` makes that true — read-only, because
an admin should be judging what was said, not adding to it.

## The operator as a customer

Running a business here does not stop you being a customer. A logged-in operator
booking someone else's link is recognised by session: the booking records
`client_subscriber_id`, appears in their **I booked** tab, and the conversation
opens to their session instead of a texted link. A database constraint stops
anyone booking themselves.

## Admin access

The admin area is not linked from anywhere and is disallowed in `robots.txt`. Two
optional controls sit in front of the password:

- `ADMIN_ACCESS_KEY` — `/admin/login` returns **404** unless reached as
  `/admin/login?k=<key>`. Bookmark the full URL.
- `ADMIN_ALLOWED_IPS` — comma-separated allowlist; anything else 404s.

404 rather than 403 throughout: a 403 confirms there is something there.

## Known gaps

- **No image uploads.** Profile photos and gallery entries take URLs. Wire up
  Supabase Storage to accept real uploads.
- **Email is only used for guardian consent.** No booking receipts, no password
  reset (there are no passwords), no marketing.
- **The age check is optional and estimative.** An applicant can decline it, and
  it is an estimate rather than proof — for real assurance you need document
  verification, which the schema supports (`method = 'document'`) but no
  provider is wired to.
- **Nothing verifies the guardian email belongs to an adult** — only that it
  differs from the applicant's.
- **Chat polls every 10 seconds** rather than using Supabase Realtime.
- **`referrals` and `boosts` are schema-only** — no UI reads or writes them.
- **Nothing verifies a P2P payment actually arrived.** The memo makes a transfer
  traceable by hand; the app cannot see Venmo or Zelle, so `payment_status` for
  these is a claim, not a fact.
- **A report's `subject_id` can dangle** after the subject is deleted. Kept
  that way on purpose — the audit trail matters more than referential tidiness.
- **No automatic capture deadline.** The build summary describes a 48-hour
  auto-release; that would be a scheduled job, not part of this app.
- **`npm audit` flags PostCSS** inside Next's own dependency tree. It is
  build-time only; clearing it requires a Next 16 major upgrade.
