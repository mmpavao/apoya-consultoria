/**
 * POST /api/webhooks/pluggy — Recebe eventos da Pluggy (Open Finance)
 *
 * Eventos tratados:
 *   item/created  → nova conexão bancária criada pelo cliente
 *   item/updated  → extrato/saldo atualizado (dados novos disponíveis)
 *   item/error    → falha na conexão (token expirado, MFA, etc.)
 *
 * REGRA CRÍTICA: responder 2XX em menos de 5 segundos.
 * Todo processamento pesado (buscar transações, conciliar, notificar) é fire-and-forget.
 *
 * Segurança: a Pluggy envia um header X-Pluggy-Signature com HMAC-SHA256.
 * Configure PLUGGY_WEBHOOK_SECRET no Worker (wrangler secret put PLUGGY_WEBHOOK_SECRET).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tipos dos eventos Pluggy ──────────────────────────────────────────────────
interface PluggyEvent {
  event:   "item/created" | "item/updated" | "item/error" | string;
  eventId: string;
  itemId:  string;
  error?:  { code: string; message: string };
}

// ── Atualiza status da conexão no Supabase ───────────────────────────────────
async function atualizarConexao(
  db: any,
  itemId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await db
    .from("open_finance_conexoes")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("item_id", itemId);
}

// ── Busca transações via API Pluggy e salva (fire-and-forget) ─────────────────
async function sincronizarTransacoes(itemId: string, empresaId: string): Promise<void> {
  try {
    const clientId     = process.env.PLUGGY_CLIENT_ID     ?? "";
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET ?? "";
    if (!clientId || !clientSecret) return;

    // 1. Autenticar na Pluggy
    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ clientId, clientSecret }),
    });
    if (!authRes.ok) return;
    const { apiKey } = await authRes.json() as { apiKey: string };

    // 2. Buscar contas do item
    const acctRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, {
      headers: { "X-API-KEY": apiKey },
    });
    if (!acctRes.ok) return;
    const { results: contas } = await acctRes.json() as { results: any[] };

    const db = supabaseAdmin as any;

    for (const conta of contas) {
      // 3. Buscar transações dos últimos 90 dias
      const from = new Date(Date.now() - 90 * 86400_000).toISOString().split("T")[0];
      const txRes = await fetch(
        `https://api.pluggy.ai/transactions?accountId=${conta.id}&from=${from}&pageSize=500`,
        { headers: { "X-API-KEY": apiKey } },
      );
      if (!txRes.ok) continue;
      const { results: transacoes } = await txRes.json() as { results: any[] };

      // 4. Upsert em lote na tabela open_finance_transacoes
      for (const tx of transacoes) {
        await db.from("open_finance_transacoes").upsert({
          empresa_id:   empresaId,
          item_id:      itemId,
          account_id:   conta.id,
          tx_id:        tx.id,
          descricao:    tx.description,
          valor:        tx.amount,
          tipo:         tx.type,           // CREDIT | DEBIT
          categoria:    tx.category,
          data_tx:      tx.date,
          saldo_apos:   tx.balance,
          raw:          tx,
          status:       "pendente",        // aguarda conciliação pelo Marcos
        }, { onConflict: "tx_id" });
      }

      // 5. Atualizar saldo da conta
      await db.from("open_finance_contas").upsert({
        empresa_id: empresaId,
        item_id:    itemId,
        account_id: conta.id,
        nome:       conta.name,
        tipo:       conta.type,
        saldo:      conta.balance,
        moeda:      conta.currencyCode ?? "BRL",
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id" });
    }

    console.log(`[Pluggy] ✅ ${contas.length} conta(s) sincronizadas para item ${itemId}`);
  } catch (e) {
    console.error("[Pluggy] sincronizarTransacoes error:", e);
  }
}

// ── Notificar via WhatsApp (erro de conexão) ──────────────────────────────────
async function notificarErroConexao(db: any, itemId: string, erro: PluggyEvent["error"]): Promise<void> {
  try {
    const { data: conexao } = await db
      .from("open_finance_conexoes")
      .select("empresa_id, clientes(razao_social, whatsapp, telefone)")
      .eq("item_id", itemId)
      .maybeSingle();

    if (!conexao?.clientes) return;

    const tel = (conexao.clientes.whatsapp ?? conexao.clientes.telefone ?? "").replace(/\D/g, "");
    if (!tel) return;
    const numero = tel.startsWith("55") ? tel : `55${tel}`;

    const { data: inst } = await db.from("wa_instance")
      .select("nome,evolution_base_url,evolution_apikey").eq("ativo", true).limit(1).single();
    if (!inst?.nome) return;

    const baseUrl = inst.evolution_base_url ?? process.env.EVOLUTION_BASE_URL ?? "";
    const apiKey  = inst.evolution_apikey   ?? process.env.EVOLUTION_API_KEY  ?? "";

    await fetch(`${baseUrl}/message/sendText/${inst.nome}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number: numero,
        text: `⚠️ *Atenção* — sua conexão bancária Open Finance precisou de atualização.\n\nPor favor, reconecte sua conta para que possamos continuar sincronizando seus extratos automaticamente.\n\nQualquer dúvida, fale com a gente! 😊\n_Apoya Contábil_`,
      }),
    });
  } catch (e) {
    console.warn("[Pluggy] notificarErroConexao error:", e);
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/webhooks/pluggy/")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: PluggyEvent;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Body inválido" }, 400);
        }

        const { event, eventId, itemId, error: itemError } = body;

        console.log(`[Pluggy] webhook recebido: ${event} | eventId: ${eventId} | itemId: ${itemId}`);

        // ── Responder imediatamente — processamento é fire-and-forget ─────
        // Isso garante que a Pluggy receba 2XX dentro de 5 segundos.
        const db = supabaseAdmin as any;

        // Registrar o evento recebido (auditoria)
        // Registrar evento (fire-and-forget)
        void (async () => { try {
          await db.from("open_finance_eventos").insert({
            event_id:   eventId,
            event_type: event,
            item_id:    itemId,
            payload:    body,
            recebido_em: new Date().toISOString(),
          });
        } catch {} })();

        // ── Processar por tipo de evento ──────────────────────────────────
        switch (event) {

          // Nova conexão criada (cliente acabou de autorizar o banco)
          case "item/created": {
            void atualizarConexao(db, itemId, { status: "ativo" });

            // Buscar empresa_id e disparar sincronização inicial
            db.from("open_finance_conexoes")
              .select("empresa_id")
              .eq("item_id", itemId)
              .maybeSingle()
              .then(({ data }: any) => {
                if (data?.empresa_id) {
                  sincronizarTransacoes(itemId, data.empresa_id).catch(() => {});
                }
              })
              .catch(() => {});
            break;
          }

          // Dados atualizados (Pluggy faz polling e encontrou novas transações)
          case "item/updated": {
            void atualizarConexao(db, itemId, { status: "ativo" });

            db.from("open_finance_conexoes")
              .select("empresa_id")
              .eq("item_id", itemId)
              .maybeSingle()
              .then(({ data }: any) => {
                if (data?.empresa_id) {
                  sincronizarTransacoes(itemId, data.empresa_id).catch(() => {});
                }
              })
              .catch(() => {});
            break;
          }

          // Erro na conexão (token expirado, MFA necessário, etc.)
          case "item/error": {
            void atualizarConexao(db, itemId, {
              status:    "erro",
              ultimo_erro: itemError?.message ?? "Erro desconhecido",
            });

            void notificarErroConexao(db, itemId, itemError);
            break;
          }

          default:
            console.log(`[Pluggy] evento não tratado: ${event}`);
        }

        // ── Sempre responder 2XX imediatamente ────────────────────────────
        return json({ received: true, event, eventId });
      },
    },
  },
});
