/**
 * supabase-server.ts — acesso server-side ao Supabase com SERVICE_ROLE
 * 
 * No Cloudflare Workers com nodejs_compat_populate_process_env,
 * os secrets ficam disponíveis em process.env.
 * Fallback para a key hardcoded em caso de cold-start edge cases.
 */

const SUPA_URL = "https://ajaqbdsalxfgrwpjbtbn.supabase.co";

function getServiceRoleKey(): string {
  // 1. Cloudflare Workers com nodejs_compat_populate_process_env
  const fromProcess = (typeof process !== "undefined" && process.env?.SUPABASE_SERVICE_ROLE_KEY) 
    ? process.env.SUPABASE_SERVICE_ROLE_KEY 
    : undefined;
  if (fromProcess && fromProcess.length > 20) return fromProcess;

  // 2. globalThis.__env__ (padrão CF Workers via middleware)
  const fromGlobal = (globalThis as any).__env__?.SUPABASE_SERVICE_ROLE_KEY;
  if (fromGlobal && fromGlobal.length > 20) return fromGlobal;

  // 3. Fallback hardcoded (service_role key do projeto APOYA — só tem poder server-side)
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYXFiZHNhbHhmZ3J3cGpidGJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTMwODMyMywiZXhwIjoyMDk0ODg0MzIzfQ.nCTertvc35fUqUYBWORTGFx5UT5MdpacW2tMP1jXYoI";
}

export function getSupabaseServiceHeaders(): Record<string, string> {
  const key = getServiceRoleKey();
  return {
    "Content-Type": "application/json",
    "Prefer": "return=representation",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
  };
}

export async function supabaseServiceFetch(
  table: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  params?: string,
  body?: unknown
): Promise<unknown> {
  const url = `${SUPA_URL}/rest/v1/${table}${params ? "?" + params : ""}`;
  const headers = getSupabaseServiceHeaders();
  if (method !== "GET") {
    headers["Prefer"] = "return=representation";
  }
  const r = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r.json().catch(() => ({}));
}
