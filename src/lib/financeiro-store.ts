// Mock financeiro store backed by localStorage. Será substituído por integração Asaas real em M7.
import { clientesStore, type Cliente } from "./clientes-store";

export type CobrancaStatus = "pendente" | "paga" | "vencida" | "cancelada";
export type FormaPagamento = "PIX" | "BOLETO" | "DEBITO";
export type ReguaStage = "ok" | "lembrete" | "cobranca" | "negativacao" | "suspensao";

export interface Cobranca {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  descricao: string;
  valor: number;
  forma: FormaPagamento;
  vencimento: string; // YYYY-MM-DD
  competencia: string; // YYYY-MM
  status: CobrancaStatus;
  pagoEm?: string;
  asaasId?: string;
  linkPagamento?: string;
  pixCopiaCola?: string;
  boletoUrl?: string;
  reguaStage: ReguaStage;
  ultimoEnvioWhatsapp?: string;
  diasAtraso: number;
}

const KEY = "apoya:financeiro:cobrancas";

const DESCRICOES = [
  "Honorários contábeis",
  "Honorários + Folha de pagamento",
  "Assessoria fiscal mensal",
  "Honorários MEI",
];

function valorPorRegime(r: Cliente["regime"]): number {
  if (r === "MEI") return 89;
  if (r === "Simples") return 450;
  if (r === "Lucro Presumido") return 890;
  return 1480;
}

function read(): Cobranca[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Cobranca[]; } catch { return []; }
}

function write(list: Cobranca[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("apoya:financeiro:changed"));
}

function diffDays(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function stageFromDias(d: number): ReguaStage {
  if (d <= 0) return "ok";
  if (d < 7) return "lembrete";
  if (d < 15) return "cobranca";
  if (d < 30) return "negativacao";
  return "suspensao";
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function ensureForCompetencia(competencia: string): Cobranca[] {
  const list = read();
  const elig = clientesStore.list().filter((c) => c.status !== "inativo");
  let changed = false;
  const [y, m] = competencia.split("-").map(Number);
  const venc = new Date(y, m - 1, 10);
  for (const c of elig) {
    if (list.some((x) => x.clienteId === c.id && x.competencia === competencia)) continue;
    const seed = parseInt(c.id.replace(/\D/g, "").slice(-3) || "1", 10);
    const valor = valorPorRegime(c.regime);
    const forma: FormaPagamento = pick(["PIX", "BOLETO", "DEBITO"] as FormaPagamento[], seed);
    list.push({
      id: crypto.randomUUID(),
      clienteId: c.id,
      clienteNome: c.razaoSocial,
      cnpj: c.cnpj,
      descricao: c.regime === "MEI" ? "Honorários MEI" : pick(DESCRICOES, seed),
      valor,
      forma,
      vencimento: venc.toISOString().slice(0, 10),
      competencia,
      status: "pendente",
      reguaStage: "ok",
      diasAtraso: 0,
    });
    changed = true;
  }
  if (changed) write(list);
  return recompute(list).filter((x) => x.competencia === competencia);
}

function recompute(list: Cobranca[]): Cobranca[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return list.map((c) => {
    if (c.status === "paga" || c.status === "cancelada") return c;
    const v = new Date(c.vencimento);
    const dias = Math.max(0, diffDays(hoje, v));
    const status: CobrancaStatus = dias > 0 ? "vencida" : "pendente";
    return { ...c, diasAtraso: dias, status, reguaStage: stageFromDias(dias) };
  });
}

async function simulaAsaas(c: Cobranca): Promise<Cobranca> {
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 400));
  const id = "pay_" + Math.random().toString(36).slice(2, 10);
  return {
    ...c,
    asaasId: id,
    linkPagamento: `https://asaas.com/c/${id}`,
    pixCopiaCola: c.forma === "PIX" ? `00020126${id}5204000053039865802BR` : undefined,
    boletoUrl: c.forma === "BOLETO" ? `mock://asaas/boleto-${id}.pdf` : undefined,
  };
}

export const financeiroStore = {
  listByCompetencia: (competencia: string) => ensureForCompetencia(competencia),
  list: () => recompute(read()),
  update(id: string, patch: Partial<Cobranca>) {
    const list = read().map((c) => (c.id === id ? { ...c, ...patch } : c));
    write(list);
  },
  async gerarLote(ids: string[]) {
    const list = read();
    const updated = await Promise.all(
      list.map(async (c) => (ids.includes(c.id) && !c.asaasId ? await simulaAsaas(c) : c)),
    );
    write(updated);
  },
  marcarPaga(id: string) {
    const list = read().map((c) =>
      c.id === id
        ? { ...c, status: "paga" as CobrancaStatus, pagoEm: new Date().toISOString(), reguaStage: "ok" as ReguaStage, diasAtraso: 0 }
        : c,
    );
    write(list);
  },
  cancelar(id: string) {
    const list = read().map((c) =>
      c.id === id ? { ...c, status: "cancelada" as CobrancaStatus, reguaStage: "ok" as ReguaStage } : c,
    );
    write(list);
  },
  enviarWhatsapp(ids: string[]) {
    const now = new Date().toISOString();
    const list = read().map((c) => (ids.includes(c.id) ? { ...c, ultimoEnvioWhatsapp: now } : c));
    write(list);
  },
  suspenderInadimplentes() {
    // Marca clientes em estágio "suspensao" — apenas evento mock
    const elig = recompute(read()).filter((c) => c.reguaStage === "suspensao");
    window.dispatchEvent(new CustomEvent("apoya:financeiro:suspender", { detail: elig.length }));
    return elig.length;
  },
};
