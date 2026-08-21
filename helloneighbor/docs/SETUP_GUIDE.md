# HelloNeighbor - Setup & Deployment Guide

Complete step-by-step instructions to get from this scaffold to a working product.

## Phase 1: Local Development (1-2 hours)

### Step 1: Clone & Install

```bash
cd /home/user/reverto-v2
npm install
```

**Verify Installation:**
```bash
npm list next react tailwindcss
# Should show:
# next@14.x.x
# react@18.x.x
# tailwindcss@3.x.x
```

### Step 2: Setup Supabase

**Create project:**
1. Go to https://supabase.com
2. Click "New Project"
3. Choose region (e.g., us-east-1)
4. Wait for provisioning (2-3 min)

**Get credentials:**
1. Go to Project Settings → API
2. Copy `Project URL` → `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

**Run migrations:**
```bash
# Option A: SQL Editor (easiest)
# 1. Go to Supabase SQL Editor
# 2. Open supabase/migrations/001_init_schema.sql
# 3. Copy entire content
# 4. Paste in SQL Editor
# 5. Click "Run"

# Option B: Supabase CLI (for repeat use)
npm install -g @supabase/cli
supabase link --project-ref your_project_ref
supabase db push
```

**Test connection:**
```bash
# Add temp test file: lib/test.ts
import { supabase } from '@/lib/supabase'

export async function testConnection() {
  const { data, error } = await supabase
    .from('subscribers')
    .select('count(*)')
  console.log(data, error)
}
```

### Step 3: Setup Stripe

**Create test account:**
1. Go to https://stripe.com/register
2. Skip onboarding (we're in test mode)
3. Dashboard → Developers → API Keys

**Get test keys:**
1. Copy "Publishable key" (pk_test_...) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
2. Copy "Secret key" (sk_test_...) → `STRIPE_SECRET_KEY`

**Create webhook endpoint:**
1. Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `http://localhost:3000/api/stripe/webhook` (for testing)
4. Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.captured`
5. Copy webhook secret → `STRIPE_WEBHOOK_SECRET`

**Test webhook locally:**
```bash
# Install Stripe CLI
# Mac: brew install stripe/stripe-cli/stripe
# Linux: sudo apt install stripe (or download)
# Windows: choco install stripe

# Start forwarding
stripe listen --forward-to localhost:3000/api/stripe/webhook

# In another terminal, trigger test event
stripe trigger payment_intent.succeeded
```

### Step 4: Setup Twilio

**Create test account:**
1. Go to https://www.twilio.com/try-twilio
2. Sign up with email
3. Dashboard → Account → API Credentials

**Get credentials:**
1. Copy "Account SID" → `TWILIO_ACCOUNT_SID`
2. Copy "Auth Token" → `TWILIO_AUTH_TOKEN`
3. Get a trial phone number:
   - Go to Phone Numbers → Manage Numbers
   - Click "Get a Trial Number"
   - Confirm → Copy number → `TWILIO_PHONE_NUMBER`

**Test SMS:**
```bash
# Create test file: lib/test-sms.ts
import fetch from 'node-fetch'

async function testSMS() {
  const res = await fetch('/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '+15551234567', // Your test number
      message: 'Hello from HelloNeighbor!'
    })
  })
  console.log(await res.json())
}
```

### Step 5: Run Development Server

```bash
# Ensure all env vars are in .env.local
cat .env.local

# Start dev server
npm run dev

# Should output:
# ▲ Next.js 14.0.0
# - Local:        http://localhost:3000
# - Environments: .env.local
```

**Test in browser:**
1. Visit http://localhost:3000 → Landing page ✓
2. Click "Start my business" → /join ✓
3. Fill form → Submit → Success page ✓
4. Go to /admin/login → Enter "demo123" → Admin dashboard ✓

### Step 6: Test Full Flow Locally

**Operator Setup:**
```
1. http://localhost:3000/join
   - Name: "Alex"
   - Phone: "(555) 123-4567"
   - Area: "Hidden Hills, CA"
   - Age: 16
   - Submit

2. http://localhost:3000/admin (password: demo123)
   - Find "Alex" in pending
   - Click "Approve"

3. http://localhost:3000/login
   - Phone: "(555) 123-4567"
   - (Would send OTP via Twilio in production)
   - Login succeeds → Dashboard

4. Dashboard (/dashboard)
   - Click "Services" tab → Add services
   - Click "Schedule" tab → Add slots
   - Click "Profile" tab → Update info
   - Click "My Link" tab → Copy booking URL
```

**Neighbor Booking:**
```
1. http://localhost:3000/b/[operatorId]
   - Select service
   - Pick date/time
   - Enter details
   - Choose payment method
   - Confirm booking
   - Should see success message

2. Check operator dashboard
   - New booking appears in "Bookings" tab
```

---

## Phase 2: Deployment (1-2 hours)

### Step 1: Prepare for Vercel

**Update environment variables:**

Edit `.env.local` to use PRODUCTION credentials (not test):
- Replace `pk_test_` with `pk_live_` from Stripe live dashboard
- Replace `sk_test_` with `sk_live_` from Stripe live dashboard
- Keep Supabase URLs/keys (same for test and production)
- Set strong `ADMIN_PASSWORD`

**Create .env.production.local:**
```env
# Stripe LIVE (never test keys in production!)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...

# Twilio (same across environments)
TWILIO_ACCOUNT_SID=ACxx...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Admin
ADMIN_PASSWORD=YourSecurePassword123!
```

**Build test:**
```bash
npm run build
# Should complete without errors

# Start production server
npm start
# Visit http://localhost:3000
# Test that it works
```

### Step 2: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
# Follow prompts

# Vercel will show:
# ✓ Production: https://yourapp.vercel.app
```

**Configure environment variables in Vercel:**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add all keys from `.env.production.local`
5. Apply to: Production, Preview, Development
6. Redeploy

**Test production:**
```bash
# Deployment should show: https://yourapp.vercel.app
# Visit in browser and test
```

### Step 3: Update Stripe Webhook

**Add production webhook:**
1. Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://yourapp.vercel.app/api/stripe/webhook`
4. Events: Same as before
5. Copy new webhook secret
6. Update `STRIPE_WEBHOOK_SECRET` in Vercel env vars
7. Redeploy

### Step 4: Setup Production Supabase (Optional)

If using separate prod database:

1. Create new Supabase project for production
2. Run migrations on prod project
3. Update `NEXT_PUBLIC_SUPABASE_URL` to prod URL
4. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` to prod anon key
5. Update `SUPABASE_SERVICE_ROLE_KEY` to prod service key
6. Add to Vercel environment variables

---

## Phase 3: Optimize (Optional, 1-2 hours)

### Add Image Optimization
```bash
npm install next-image-export-optimizer
```

Update `next.config.js`:
```javascript
const withImageExport = require('next-image-export-optimizer').default;

module.exports = withImageExport({
  // ... existing config
});
```

### Add Error Tracking
```bash
npm install @sentry/nextjs
```

Initialize Sentry:
```typescript
// app/layout.tsx
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // ... config
})
```

### Add Analytics
```bash
npm install @vercel/analytics
```

Add to layout:
```typescript
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### Add Form Validation
```bash
npm install zod react-hook-form @hookform/resolvers
```

Example usage in `/join`:
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().regex(/^\+?[0-9\s\-()]+$/, 'Invalid'),
})

export default function JoinPage() {
  const { register, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  })
  // ...
}
```

---

## Troubleshooting

### "TypeError: fetch is not defined"
**Solution:** Add `node-fetch` for server components
```bash
npm install node-fetch
```

### "Supabase: connection refused"
**Solution:** Check that:
1. `NEXT_PUBLIC_SUPABASE_URL` is correct
2. Supabase project is running
3. RLS policies are not blocking access

### "Stripe webhook signature verification failed"
**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` is correct
2. Use Stripe CLI: `stripe listen` to test locally
3. Check webhook event history in Stripe dashboard

### "SMS not sending"
**Solution:**
1. Verify Twilio credentials in `.env.local`
2. Check Twilio phone number format: `+1234567890`
3. Check Twilio account has SMS credits
4. Test with curl:
```bash
curl -X POST http://localhost:3000/api/sms/send \
  -H "Content-Type: application/json" \
  -d '{"to":"+15551234567","message":"test"}'
```

### "Booking not appearing in dashboard"
**Solution:**
1. Hard refresh browser (Cmd+Shift+R)
2. Check Supabase RLS policies allow read access
3. Check booking is created: Supabase SQL Editor → `SELECT * FROM bookings`

---

## Checklist Before Launch

- [ ] All env vars set correctly
- [ ] Supabase migrations run successfully
- [ ] Stripe webhook receiving test events
- [ ] Twilio sending SMS successfully
- [ ] Landing page loads without errors
- [ ] Join form submits and creates subscriber
- [ ] Admin can approve operator
- [ ] Operator can login and setup profile
- [ ] Neighbor can book service
- [ ] Payment holds on card (Stripe manual capture)
- [ ] SMS notifications send
- [ ] Admin dashboard shows all data
- [ ] No console errors in browser

---

## Key Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Landing page |
| `/join` | GET, POST | Registration |
| `/login` | GET, POST | Operator login |
| `/dashboard` | GET | Operator dashboard |
| `/b/[operatorId]` | GET | Public booking |
| `/admin` | GET | Admin dashboard |
| `/admin/login` | GET, POST | Admin login |
| `/api/stripe/create-intent` | POST | Create payment intent |
| `/api/stripe/webhook` | POST | Stripe events |
| `/api/sms/send` | POST | Send SMS |

---

## Support Contacts

If you get stuck:
1. Check README.md for architecture docs
2. Check Supabase docs: https://supabase.com/docs
3. Check Stripe docs: https://stripe.com/docs
4. Check Twilio docs: https://www.twilio.com/docs
5. Check Next.js docs: https://nextjs.org/docs

---

Good luck with your launch! 🚀
