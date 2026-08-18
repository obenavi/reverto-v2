# HelloNeighbor - SaaS Marketplace for Neighborhood Services

A production-ready Next.js + Supabase + Stripe platform for neighborhood service providers (kids, teens) to offer services like babysitting, dog walking, car washing, and tutoring.

## 🚀 Features

- **Public Booking Page** (`/b/[operatorId]`) - Neighbors browse services and book without login
- **Operator Dashboard** - Service providers manage bookings, slots, reviews, and profile
- **Admin Dashboard** - Approve operators, manage disputes, track revenue
- **Phone OTP Authentication** - Secure login for operators
- **Stripe Payment Integration** - Manual capture holds on payment until service confirmation
- **SMS Notifications** - Twilio for booking confirmations and reminders
- **File Storage** - Supabase Storage for profile photos, gallery, proof-of-work
- **Row-Level Security** - Privacy controls with Supabase RLS policies
- **Referral Program** - Operators earn free months by referring friends
- **Boost/Featured Listings** - Pay-to-pin profile at top of results

## 📋 Project Structure

```
app/
├── layout.tsx              # Root layout
├── globals.css            # Global styles (Tailwind)
├── page.tsx               # Landing page
├── join/                  # Registration form
├── login/                 # Operator login
├── dashboard/             # Operator dashboard (protected)
├── b/[operatorId]/        # Public booking page
├── admin/                 # Admin dashboard
│   ├── page.tsx          # Admin dashboard
│   └── login/            # Admin password login
└── api/
    ├── stripe/
    │   ├── create-intent/  # Create Stripe payment intent
    │   └── webhook/        # Stripe webhook handler
    └── sms/
        └── send/           # Send SMS via Twilio

lib/
├── supabase.ts           # Supabase client
└── types.ts              # TypeScript types

supabase/
└── migrations/
    └── 001_init_schema.sql  # Database schema
```

## 🔧 Tech Stack

- **Frontend**: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + Storage)
- **Payments**: Stripe (Payment Intents with manual capture)
- **SMS**: Twilio
- **Hosting**: Vercel (frontend) + Supabase (backend)

## 📦 Data Model

### Core Tables

- **subscribers** - Operators (service providers)
- **services** - Services offered by each operator
- **slots** - Available time slots
- **bookings** - Confirmed bookings
- **pings** - Availability inquiries from neighbors
- **reviews** - Public & private feedback
- **gallery_photos** - Work portfolio photos
- **disputes** - Payment disputes
- **referrals** - Referral program tracking
- **boosts** - Featured listing purchases

## ⚡ Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Stripe account
- Twilio account

### 1. Setup Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

ADMIN_PASSWORD=your_secure_password
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Supabase

Create a new Supabase project, then:

```bash
# Option A: Use SQL migrations
# Copy the SQL from supabase/migrations/001_init_schema.sql
# Run it in Supabase SQL Editor

# Option B: Use Supabase CLI (recommended)
npm install -g @supabase/cli
supabase init
supabase link --project-ref your_project_ref
supabase db push
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

### 5. Testing

**Operator Flow:**
1. Go to `/join` and fill the form
2. Use admin to approve at `/admin` (password: `demo123`)
3. Login at `/login` with phone number
4. Set up services, slots, and profile

**Neighbor Flow:**
1. Visit `/b/[operatorId]` (the public booking page)
2. Select service → date/time → enter details
3. Confirm booking

**Admin:**
1. Go to `/admin/login` (password: `demo123`)
2. Approve pending operators
3. View all bookings and disputes

## 🔐 Authentication

### Operators
- **Login**: Phone number → OTP (via Twilio)
- **Session**: Stored in `localStorage` as `operatorId`

### Admin
- **Login**: Password only
- **Session**: Stored in `sessionStorage` as `adminAuth`

### Neighbors
- **No login required** - Anonymous booking

## 💳 Payment Flow

### Manual Capture (Stripe Card Payments)

1. Neighbor selects Stripe and enters card details
2. System creates **payment intent** with `capture_method: 'manual'`
3. Payment is **held** (not captured) on card
4. After service: Operator marks as "completed"
5. System **captures** the held payment
6. **Auto-release** after 48h if no confirmation (via Edge Function)

### Other Payment Methods
- **Cash**: Neighbor pays provider directly after service
- **Venmo/Cash App/Zelle**: Neighbor sends payment per provider's handle

## 📱 SMS Notifications

Triggered automatically:

- ✅ Booking confirmation (to both parties)
- ⏰ Appointment reminder (2h before)
- ⭐ Review request (2h after service)
- ❌ Cancellation notice

All via `POST /api/sms/send`

## 🗃️ File Storage

Supabase Storage buckets:

- `operator_photos` - Profile pictures
- `gallery_photos` - Work portfolio (before/after)
- `proof_photos` - Job completion proof

## 🚀 Deployment

### Vercel (Frontend)

```bash
npm install -g vercel
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# ... add other env vars
vercel deploy
```

### Supabase (Backend)

No special setup needed - Supabase hosts itself. Just ensure your API keys are in Vercel env vars.

## 📖 API Routes

### POST `/api/stripe/create-intent`
Create Stripe payment intent with manual capture
```json
{
  "amount": 25.00,
  "bookingId": "uuid",
  "operatorId": "uuid",
  "description": "Car wash booking"
}
```

### POST `/api/stripe/webhook`
Stripe webhook handler - processes payment events

### POST `/api/sms/send`
Send SMS notification
```json
{
  "to": "+15551234567",
  "message": "Your booking with Alex is confirmed for..."
}
```

## 🔄 Supabase Edge Functions (TODO)

To auto-release held Stripe payments after 48h:

```typescript
// supabase/functions/release-held-payments/index.ts
import Stripe from 'stripe'

// Runs on schedule, finds bookings where:
// - payment_status = 'captured' (held)
// - created_at + 48 hours < now
// - status != 'completed'
// Then releases via stripe.paymentIntents.cancel()
```

## 🧪 Testing

### Test Stripe Card
Use `4242 4242 4242 4242` with any future date and any CVV (test mode only)

### Test Twilio
Use fake numbers - Twilio test account doesn't send real SMS

### Test Database
Use Supabase local development with `supabase start` (requires Docker)

## 📚 Key Files to Customize

- `app/globals.css` - Brand colors (currently Hello Neighbor blue)
- `tailwind.config.ts` - Color palette
- `.env.local` - API credentials
- `lib/types.ts` - Data structure (if extending features)
- `supabase/migrations/001_init_schema.sql` - Database schema

## 🐛 Common Issues

**"No account found with that number"**
- Make sure subscriber is in `active` status (not `pending`)
- Admin must approve first at `/admin`

**Booking not appearing in operator dashboard**
- Refresh the page
- Check Supabase RLS policies allow the operator to read their bookings

**Stripe webhook not working**
- Verify `STRIPE_WEBHOOK_SECRET` is set correctly
- Check Stripe dashboard → Developers → Webhooks for webhook history

**SMS not sending**
- Check Twilio account has credits
- Verify phone number format includes country code (+1)

## 📝 Notes

- All money is in USD
- All times are in 24-hour format
- Dates are YYYY-MM-DD
- Timezone handling: store as ISO 8601 UTC, display based on operator's area
- RLS policies ensure operators only see/modify their own data

## 🔄 Next Steps

1. **Test locally** - Run dev server and test the full flow
2. **Deploy to Vercel** - Push to production
3. **Integrate Telegram** - Add admin notifications
4. **Enable Supabase Auth** - Add proper phone OTP via Supabase Auth
5. **Add Sentry** - Error tracking
6. **Add analytics** - Track user behavior
7. **Expand services** - Add more default services and allow custom ones

## 📞 Support

For issues or questions:
1. Check Supabase docs: https://supabase.com/docs
2. Check Stripe docs: https://stripe.com/docs
3. Check Twilio docs: https://www.twilio.com/docs

---

Built with ❤️ for neighborhood entrepreneurs
