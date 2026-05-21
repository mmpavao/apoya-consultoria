/**
 * Evolution API v2 — HTTP client (server-only).
 * NUNCA importar em código de cliente.
 */
type EvoMethod = "GET" | "POST" | "PUT" | "DELETE";

export class EvolutionError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function baseUrl(): string {
  const u = process.env.EVOLUTION_API_URL;
  if (!u) throw new Error("EVOLUTION_API_URL ausente nos secrets");
  return u.replace(/\/+$/, "");
}

function masterKey(): string {
  const k = process.env.EVOLUTION_API_KEY;
  if (!k) throw new Error("EVOLUTION_API_KEY ausente nos secrets");
  return k;
}

/** Public base URL para webhooks. Detectado em runtime no createInstance. */
export function publicBaseUrlFromRequest(req: Request): string {
  const fromEnv = process.env.PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function evo<T = any>(
  method: EvoMethod,
  path: string,
  body?: unknown,
  instanceApiKey?: string | null,
): Promise<T> {
  const url = `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: instanceApiKey || masterKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = text ? JSON.parse(text) : {}; } catch { /* ignore */ }
  if (!res.ok) {
    console.error(`[evolution] ${method} ${path} → ${res.status}`, parsed);
    throw new EvolutionError(`Evolution ${method} ${path} → ${res.status}`, res.status, parsed);
  }
  return parsed as T;
}
