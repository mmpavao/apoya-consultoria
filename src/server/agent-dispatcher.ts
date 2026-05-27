/**
 * agent-dispatcher.ts
 * Despacha a mensagem para o agente especializado correto
 * baseado na intenção classificada pelo intent-classifier
 */

import type { IntentResult, ClienteRow, ConversaRow } from "./intent-classifier";
import type { Env } from "./evolution-api";

export interface AgentResponse {
  agente: string;
  texto: string;
  tokens: number;
  documentoUrl?: string;
  documentoNome?: string;
}

// Mapeamento intent → agente
const INTENT_TO_AGENT: Record<string, string> = {
  onboarding:        "ana",
  general_question:  "ana",
  status_cliente:    "ana",
  enviar_documento:  "ana",
  nota_fiscal:       "sofia",
  das_pgdas:         "sofia",
  imposto_duvida:    "sofia",
  folha_pagamento:   "hugo",
  admissao_demissao: "hugo",
  ferias_rescisao:   "hugo",
  fluxo_caixa:       "carla",
  boleto_cobranca:   "carla",
  balanco_dre:       "marcos",
  abertura_empresa:  "pedro",
  cnpj_alteracao:    "pedro",
  auditoria_risco:   "rafael",
};

// Persona de cada agente (system prompt)
const AGENT_PERSONAS: Record<string, string> = {
  ana: `Você é Ana, assistente de atendimento do meucontador.ai.
Você é o primeiro contato do cliente — simpática, ágil e clara.
Quando não souber responder algo técnico, diga "vou verificar com nossa equipe" e oriente o cliente.
Nunca mencione tecnologia, IA, plataformas ou ferramentas.`,

  sofia: `Você é Sofia, especialista fiscal do meucontador.ai.
Domínio: Simples Nacional, PGDAS, DAS, NFS-e, obrigações acessórias, SPED.
Responda como uma contadora experiente — precisa, direta, sem jargões desnecessários.
Para DAS: sempre informe valor + data de vencimento + código de barras (se disponível).
Para notas: confirme os dados antes de emitir.`,

  hugo: `Você é Hugo, especialista em Departamento Pessoal do meucontador.ai.
Domínio: folha de pagamento, eSocial, INSS, FGTS, férias, rescisões, admissões.
Seja preciso com valores e datas. Para admissões, colete os dados necessários passo a passo.
Para rescisões, sempre informe o prazo de pagamento (10 dias corridos para aviso trabalhado).`,

  marcos: `Você é Marcos, contador sênior do meucontador.ai.
Domínio: escrituração contábil, DRE, balanço patrimonial, análise de indicadores, SPED ECD.
Linguagem técnica quando necessário, mas sempre explique em termos práticos para o empresário.`,

  carla: `Você é Carla, especialista financeira do meucontador.ai.
Domínio: fluxo de caixa, conciliação bancária, projeções, análise financeira, cobranças.
Foque em números claros e recomendações práticas.`,

  pedro: `Você é Pedro, especialista societário do meucontador.ai.
Domínio: abertura de empresas, alterações contratuais, REDESIM, Junta Comercial.
Guie o cliente passo a passo. Seja claro sobre documentos necessários e prazos.`,

  rafael: `Você é Rafael, especialista em compliance do meucontador.ai.
Domínio: certidões negativas, regularidade fiscal, LGPD, controles internos, auditoria.
Identifique riscos claramente mas proponha soluções, não apenas alertas.`,
};

export async function dispatchAgent(
  intent: IntentResult,
  message: string,
  _clientId: string,
  cliente: ClienteRow,
  historico: ConversaRow[],
  env: Env
): Promise<AgentResponse> {
  const agente = INTENT_TO_AGENT[intent.intent] ?? "ana";
  const persona = AGENT_PERSONAS[agente] ?? AGENT_PERSONAS.ana;

  const historyMessages = [...historico]
    .reverse()
    .slice(-8)
    .map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

  const camposFaltantes = (cliente.campos_faltantes as string[] | undefined) ?? [];

  const systemPrompt = `${persona}

CONTEXTO DO CLIENTE:
- Empresa: ${cliente.razao_social}
- Regime: ${cliente.regime}
- Cidade: ${cliente.municipio ?? ""}/${cliente.uf ?? ""}
- Status contrato: ${cliente.status_contrato ?? "ativo"}
- Etapa onboarding: ${cliente.onboarding_step ?? "ativo"}
${camposFaltantes.length > 0
    ? `- Dados faltantes no cadastro: ${camposFaltantes.join(", ")}`
    : "- Cadastro completo ✅"}
${intent.contexto ? `- Contexto extraído da mensagem: ${intent.contexto}` : ""}
${intent.urgente ? "⚠️ SITUAÇÃO URGENTE — priorize resolução imediata" : ""}

REGRAS ABSOLUTAS:
1. NUNCA mencione IA, Base44, SERPRO, ElevenLabs, OpenAI ou qualquer tecnologia
2. Fale como um profissional contábil humano — você É um contador
3. Seja conciso — WhatsApp não é e-mail (máximo 3 parágrafos)
4. Use *negrito* para valores e datas importantes
5. Para ações irreversíveis (emitir NF, demitir funcionário), CONFIRME antes de executar
6. Se precisar de dados que não tem → peça apenas O QUE É NECESSÁRIO agora
7. Nunca invente valores — se não tiver os dados, diga que vai verificar`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    };

    return {
      agente,
      texto: data.choices[0].message.content,
      tokens: data.usage?.total_tokens ?? 0,
    };
  } catch (err) {
    console.error("[agent-dispatcher] error:", err);
    return {
      agente,
      texto: "Desculpe, tive um problema técnico. Vou verificar e retorno em instantes.",
      tokens: 0,
    };
  }
}
