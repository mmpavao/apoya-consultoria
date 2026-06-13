/**
 * POST /api/das/gerar — Geração automática de DAS via SERPRO MCP
 *
 * Body:
 *   { mode: "individual", cliente_id: string, competencia: "YYYY-MM" }
 *   { mode: "lote", competencia: "YYYY-MM" }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MCP_URL   = "https://mcp.zapro.tech/mcp";
const MCP_TOKEN = process.env.SERPRO_TOKEN ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromReq(req: Request) {
  const auth  = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function callSerpro(tool: string, params: Record<string, unknown>) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MCP_TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: tool, arguments: params },
    }),
  });
  if (!res.ok) throw new Error(`SERPRO HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  const raw = data.result?.content?.[0]?.text;
  if (!raw) return data.result;
  try { return JSON.parse(raw); } catch { return raw; }
}

function calcVencimento(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return new Date(y, m, 20).toISOString().split("T")[0];
}

async function gerarUm(
  cliente: { id: string; razao_social: string; cnpj: string; regime: string },
  competencia: string,
  userId: string,
): Promise<{ ok: boolean; cnpj: string; nome: string; error?: string; guia_id?: string; codigo_barras?: string }> {
  const periodo  = competencia.replace("-", "");
  const venc     = calcVencimento(competencia);
  const tipo     = cliente.regime === "MEI" ? "DASMEI" : "DAS";
  const toolName = cliente.regime === "MEI" ? "serpro_pgmei_das" : "serpro_das_gerar";
  const db       = supabaseAdmin as any;

  try {
    const serproResult = await callSerpro(toolName, {
      cnpj: cliente.cnpj.replace(/\D/g, ""),
      periodo,
    });

    const codigoBarras = serproResult?.codigoBarras
      ?? serproResult?.codigo_barras
      ?? serproResult?.barcode
      ?? serproResult?.linhaDigitavel
      ?? null;

    const rawValor = serproResult?.valor ?? serproResult?.value ?? serproResult?.totalValue ?? 0;
    const valorNum = typeof rawValor === "string"
      ? parseFloat(rawValor.replace(",", "."))
      : Number(rawValor ?? 0);

    const { data: existe } = await db.from("das_guias").select("id")
      .eq("cliente_id", cliente.id).eq("competencia", competencia).maybeSingle();

    if (existe) {
      await db.from("das_guias").update({
        codigo_barras: codigoBarras,
        valor: valorNum,
        status: codigoBarras ? "gerada" : "erro",
        ultimo_erro: codigoBarras ? null : "SERPRO não retornou código de barras",
        updated_at: new Date().toISOString(),
      }).eq("id", existe.id);
      return { ok: true, cnpj: cliente.cnpj, nome: cliente.razao_social, guia_id: existe.id, codigo_barras: codigoBarras };
    }

    const { data: nova, error: dbErr } = await db.from("das_guias").insert({
      cliente_id:    cliente.id,
      cliente_nome:  cliente.razao_social,
      cnpj:          cliente.cnpj,
      regime:        cliente.regime,
      tipo,
      competencia,
      vencimento:    venc,
      valor:         valorNum,
      status:        codigoBarras ? "gerada" : "erro",
      codigo_barras: codigoBarras,
      ultimo_erro:   codigoBarras ? null : "SERPRO não retornou código de barras",
      created_by:    userId,
    }).select("id").single();

    if (dbErr) throw new Error(`DB: ${dbErr.message}`);
    return { ok: true, cnpj: cliente.cnpj, nome: cliente.razao_social, guia_id: (nova as any)?.id, codigo_barras: codigoBarras };

  } catch (e: any) {
    const msg = e.message ?? String(e);
    const { data: existe } = await db.from("das_guias").select("id")
      .eq("cliente_id", cliente.id).eq("competencia", competencia).maybeSingle();

    if (existe) {
      await db.from("das_guias").update({ status: "erro", ultimo_erro: msg.slice(0, 500) }).eq("id", existe.id);
    } else {
      await db.from("das_guias").insert({
        cliente_id: cliente.id, cliente_nome: cliente.razao_social,
        cnpj: cliente.cnpj, regime: cliente.regime,
        tipo, competencia, vencimento: venc, valor: 0,
        status: "erro", ultimo_erro: msg.slice(0, 500), created_by: userId,
      });
    }
    return { ok: false, cnpj: cliente.cnpj, nome: cliente.razao_social, error: msg };
  }
}

export const Route = createFileRoute("/api/das/gerar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getUserFromReq(request);
        if (!user) return json({ error: "Unauthorized" }, 401);

        let body: { mode?: string; cliente_id?: string; competencia?: string };
        try { body = await request.json(); }
        catch { return json({ error: "Body inválido" }, 400); }

        const { mode = "individual", cliente_id, competencia } = body;
        const now  = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const comp = competencia ?? `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
        const db   = supabaseAdmin as any;

        // ── Individual ───────────────────────────────────────────────────
        if (mode === "individual") {
          if (!cliente_id) return json({ error: "cliente_id obrigatório" }, 400);
          const { data: cli, error: cliErr } = await db
            .from("clientes").select("id,razao_social,cnpj,regime")
            .eq("id", cliente_id).single();
          if (cliErr || !cli) return json({ error: "Cliente não encontrado" }, 404);
          if (!["MEI", "Simples Nacional", "Simples"].includes(cli.regime)) {
            return json({ error: `Regime ${cli.regime} não gera DAS automático` }, 400);
          }
          const resultado = await gerarUm(cli, comp, user.id);
          return json({ ok: resultado.ok, resultados: [resultado], geradas: resultado.ok ? 1 : 0, erros: resultado.ok ? 0 : 1 });
        }

        // ── Lote ─────────────────────────────────────────────────────────
        const { data: clientes, error: cliErr } = await db
          .from("clientes").select("id,razao_social,cnpj,regime")
          .in("regime", ["MEI", "Simples Nacional", "Simples"]).eq("status", "ativo");

        if (cliErr) return json({ error: `Erro ao buscar clientes: ${cliErr.message}` }, 500);
        if (!clientes?.length) {
          return json({ ok: true, resultados: [], geradas: 0, erros: 0, msg: "Nenhum cliente MEI/Simples ativo" });
        }

        const resultados: ReturnType<typeof gerarUm> extends Promise<infer T> ? T[] : never[] = [];
        for (let i = 0; i < clientes.length; i += 3) {
          const batch = clientes.slice(i, i + 3);
          const res   = await Promise.all(batch.map((c: any) => gerarUm(c, comp, user.id)));
          resultados.push(...res);
        }

        return json({
          ok:          true,
          resultados,
          geradas:     resultados.filter(r => r.ok).length,
          erros:       resultados.filter(r => !r.ok).length,
          competencia: comp,
          total:       clientes.length,
        });
      },
    },
  },
});
