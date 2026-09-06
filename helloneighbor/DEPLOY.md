# Running and deploying HelloNeighbor

Everything the code needs is done. What remains needs *your* accounts — nobody
here has credentials for Supabase secrets, Vercel, Twilio or Apple.

Supabase is already live: project `helloneighbor`, ref `rytwnyqnokidcybiwckk`,
us-east-1, **32 migrations applied**. The tables are empty; there are no
accounts yet.

---

## 0. Just browse it, on your own machine (~5 minutes)

This is the shortest path to clicking around, and it needs four values and no
paid services.

```bash
cd helloneighbor
npm install
cp .env.example .env.local     # then fill in the four below
npm run dev                    # http://localhost:3000
```

| Variable | Where from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rytwnyqnokidcybiwckk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (secret) |
| `SESSION_SECRET` | `openssl rand -base64 32` |

Three things make this work without Twilio, Anthropic or a lawyer, and **all
three are switched off the moment `NODE_ENV=production`**:

- **Login codes come back in the response** instead of by SMS, so you can log
  in with no Twilio account. `app/api/auth/request-code/route.ts`.
- **Listings go live without the supervisor.** With no `ANTHROPIC_API_KEY`
  every new service would otherwise stay hidden pending a review that can never
  happen. `app/api/operators/services/route.ts`.
- **The jurisdiction gate lets you through.** See the warning below — this is
  the one that confuses people on their first real deploy.

### A path through the app that touches most of it

1. `/join` — sign up. Put an age of 15 to see the guardian flow, or 30 to see
   the app as an adult uses it.
2. The response tells you the login code. `/login` with the same phone.
3. `/admin/login` with `ADMIN_PASSWORD` — approve the account. (Try approving a
   15-year-old *before* the guardian consents: it should refuse.)
4. Dashboard → Services → add one. Pick "Something else" to name your own, and
   try typing "babysitting" to watch it get refused.
5. Dashboard → Schedule → open a time. Then **My link** → copy it.
6. Open that link in another browser and book yourself. You will land in the
   thread with the payment poll waiting.

---

## Running a pilot: making it free for everyone

Set one environment variable:

```
PILOT_FREE_UNTIL=2026-12-31
```

Nobody is charged before that date. There are no codes to hand out and no rows
to update — it applies to every account, including ones created during the
pilot, whose first renewal is pushed to the end of the pilot rather than
landing a month after they signed up.

It ends by itself. That is the point of a date rather than a switch: a pilot
you have to remember to turn off is a pilot that runs for a year.

Three things worth knowing:

- **A promo code that runs past the pilot is not cut short**, and an expired
  promo does not pull somebody out of the pilot. The later of the two wins.
- **A minor with no adult on their account still cannot take work.** Free does
  not change that, and the dashboard still says so.
- **A value the code cannot read is ignored and logged**, not treated as
  "free forever". Check your logs after setting it if you want to be sure —
  or run `npm test`, which refuses several plausible typos by name.

To end a pilot early, remove the variable and redeploy. Anyone whose renewal
was pushed to the pilot date keeps that date; they are not billed retroactively.

---

## ⚠️ The thing that will confuse you on a real deploy

**In production, every signup is refused, on purpose.**

`lib/jurisdictions.ts` requires a named counsel sign-off per state before that
state is enabled, and California's entry currently reads
`reviewedBy: 'PENDING — no counsel sign-off yet'`. An unreviewed jurisdiction
fails closed in production, so a deployed build turns everyone away.

That is the intended behaviour and the fix is not a code change — it is a
lawyer's name in that file, once one has actually read `docs/COMPLIANCE.md`.
Until then, `NODE_ENV=development` locally is how you see the app work.

---

## 1. Put it online (~15 minutes)

```bash
npm install -g vercel
cd helloneighbor
vercel login
vercel --prod
```

When it asks for the root directory, answer `helloneighbor` — the repo root is
a different app.

### Environment variables

In the Vercel dashboard → your project → Settings → Environment Variables, add
these for **Production, Preview and Development**. Get the Supabase values from
[the API settings page](https://supabase.com/dashboard/project/rytwnyqnokidcybiwckk/settings/api).

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rytwnyqnokidcybiwckk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` secret — **server-side only** |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `ADMIN_PASSWORD` | something long. Not `demo123`. |
| `NEXT_PUBLIC_SITE_URL` | your real URL, e.g. `https://helloneighbor.vercel.app` |
| `ANTHROPIC_API_KEY` | from console.anthropic.com |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | Twilio console |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | dash.cloudflare.com → Turnstile (free) |
| `CRON_SECRET` | Vercel sets this when you add the cron in `vercel.json` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:` your safety address |
| `SAFETY_ALERT_PHONE` | a number that should be texted about urgent reports |
| `RESEND_API_KEY` / `EMAIL_FROM` | resend.com — **required**, guardian consent is emailed |
| `ADMIN_ACCESS_KEY` | a long random string; the admin login 404s without it |
| `ADMIN_ALLOWED_IPS` | optional comma-separated IP allowlist for the admin area |
| `AGE_PROVIDER_URL` / `AGE_PROVIDER_API_KEY` | optional facial age estimation (Yoti, Persona, Incode, Veriff) |

Redeploy after adding them: `vercel --prod`.

**`NEXT_PUBLIC_SITE_URL` matters more than it looks.** Booking links, chat links
and guardian-consent links are all built from it. Wrong value = links that go
nowhere.

### Then check, in this order

1. `/` loads.
2. `/join` — sign up as a 15-year-old. A consent SMS should reach the guardian
   number you enter.
3. Open the consent link, approve it.
4. `/admin/login`, approve the operator. (Try approving *before* consent — it
   should refuse.)
5. `/login` with the operator's phone; the code arrives by SMS.
6. Add a service and a slot, copy the booking link.
7. Book yourself from another browser. You should land in the chat with the
   payment poll waiting.

## 2. On a phone, today — no app store

The app is already a PWA. On the deployed URL:

- **iPhone**: Safari → Share → Add to Home Screen
- **Android**: Chrome offers an install prompt

It then opens fullscreen with its own icon and behaves like an app. For most
neighborhood apps this is genuinely enough, and it ships today.

## 3. The App Store — read this before spending money

An App Store listing needs four things I cannot do for you:

1. **Apple Developer Program** — $99/year, and an individual enrollment
   requires you to be 18+.
2. **A Mac with Xcode.** No way around this; iOS builds cannot be produced on
   Linux.
3. **A native wrapper.** This is a server-rendered Next.js app, so it cannot be
   statically exported into Capacitor. The wrapper would be a WKWebView shell
   pointing at your deployed URL.
4. **App Review**, which is where the real risk is.

### Be aware of three likely rejections

**Guideline 4.2 — Minimum Functionality.** A webview wrapper around a website,
with no native capability, is the single most commonly rejected app type. Push
notifications are now implemented, which is the strongest single answer to
this — but in a wrapper you would want them delivered natively (APNs through
the wrapper) rather than as web push, and ideally one more native integration
such as contacts or the camera for gallery photos.

**Guideline 1.2 — User-Generated Content.** An app with UGC and messaging must
have a content filter, a way to report abuse, a way to block users, and a
published contact. **All four now exist**: the supervisor agent filters, every
conversation has report-and-block, `/safety` is the published contact, and the
admin queue tracks response time against a stated target. Point the reviewer at
`/safety` in your review notes.

**Kids and safety.** An app whose users are largely minors, arranging in-person
meetings with adults at private homes, will get close scrutiny. Expect
questions about age verification, guardian consent (you have this — good), and
what happens when something goes wrong. Apple may also require a
Kids-Category-style privacy posture.

### If you still want it

Ship the PWA first, get real usage, then build a native app deliberately — with
push notifications and in-app reporting as genuine native features. That
sequence is both cheaper and much likelier to pass review.

## Before any of this is a real product

- **Have your lawyer look specifically at the age check.** Biometrics is the
  highest-risk thing in this codebase. Even storing no image, Illinois BIPA
  wants written notice and consent before capture and a published retention
  schedule; some operators avoid Illinois entirely rather than take it on. Ask
  whether you should ship the check at all, or lean on guardian consent alone.
- **Get a lawyer to read `/guidelines` and `/privacy`.** The liability clause is
  wording, not protection, and a platform connecting minors with strangers
  carries exposure that wording does not remove.
- **Answer the employment-agency question.** The only money the platform takes
  is a subscription from the *provider* — a fee charged to the worker, which is
  the pattern several states regulate under employment-agency and job-listing
  statutes. Unresolved; see `docs/COMPLIANCE.md`.
- **Consider insurance.** General liability, at minimum.
