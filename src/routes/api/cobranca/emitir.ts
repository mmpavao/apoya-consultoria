/**
 * POST /api/cobranca/emitir
 * Emite cobrança no Asaas (PIX + boleto simultâneos).
 *
 * Modos:
 *   mode="individual": emite para uma cobrança específica
 *   mode="lote":       emite para todas as cobranças pendentes sem asaas_id
 *   mode="gerar_mensal": gera cobranças do mês para todos os clientes ativos e emite
 *
 * Body (individual): { mode: "individual", cobranca_id: string }
 * Body (lote):       { mode: "lote", competencia?: "YYYY-MM" }
 * Body (mensal):     { mode: "gerar_mensal", competencia?: "YYYY-MM" }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { upsertCustomer, createPayment, getPixData, AsaasError } from "@/integrations/asaas/client.server";

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

/** Emite uma cobrança no Asaas e atualiza o banco */
async function emitirUma(cobranca: any, userId: string): Promise<{ ok: boolean; id: string; error?: string; link?: string }> {
  const db = supabaseAdmin as any;

  try {
    // Buscar dados do cliente
    const { data: cliente } = await db
      .from("clientes")
      .select("id,razao_social,cnpj,email,whatsapp,telefone,asaas_customer_id")
      .eq("id", cobranca.cliente_id)
      .single();

    if (!cliente) throw new Error("Cliente não encontrado");

    // 1. Criar/buscar customer no Asaas
    const customer = await upsertCustomer(db, {
      name: cliente.razao_social,
      cpfCnpj: cliente.cnpj,
      email: cliente.email ?? undefined,
      mobilePhone: (cliente.whatsapp ?? cliente.telefone ?? "").replace(/\D/g, "") || undefined,
      externalReference: cliente.id,
    });

    // Salvar asaas_customer_id no cliente (se novo)
    if (!cliente.asaas_customer_id || cliente.asaas_customer_id !== customer.id) {
      await db.from("clientes").update({ asaas_customer_id: customer.id }).eq("id", cliente.id);
    }

    // 2. Criar payment UNDEFINED (aceita PIX + boleto)
    const payment = await createPayment(db, {
      customer: customer.id,
      billingType: "UNDEFINED",
      value: cobranca.valor,
      dueDate: cobranca.vencimento,
      description: cobranca.descricao ?? `Mensalidade APOYA — ${cobranca.competencia}`,
      externalReference: cobranca.id,
    });

    // 3. Buscar dados PIX
    let pixCopiaCola: string | null = null;
    let pixQrBase64: string | null = null;
    try {
      const pixData = await getPixData(db, payment.id);
      pixCopiaCola = pixData.payload;
      pixQrBase64 = pixData.encodedImage;
    } catch {
      console.warn(`[emitir] Não foi possível obter PIX para payment ${payment.id}`);
    }

    // 4. Montar link checkout interno
    const appUrl = process.env.PUBLIC_APP_URL ?? "https://apoya-gestao.talkzzbot.workers.dev";
    const checkoutLink = `${appUrl}/checkout/${cobranca.id}`;

    // 5. Atualizar cobrança no banco
    await db.from("cobrancas").update({
      asaas_id:          payment.id,
      asaas_payment_id:  payment.id,
      asaas_invoice_url: payment.invoiceUrl ?? null,
      link_pagamento:    checkoutLink,
      pix_copia_cola:    pixCopiaCola,
      boleto_url:        payment.bankSlipUrl ?? null,
      status:            "pendente",
      regua_stage:       "ok",
      updated_at:        new Date().toISOString(),
    }).eq("id", cobranca.id);

    return { ok: true, id: cobranca.id, link: checkoutLink };

  } catch (e: any) {
    const msg = e instanceof AsaasError ? e.message : (e.message ?? String(e));
    console.error(`[emitir] Erro cobranca ${cobranca.id}:`, msg);

    // Marcar erro no banco
    await (db.from("cobrancas") as any).update({
      regua_stage_nome: `Erro Asaas: ${msg.slice(0, 100)}`,
      updated_at: new Date().toISOString(),
    }).eq("id", cobranca.id);

    return { ok: false, id: cobranca.id, error: msg };
  }
}

export const Route = createFileRoute("/api/cobranca/emitir")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getUserFromReq(request);
        if (!user) return json({ error: "Unauthorized" }, 401);

        let body: { mode?: string; cobranca_id?: string; competencia?: string };
        try { body = await request.json(); }
        catch { return json({ error: "Body inválido" }, 400); }

        const { mode = "individual", cobranca_id, competencia } = body;
        const db = supabaseAdmin as any;
        const now = new Date();
        const comp = competencia ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        // ── Gerar cobranças mensais primeiro (se mode=gerar_mensal) ──────
        if (mode === "gerar_mensal") {
          const { data: clientes } = await db
            .from("clientes")
            .select("id,razao_social,cnpj,valor_honorario,dia_vencimento,forma_pagamento,regime")
            .eq("status", "ativo")
            .gt("valor_honorario", 0);

          if (!clientes?.length) return json({ ok: true, geradas: 0, msg: "Nenhum cliente ativo com honorário" });

          const [ano, mes] = comp.split("-").map(Number);
          const dia = 20; // dia padrão de vencimento (configurável por cliente)

          let novasGeradas = 0;
          for (const cli of clientes) {
            // Verificar se já existe cobrança para este cliente/competência
            const { data: existe } = await db.from("cobrancas")
              .select("id").eq("cliente_id", cli.id).eq("competencia", comp).maybeSingle();
            if (existe) continue;

            const diaVenc = cli.dia_vencimento ?? 20;
            const vencimento = new Date(ano, mes - 1, diaVenc).toISOString().split("T")[0];

            await db.from("cobrancas").insert({
              cliente_id:    cli.id,
              cliente_nome:  cli.razao_social,
              cnpj:          cli.cnpj,
              descricao:     `Mensalidade APOYA — ${comp}`,
              valor:         cli.valor_honorario,
              forma:         cli.forma_pagamento ?? "PIX",
              vencimento,
              competencia:   comp,
              status:        "pendente",
              regua_stage:   "ok",
              dias_atraso:   0,
              created_by:    user.id,
            });
            novasGeradas++;
          }

          // Agora emite todas as novas + pendentes sem asaas_id
          const { data: pendentes } = await db.from("cobrancas")
            .select("*").eq("competencia", comp).is("asaas_id", null).eq("status", "pendente");

          if (!pendentes?.length) {
            return json({ ok: true, geradas: novasGeradas, emitidas: 0, msg: "Cobranças geradas, nenhuma para emitir" });
          }

          const resultados: any[] = [];
          for (let i = 0; i < pendentes.length; i += 5) {
            const batch = pendentes.slice(i, i + 5);
            const res = await Promise.all(batch.map((c: any) => emitirUma(c, user.id)));
            resultados.push(...res);
          }

          return json({
            ok: true,
            geradas: novasGeradas,
            emitidas: resultados.filter(r => r.ok).length,
            erros: resultados.filter(r => !r.ok).length,
            competencia: comp,
          });
        }

        // ── Individual ───────────────────────────────────────────────────
        if (mode === "individual") {
          if (!cobranca_id) return json({ error: "cobranca_id obrigatório" }, 400);
          const { data: cob } = await db.from("cobrancas").select("*").eq("id", cobranca_id).single();
          if (!cob) return json({ error: "Cobrança não encontrada" }, 404);
          const resultado = await emitirUma(cob, user.id);
          return json({ ok: resultado.ok, resultados: [resultado], emitidas: resultado.ok ? 1 : 0, erros: resultado.ok ? 0 : 1 });
        }

        // ── Lote (todas pendentes sem asaas_id) ──────────────────────────
        const { data: pendentes } = await db.from("cobrancas")
          .select("*")
          .is("asaas_id", null)
          .eq("status", "pendente")
          .eq("competencia", comp);

        if (!pendentes?.length) return json({ ok: true, emitidas: 0, msg: "Nenhuma cobrança pendente" });

        const resultados: any[] = [];
        for (let i = 0; i < pendentes.length; i += 5) {
          const batch = pendentes.slice(i, i + 5);
          const res = await Promise.all(batch.map((c: any) => emitirUma(c, user.id)));
          resultados.push(...res);
        }

        return json({
          ok: true,
          resultados,
          emitidas: resultados.filter(r => r.ok).length,
          erros: resultados.filter(r => !r.ok).length,
          competencia: comp,
        });
      },
    },
  },
});
