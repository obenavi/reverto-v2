-- ── M9: Market + Community — run in Supabase SQL Editor ──────

-- 1. Create community_prices table
CREATE TABLE IF NOT EXISTS community_prices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name  text NOT NULL,
  avg_price     numeric,
  min_price     numeric,
  max_price     numeric,
  median_price  numeric,
  sample_count  int,
  period        text NOT NULL,   -- 'YYYY-MM'
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS (functions use service role key, bypasses RLS)
ALTER TABLE community_prices ENABLE ROW LEVEL SECURITY;

-- 3. Index for fast period lookups
CREATE INDEX IF NOT EXISTS idx_community_prices_period ON community_prices(period);

-- Verify
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'community_prices';
