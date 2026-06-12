import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// Domínio canônico de produção — redirecionar workers.dev para o domínio real
const CANONICAL_HOST = "apoyaproject.zapro.tech";
const REDIRECT_HOSTS = ["apoya-gestao.talkzzbot.workers.dev"];

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Redirect canônico: workers.dev → domínio de produção real
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.includes(url.hostname)) {
      const canonical = new URL(request.url);
      canonical.hostname = CANONICAL_HOST;
      canonical.protocol = "https:";
      return Response.redirect(canonical.toString(), 301);
    }

    // ── Injetar secrets/vars do CF Worker em globalThis.__env__ ──────────────
    // Necessário para que rotas server-side (api/pipeline, api/das, etc.)
    // consigam ler APOYA_SERVICE_TOKEN e outros secrets via (globalThis as any).__env__
    if (env && typeof env === "object") {
      (globalThis as any).__env__ = env;
      // Também popular process.env para compatibilidade com libs que usam process.env
      if (typeof process !== "undefined") {
        for (const [k, v] of Object.entries(env as Record<string, string>)) {
          if (typeof v === "string" && !process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
