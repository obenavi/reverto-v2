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
| `NEXT_PUBLIC_SITE_URL` | shareable booking links | your deployed URL |

**Degrading gracefully is deliberate.** Without Twilio, messages are logged to
the server console and login codes are returned to the browser so you can still
test the flow — that fallback is disabled in production. Without Stripe, card
payments are refused with a clear message and cash-style bookings still work.

## Database

Run `supabase/migrations/001_init_schema.sql` once, either by pasting it into
the Supabase SQL Editor or with `supabase db push`.

It creates 11 tables — `subscribers`, `services`, `slots`, `bookings`, `pings`,
`reviews`, `gallery_photos`, `disputes`, `referrals`, `boosts`,
`operator_profiles` — and enables RLS on all of them.

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
6. Back in **`/dashboard` → Bookings**, mark it done. On a card booking that
   captures the held payment.

Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC.

For webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## How payment holds work

Card bookings use a **manual-capture PaymentIntent**. Booking authorizes the
card without charging it (`payment_status: held`); the operator marking the job
done captures it (`captured`); cancelling releases it (`released`). Admin
dispute resolution captures, releases, or refunds depending on who wins.

Cash, Venmo, Cash App, and Zelle are recorded but settled in person — the app
tracks status without moving money.

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/` | anyone | Landing page |
| `/join` | anyone | Operator self-registration |
| `/login` | operator | Phone + SMS code |
| `/dashboard` | operator | Bookings, schedule, pings, services, profile, link, gallery, reviews |
| `/b/[operatorId]` | anyone | Public booking, four steps |
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

## Known gaps

- **No image uploads.** Profile photos and gallery entries take URLs. Wire up
  Supabase Storage to accept real uploads.
- **Reviews have no submission page.** The schema, dashboard, and public
  display all exist; the neighbor-facing form does not.
- **`referrals` and `boosts` are schema-only** — no UI reads or writes them.
- **No automatic capture deadline.** The build summary describes a 48-hour
  auto-release; that would be a scheduled job, not part of this app.
- **`npm audit` flags PostCSS** inside Next's own dependency tree. It is
  build-time only; clearing it requires a Next 16 major upgrade.
