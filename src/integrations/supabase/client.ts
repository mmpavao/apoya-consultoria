// Client-side Supabase client — uses anon/publishable key (safe to be public)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// These are substituted at build time by Vite (VITE_ prefix).
// Fallback values are hardcoded as they are the public anon key (not secret).
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://ajaqbdsalxfgrwpjbtbn.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("[security] VITE_SUPABASE_PUBLISHABLE_KEY não configurado. Adicione ao .env (anon key do Supabase).");
}

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
