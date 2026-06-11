// Client-side Supabase client — uses anon/publishable key (safe to be public)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// VITE_ vars are substituted at build time by Vite for browser bundles.
// The fallback value IS the public anon key — this is intentional and safe.
// Supabase anon key is designed to be public (client-side safe).
// See: https://supabase.com/docs/guides/api/api-keys
// NEVER use the service_role key here — that belongs in supabase-server.ts only.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://ajaqbdsalxfgrwpjbtbn.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  // Fallback: public anon key — safe to hardcode in client-side code.
  // Rotate via Supabase Dashboard → Settings → API → anon key.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYXFiZHNhbHhmZ3J3cGpidGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDgzMjMsImV4cCI6MjA5NDg4NDMyM30.QI9pwP1W3x6jFzOPsI_8lTGCY8Moup0AIhcsoG6jDQM";

function createSupabaseClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
