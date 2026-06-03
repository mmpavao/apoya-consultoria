/**
 * /api/focus/proxy — Proxy Server-Side para APIs Acessórias da Focus NF-e
 *
 * Mantém o FOCUSNFE_API_TOKEN no servidor (nunca exposto ao browser).
 * O frontend chama GET /api/focus/proxy?path=/cnpjs/12345678000189
 *
 * Endpoints suportados (somente leitura):
 *   /ceps/{cep}
 *   /cnpjs/{cnpj}
 *   /codigos_cnae, /codigos_cnae/{codigo}
 *   /ncms, /ncms/{codigo}
 *   /cfops, /cfops/{codigo}
 *   /municipios, /municipios/{ibge}
 *   /municipios/{ibge}/lista_servicos, /municipios/{ibge}/lista_servicos/{codigo}
 *   /municipios/{ibge}/codigos_tributarios, /municipios/{ibge}/codigos_tributarios/{id}
 */
import { createFileRoute } from "@tanstack/react-router";

// Allowlist de paths para evitar SSRF
const ALLOWED_PREFIXES = [
  "/ceps/",
  "/cnpjs/",
  "/codigos_cnae",
  "/ncms",
  "/cfops",
  "/municipios",
];

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600", // 1h — dados fiscais são estáveis
    },
  });
}

export const Route = createFileRoute("/api/focus/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url    = new URL(request.url);
        const path   = url.searchParams.get("path") ?? "";

        if (!path || !isAllowed(path)) {
          return json({ ok: false, error: "path_nao_permitido" }, 400);
        }

        const token   = process.env.FOCUSNFE_API_TOKEN;
        const ambiente = (process.env.FOCUSNFE_AMBIENTE ?? "homologacao").toLowerCase();

        if (!token) {
          return json({ ok: false, error: "FOCUSNFE_API_TOKEN_nao_configurado" }, 503);
        }

        // CEP e dados fiscais estão disponíveis em homologação
        // CNPJ só funciona em produção
        const useProd = path.startsWith("/cnpjs/");
        const base    = useProd
          ? "https://api.focusnfe.com.br/v2"
          : ambiente === "producao"
            ? "https://api.focusnfe.com.br/v2"
            : "https://homologacao.focusnfe.com.br/v2";

        const auth   = `Basic ${btoa(`${token}:`)}`;
        const target = `${base}${path}`;

        try {
          const resp = await fetch(target, {
            headers: {
              Authorization: auth,
              Accept: "application/json",
            },
          });

          const data = await resp.json().catch(() => null);

          if (!resp.ok) {
            const msg = data?.mensagem ?? `Focus API HTTP ${resp.status}`;
            return json({ ok: false, error: msg }, resp.status === 404 ? 404 : 502);
          }

          // Adicionar X-Total-Count se vier nos headers
          const totalCount = resp.headers.get("x-total-count");
          const response = json(data, 200);
          if (totalCount) {
            const headers = new Headers(response.headers);
            headers.set("X-Total-Count", totalCount);
            return new Response(response.body, { status: 200, headers });
          }

          return response;

        } catch (e: any) {
          return json({ ok: false, error: e.message }, 502);
        }
      },
    },
  },
});
