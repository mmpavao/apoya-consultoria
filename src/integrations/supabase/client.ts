// Client-side Supabase client — uses anon/publishable key (safe to be public)
// NOTE: VITE_ vars are replaced at BUILD TIME by Vite for browser bundles.
// For SSR/Cloudflare Workers runtime, we fall back to globalThis.__env__ or process.env.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (typeof globalThis !== "undefined" ? (globalThis as any).__env__?.VITE_SUPABASE_URL : undefined) ??
  (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_URL ?? process.env?.SUPABASE_URL : undefined) ??
  "https://ajaqbdsalxfgrwpjbtbn.supabase.co";

// anon key is PUBLIC by Supabase design — safe to include in client-side code.
// Resolution order:
// 1. Vite build-time substitution (browser bundles)
// 2. Cloudflare Workers runtime via globalThis.__env__ (SSR)
// 3. process.env fallback (nodejs_compat)
// 4. Throw with clear message if genuinely absent (misconfiguration)
function getAnonKey(): string {
  const key =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    (typeof globalThis !== "undefined" ? (globalThis as any).__env__?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined) ??
    (typeof globalThis !== "undefined" ? (globalThis as any).__env__?.SUPABASE_PUBLISHABLE_KEY : undefined) ??
    (typeof process !== "undefined" ? process.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined);

  if (!key || key.length < 20) {
    throw new Error(
      "[config] Supabase anon key not found. " +
      "For Cloudflare Workers: configure VITE_SUPABASE_PUBLISHABLE_KEY as a Worker secret. " +
      "For local dev: add VITE_SUPABASE_PUBLISHABLE_KEY to .env. " +
      "The anon key is public and safe to include in client code."
    );
  }
  return key;
}

function createSupabaseClient() {
  return createClient<Database>(SUPABASE_URL, getAnonKey(), {
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
