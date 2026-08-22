# Deploying HelloNeighbor

Everything the code needs is done. What remains needs *your* accounts — I have
no credentials for Vercel or Apple and cannot create them.

## 1. Put it online (~15 minutes)

Supabase is already live: project `helloneighbor`, ref `rytwnyqnokidcybiwckk`,
us-east-1, all four migrations applied.

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

- **Get a lawyer to read `/guidelines` and `/privacy`.** The liability clause is
  wording, not protection, and a platform connecting minors with strangers
  carries exposure that wording does not remove.
- **Answer the COPPA question.** The schema accepts 8-year-olds.
- **Consider insurance.** General liability, at minimum.
