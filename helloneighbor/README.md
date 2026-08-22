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

## Guardian consent

Operators under 18 give a parent or guardian's name and phone at signup. That
guardian gets an SMS with a signed link to `/consent/<token>`, where they read
what the app is, tick four acknowledgements, and type their name to sign. Name,
timestamp, and IP are recorded.

**An under-18 account cannot be approved until that happens.** The Approve
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

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
```

## Installing it on a phone

The app is a PWA: `/manifest.webmanifest`, icons, standalone display, theme
color. On Android Chrome offers an install prompt; on iOS it is Share → Add to
Home Screen. Once installed it opens without browser chrome and behaves like an
app. This works the moment the site is deployed — no app store involved.

## Known gaps

- **No image uploads.** Profile photos and gallery entries take URLs. Wire up
  Supabase Storage to accept real uploads.
- **Chat polls every 10 seconds** rather than using Supabase Realtime.
- **Reviews have no submission page.** The schema, dashboard, and public
  display all exist; the neighbor-facing form does not.
- **`referrals` and `boosts` are schema-only** — no UI reads or writes them.
- **Nothing verifies a P2P payment actually arrived.** The memo makes a transfer
  traceable by hand; the app cannot see Venmo or Zelle, so `payment_status` for
  these is a claim, not a fact.
- **No automatic capture deadline.** The build summary describes a 48-hour
  auto-release; that would be a scheduled job, not part of this app.
- **`npm audit` flags PostCSS** inside Next's own dependency tree. It is
  build-time only; clearing it requires a Next 16 major upgrade.
