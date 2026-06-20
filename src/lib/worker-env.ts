/**
 * worker-env — leitura fail-closed de secrets/vars no Cloudflare Worker.
 *
 * Ordem: process.env (nodejs_compat) → globalThis.__env__ (injetado em server.ts).
 * NUNCA hardcode secrets no código-fonte.
 */

type EnvRecord = Record<string, string | undefined>;

function readEnv(key: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" ? process.env?.[key] : undefined;
  if (fromProcess && fromProcess.length > 0) return fromProcess;

  const fromGlobal = (globalThis as { __env__?: EnvRecord }).__env__?.[key];
  if (fromGlobal && fromGlobal.length > 0) return fromGlobal;

  return undefined;
}

/** Lê variável obrigatória — lança se ausente ou vazia. */
export function requireEnv(key: string): string {
  const value = readEnv(key);
  if (!value?.trim()) {
    throw new Error(
      `[security] ${key} não configurado. Configure no Cloudflare Worker (wrangler secret) ou .env.local para dev.`,
    );
  }
  return value;
}

/** Token de serviço interno (gestão → MCP, webhooks internos). */
export function getApoyaServiceToken(): string {
  return requireEnv("APOYA_SERVICE_TOKEN");
}

/** Anon/publishable key do Supabase (pública, mas vem do env — não hardcode). */
export function getSupabaseAnonKey(): string {
  return (
    readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    readEnv("SUPABASE_PUBLISHABLE_KEY") ??
    requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY")
  );
}

export function getSupabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export const SUPABASE_URL =
  readEnv("SUPABASE_URL") ??
  readEnv("VITE_SUPABASE_URL") ??
  "https://ajaqbdsalxfgrwpjbtbn.supabase.co";

/** URL do worker MCP — staging vs produção via WORKER_ENV ou MCP_URL explícito. */
export function getMcpUrl(): string {
  const explicit = readEnv("MCP_URL");
  if (explicit) return explicit;

  const env = readEnv("WORKER_ENV");
  if (env === "staging") {
    return "https://apoya-mcp-staging.talkzzbot.workers.dev/mcp";
  }
  return "https://apoya-mcp.talkzzbot.workers.dev/mcp";
}
