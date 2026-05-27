/**
 * intent-classifier.ts
 * Classificador de intenções usando GPT-4o-mini
 * temperatura 0, resposta JSON puro
 */

export interface IntentResult {
  intent: Intent;
  urgente: boolean;
  confianca: number;
  contexto?: string;
}

export type Intent =
  | "onboarding"
  | "nota_fiscal"
  | "das_pgdas"
  | "imposto_duvida"
  | "folha_pagamento"
  | "admissao_demissao"
  | "ferias_rescisao"
  | "fluxo_caixa"
  | "boleto_cobranca"
  | "balanco_dre"
  | "abertura_empresa"
  | "cnpj_alteracao"
  | "auditoria_risco"
  | "status_cliente"
  | "enviar_documento"
  | "general_question";

export type ConversaRow = {
  role: string;
  agent: string | null;
  content: string;
  created_at: string;
};

export type ClienteRow = {
  id?: string;
  razao_social: string;
  regime: string;
  municipio?: string;
  uf?: string;
  status_contrato?: string;
  onboarding_step?: string;
  campos_faltantes?: string[];
  [key: string]: unknown;
};

export async function classifyIntent(
  message: string,
  history: ConversaRow[],
  cliente: ClienteRow,
  openaiKey: string
): Promise<IntentResult> {
  const historyText = [...history]
    .reverse()
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Cliente" : (m.agent ?? "Agente")}: ${m.content}`)
    .join("\n");

  const prompt = `Você é um classificador de intenções para um escritório contábil brasileiro.

Cliente: ${cliente.razao_social} | Regime: ${cliente.regime} | ${cliente.municipio ?? ""}/${cliente.uf ?? ""}

Histórico recente da conversa:
${historyText || "(sem histórico)"}

Nova mensagem do cliente: "${message}"

Classifique a intenção em EXATAMENTE uma das categorias abaixo:
- onboarding: cliente novo, primeiro contato, querendo contratar
- nota_fiscal: emitir, cancelar, consultar notas fiscais (NFS-e, NF-e)
- das_pgdas: gerar DAS, pagar imposto, PGDAS, quanto pagar de imposto MEI/Simples
- imposto_duvida: dúvida sobre impostos, alíquotas, regimes, cálculos
- folha_pagamento: calcular folha, holerite, salário, 13º, décimo terceiro
- admissao_demissao: contratar, demitir, admissão, rescisão
- ferias_rescisao: férias, cálculo de férias, rescisão, aviso prévio, TRCT
- fluxo_caixa: fluxo de caixa, projeção financeira, entradas e saídas
- boleto_cobranca: boleto, cobrança, pagar honorário, mensalidade Apoya
- balanco_dre: DRE, balanço, resultado, lucro, prejuízo, indicadores
- abertura_empresa: abrir empresa, CNPJ, registro, constituição
- cnpj_alteracao: alterar empresa, mudança de endereço, sócios, atividade
- auditoria_risco: certidão, regularidade, dívida ativa, compliance
- status_cliente: "qual minha situação?", resumo geral, pendências
- enviar_documento: "me manda", "quero ver", pedir documento, holerite, contrato
- general_question: qualquer outra coisa que não se encaixa acima

URGENTE = true se: DAS vencendo hoje/amanhã, eSocial atrasado, certidão negativa, rescisão imediata.

Responda APENAS com JSON válido, sem markdown:
{"intent": "...", "urgente": true/false, "confianca": 0.0-1.0, "contexto": "informação relevante extraída"}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const parsed = JSON.parse(data.choices[0].message.content) as IntentResult;
    return parsed;
  } catch (err) {
    console.error("[intent-classifier] error:", err);
    // Fallback seguro
    return { intent: "general_question", urgente: false, confianca: 0 };
  }
}
