/**
 * POST /api/cobranca/regua
 * Régua de cobrança automática — executada pelo CRON ou manualmente.
 *
 * Estágios:
 *   D-5  → lembrete     (se ainda pendente, re-envia WhatsApp)
 *   D+1  → cobranca     (venceu ontem → cobrança)
 *   D+15 → negativacao  (marca inadimplente)
 *   D+45 → suspensao    (bloqueia cliente)
 *
 * Body: { mode?: "cron" | "manual", competencia?: "YYYY-MM" }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const APP_URL    = "https://apoya-gestao.talkzzbot.workers.dev";
const WA_TIMEOUT = 5_000; // ms — fire-and-forget para não travar o cron

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromReq(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/** Envia WhatsApp de cobrança (fire-and-forget) */
async function enviarWA(
  token: string,
  clienteId: string,
  telefone: string,
  mensagem: string,
): Promise<void> {
  const ctrl = new AbortController();
  const tid   = setTimeout(() => ctrl.abort(), WA_TIMEOUT);
  try {
    await fetch(`${APP_URL}/api/wa/send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ telefone, mensagem, cliente_id: clienteId }),
      signal:  ctrl.signal,
    });
  } catch {
    /* fire-and-forget — ignora timeout */
  } finally {
    clearTimeout(tid);
  }
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export const Route = createFileRoute("/api/cobranca/regua")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth  = request.headers.get("Authorization") ?? "";
        const token = auth.replace("Bearer ", "").trim();

        // Para modo CRON (chamado pelo ARQUITETO), aceita token de service role
        // Para modo manual, valida user normal
        const user = await getUserFromReq(request);
        const isCron = !user && !!token; // CRON passa token direto

        if (!user && !isCron) return json({ error: "Unauthorized" }, 401);

        let body: { mode?: string; competencia?: string };
        try { body = await request.json(); }
        catch { body = {}; }

        const db  = supabaseAdmin as any;
        const now = new Date();
        const today = now.toISOString().split("T")[0];

        // Buscar todas as cobranças não pagas/canceladas
        const { data: cobrancas, error: cErr } = await db
          .from("cobrancas")
          .select(`
            id, cliente_id, cliente_nome, valor, vencimento, status,
            regua_stage, asaas_id, link_pagamento, dias_atraso,
            ultimo_contato_em,
            clientes!inner(whatsapp, telefone, status)
          `)
          .not("status", "in", '("paga","cancelada")')
          .order("vencimento", { ascending: true });

        if (cErr) return json({ error: cErr.message }, 500);

        const resultados = {
          lembrete:    0,
          cobranca:    0,
          negativacao: 0,
          suspensao:   0,
          erros:       0,
          processadas: 0,
        };

        const updates: Promise<any>[] = [];

        for (const cob of (cobrancas ?? [])) {
          try {
            const venc    = cob.vencimento;
            const dias    = Math.floor((Date.parse(today) - Date.parse(venc)) / 86_400_000);
            const link    = cob.link_pagamento ?? `${APP_URL}/checkout/${cob.id}`;
            const valor   = formatBRL(cob.valor);
            const nome    = cob.cliente_nome?.split(" ")[0] ?? "Cliente";
            const telefone = (cob as any).clientes?.whatsapp ?? (cob as any).clientes?.telefone ?? "";
            const vencFmt = new Date(venc + "T12:00:00").toLocaleDateString("pt-BR");
            const suspFmt = new Date(addDays(venc, 45) + "T12:00:00").toLocaleDateString("pt-BR");

            // Calcular novo estágio
            let novoStage = cob.regua_stage;
            let mensagemWA: string | null = null;
            let novoStatus = cob.status;
            let bloqueiarCliente = false;

            if (dias <= -5) {
              // D-5 ou antes — lembrete
              if (cob.regua_stage === "ok") {
                novoStage = "lembrete";
                mensagemWA = `⚠️ Olá ${nome}! Sua mensalidade APOYA de ${valor} vence em *${Math.abs(dias)} dias* (${vencFmt}).\n🔗 Pague agora: ${link}`;
                resultados.lembrete++;
              }
            } else if (dias >= 1 && dias < 15) {
              // D+1 a D+14 — cobrança
              if (cob.regua_stage !== "cobranca" && cob.regua_stage !== "negativacao" && cob.regua_stage !== "suspensao") {
                novoStage  = "cobranca";
                novoStatus = "vencida";
                mensagemWA = `❗ ${nome}, sua mensalidade APOYA de ${valor} *venceu há ${dias} dia(s)*.\n⚡ Evite juros — pague agora: ${link}`;
                resultados.cobranca++;
              } else if (cob.regua_stage === "cobranca") {
                // Re-notifica a cada 3 dias se ainda na fase de cobrança
                const lastContact = cob.ultimo_contato_em ? Date.parse(cob.ultimo_contato_em) : 0;
                const daysSinceLast = Math.floor((Date.now() - lastContact) / 86_400_000);
                if (daysSinceLast >= 3) {
                  mensagemWA = `❗ ${nome}, sua mensalidade APOYA de ${valor} está *vencida há ${dias} dias*.\n🔗 ${link}`;
                  resultados.cobranca++;
                }
              }
            } else if (dias >= 15 && dias < 45) {
              // D+15 a D+44 — negativação
              if (cob.regua_stage !== "negativacao" && cob.regua_stage !== "suspensao") {
                novoStage  = "negativacao";
                novoStatus = "vencida";
                mensagemWA = `🔴 ${nome}, sua conta APOYA está em atraso há *${dias} dias* (${valor}).\n⚠️ Risco de suspensão em ${suspFmt}.\nRegularize: ${link}`;
                resultados.negativacao++;
              }
            } else if (dias >= 45) {
              // D+45 — suspensão
              if (cob.regua_stage !== "suspensao") {
                novoStage  = "suspensao";
                novoStatus = "vencida";
                bloqueiarCliente = true;
                mensagemWA = `🚫 ${nome}, seus serviços APOYA foram *suspensos* por falta de pagamento (${dias} dias).\n💰 Valor em aberto: ${valor}\n🔗 Para reativar: ${link}\n📞 Dúvidas: (12) 99685-3626`;
                resultados.suspensao++;
              }
            }

            // Atualizar cobrança
            updates.push(
              db.from("cobrancas").update({
                regua_stage:       novoStage,
                status:            novoStatus,
                dias_atraso:       Math.max(0, dias),
                ultimo_contato_em: mensagemWA ? today : cob.ultimo_contato_em,
                updated_at:        new Date().toISOString(),
              }).eq("id", cob.id)
            );

            // Suspender cliente
            if (bloqueiarCliente) {
              updates.push(
                db.from("clientes").update({
                  status:           "suspenso",
                  data_suspensao:   today,
                  motivo_suspensao: `Inadimplência — ${dias} dias de atraso`,
                  updated_at:       new Date().toISOString(),
                }).eq("id", cob.cliente_id)
              );
            }

            // Enviar WhatsApp (fire-and-forget)
            if (mensagemWA && telefone) {
              enviarWA(token, cob.cliente_id, telefone, mensagemWA).catch(() => {});
            }

            resultados.processadas++;
          } catch {
            resultados.erros++;
          }
        }

        // Executar todas as updates em paralelo
        await Promise.allSettled(updates);

        console.log("[regua]", today, resultados);

        return json({
          ok:     true,
          data:   today,
          total:  cobrancas?.length ?? 0,
          ...resultados,
        });
      },
    },
  },
});
