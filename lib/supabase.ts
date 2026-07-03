import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Prefer the server-only service-role key when set. It bypasses Row Level
// Security, which lets you turn RLS ON and deny the public `anon` role outright
// (the anon key is shipped-to-browser by design and must not be the only thing
// guarding the data). Falls back to the anon key so nothing breaks until
// SUPABASE_SERVICE_ROLE_KEY is configured.
//
// SAFE because this module is imported ONLY by server route handlers (verified:
// no client component imports it), so the service-role key never reaches the
// browser. Do NOT prefix it NEXT_PUBLIC_, and do NOT import this from a client
// component.
// Use `|| trim` (not `??`) so a blank/whitespace value in the env falls back to
// the anon key rather than breaking every query with an empty key.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Pass cache:'no-store' to every fetch Supabase makes internally.
// Without this, Next.js 14 App Router caches all fetch() calls — including
// Supabase's PostgREST requests — causing stale data to be returned even
// after fresh inserts.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }),
  },
});
