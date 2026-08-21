import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Empty strings count as unset — a blank line in .env.local should behave the
// same as a missing one, which `??` would not do.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;

let browserClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * Browser-safe client, constrained by the RLS policies in
 * supabase/migrations/001_init_schema.sql.
 *
 * Built lazily: constructing it at module scope would throw on import in any
 * route that merely shares this file, before that route could return its own
 * error or redirect.
 */
export function supabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.'
    );
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}

/**
 * Server-only client using the service role key. Bypasses RLS, so it must
 * never be imported from a component that ships to the browser.
 */
export function supabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill them in.'
    );
  }

  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
