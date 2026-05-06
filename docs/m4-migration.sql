-- ── M4: Auth Refactor — run in Supabase SQL Editor ───────────

-- Step 1: Add personal_code column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_code text UNIQUE;

-- Step 2: Create access_codes table
CREATE TABLE IF NOT EXISTS access_codes (
  code            text PRIMARY KEY,
  type            text NOT NULL CHECK (type IN ('pilot', 'generic', 'personal')),
  duration_months int  NOT NULL DEFAULT 0,
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Step 3: Enable RLS (Netlify Functions use service role key, bypasses RLS)
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- Step 4: Seed REVERTO generic codes
INSERT INTO access_codes (code, type, duration_months, is_active) VALUES
  ('REVERTO03', 'generic', 3, true),
  ('REVERTO06', 'generic', 6, true)
ON CONFLICT (code) DO NOTHING;

-- Step 5: Add your PILOT-001 code
-- First run this to find your user UUID:
--   SELECT id, business_name, email FROM users;
--
-- Then replace YOUR_USER_UUID and run:
--   INSERT INTO access_codes (code, type, duration_months, user_id, is_active)
--   VALUES ('PILOT-001', 'pilot', 0, 'YOUR_USER_UUID', true)
--   ON CONFLICT (code) DO NOTHING;
