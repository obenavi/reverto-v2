-- ── M3: Row Level Security ────────────────────────────────────
-- Run this in the Supabase SQL editor AFTER:
--   1. Setting SUPABASE_KEY in Netlify env vars to the SERVICE ROLE key
--      (Settings > API > service_role — keep this secret, server-side only)
--   2. Deploying the updated Netlify Functions
--
-- With RLS enabled and no permissive policies, the anon key cannot
-- read or write any of these tables. Netlify Functions use the service
-- role key which bypasses RLS — data isolation is enforced at the
-- function level (user_id injected from JWT).

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_revenues   ENABLE ROW LEVEL SECURITY;

-- Verify RLS is active
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users','invoices','invoice_items','suppliers','daily_revenues');
