-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Subscribers/Operators Table
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL,
  age INTEGER NOT NULL,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  joined_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  activated_date TIMESTAMP WITH TIME ZONE,
  paid_months INTEGER DEFAULT 0,
  monthly_fee DECIMAL(10, 2) DEFAULT 14.99,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
  notes TEXT,
  referred_by UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  free_months INTEGER DEFAULT 0,
  boost_active BOOLEAN DEFAULT false,
  setup_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Operator Profile Table
CREATE TABLE operator_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL UNIQUE REFERENCES subscribers(id) ON DELETE CASCADE,
  photo_url TEXT,
  display_name TEXT,
  age INTEGER,
  area TEXT,
  bio TEXT,
  parent_phone TEXT,
  instagram TEXT,
  tiktok TEXT,
  pay_methods TEXT[] DEFAULT ARRAY[]::TEXT[],
  venmo_handle TEXT,
  cashapp_handle TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Services Table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  duration TEXT,
  tools TEXT,
  client_provides TEXT,
  requirements TEXT,
  upgrades JSONB DEFAULT '[]'::JSONB,
  subjects TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(operator_id, name)
);

-- Availability Slots Table
CREATE TABLE slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  urgent BOOLEAN DEFAULT false,
  booked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Bookings Table
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT NOT NULL,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE SET NULL,
  slot_id UUID REFERENCES slots(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  selected_upgrades JSONB DEFAULT '[]'::JSONB,
  notes TEXT,
  total_price DECIMAL(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'venmo', 'cashapp', 'zelle', 'stripe')),
  payment_timing TEXT NOT NULL DEFAULT 'after' CHECK (payment_timing IN ('before', 'after')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'captured', 'released', 'disputed', 'failed')),
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled')),
  client_favorited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Pings (Availability Requests) Table
CREATE TABLE pings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  when_available TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'booked', 'declined')),
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Reviews Table
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  public_text TEXT,
  reviewer_name TEXT NOT NULL,
  photo_url TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Gallery Photos Table
CREATE TABLE gallery_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Disputes Table
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('no_show', 'incomplete', 'damage', 'safety', 'overcharged', 'other')),
  details TEXT NOT NULL,
  photo_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'refunded')),
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Referrals Table
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_code TEXT NOT NULL,
  referrer_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES subscribers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Boosts Table
CREATE TABLE boosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  days_count INTEGER NOT NULL CHECK (days_count IN (7, 14, 30)),
  price DECIMAL(10, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_subscribers_phone ON subscribers(phone);
CREATE INDEX idx_subscribers_status ON subscribers(status);
CREATE INDEX idx_services_operator_id ON services(operator_id);
CREATE INDEX idx_slots_operator_id ON slots(operator_id);
CREATE INDEX idx_slots_date ON slots(date);
CREATE INDEX idx_bookings_operator_id ON bookings(operator_id);
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_pings_operator_id ON pings(operator_id);
CREATE INDEX idx_reviews_operator_id ON reviews(operator_id);
CREATE INDEX idx_disputes_booking_id ON disputes(booking_id);

-- Enable RLS (Row Level Security)
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE boosts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Subscribers (public read, self update)
CREATE POLICY "Subscribers are viewable by everyone"
  ON subscribers FOR SELECT
  USING (true);

CREATE POLICY "Operators can update their own profile"
  ON subscribers FOR UPDATE
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- RLS Policies - Services (public read, operator can manage)
CREATE POLICY "Services are viewable by everyone"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "Operators can manage their services"
  ON services FOR ALL
  USING (auth.uid()::text = operator_id::text)
  WITH CHECK (auth.uid()::text = operator_id::text);

-- RLS Policies - Slots (public read, operator can manage)
CREATE POLICY "Slots are viewable by everyone"
  ON slots FOR SELECT
  USING (true);

CREATE POLICY "Operators can manage their slots"
  ON slots FOR ALL
  USING (auth.uid()::text = operator_id::text)
  WITH CHECK (auth.uid()::text = operator_id::text);

-- RLS Policies - Bookings (operator can see their bookings)
CREATE POLICY "Operators can see their bookings"
  ON bookings FOR SELECT
  USING (auth.uid()::text = operator_id::text);

-- RLS Policies - Reviews (public read, operator can see their reviews)
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT
  USING (is_public OR auth.uid()::text = operator_id::text);
