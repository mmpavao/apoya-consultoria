// Mock DAS store backed by localStorage. Será substituído por integração SERPRO real em M7.
import { clientesStore, type Cliente } from "./clientes-store";

export type DasStatus = "pendente" | "gerada" | "paga" | "erro";

export interface DasGuia {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  regime: "MEI" | "Simples";
  competencia: string; // YYYY-MM
  vencimento: string; // YYYY-MM-DD (20 do mês seguinte)
  valor: number;
  status: DasStatus;
  codigoBarras?: string;
  pdfUrl?: string;
  geradoEm?: string;
  pagoEm?: string;
  enviadoWhatsappEm?: string;
  erro?: string;
}

const KEY = "apoya:das";

function read(): DasGuia[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as DasGuia[]; } catch { return []; }
}

function write(list: DasGuia[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("apoya:das:changed"));
}

function vencimentoDoMes(competencia: string): string {
  // DAS vence dia 20 do mês seguinte à competência
  const [y, m] = competencia.split("-").map(Number);
  const next = new Date(y, m, 20);
  return next.toISOString().slice(0, 10);
}

function valorMock(cliente: Cliente): number {
  if (cliente.regime === "MEI") return 75.9 + Math.random() * 5;
  // Simples: estimativa pseudo-aleatória estável por id
  const seed = parseInt(cliente.id.replace(/\D/g, "").slice(-3) || "100", 10);
  return 300 + (seed % 50) * 47;
}

function codigoBarrasMock(): string {
  const blocks = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 1e11).toString().padStart(11, "0"),
  );
  return blocks.join(" ");
}

function ensureForCompetencia(competencia: string) {
  const list = read();
  const elig = clientesStore.list().filter(
    (c) => (c.regime === "MEI" || c.regime === "Simples") && c.status !== "inativo",
  );
  let changed = false;
  for (const c of elig) {
    if (list.some((g) => g.clienteId === c.id && g.competencia === competencia)) continue;
    list.push({
      id: crypto.randomUUID(),
      clienteId: c.id,
      clienteNome: c.razaoSocial,
      cnpj: c.cnpj,
      regime: c.regime as "MEI" | "Simples",
      competencia,
      vencimento: vencimentoDoMes(competencia),
      valor: Number(valorMock(c).toFixed(2)),
      status: "pendente",
    });
    changed = true;
  }
  if (changed) write(list);
  return list.filter((g) => g.competencia === competencia);
}

async function simulaSerpro(g: DasGuia): Promise<DasGuia> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
  // 5% de falha simulada
  if (Math.random() < 0.05) {
    return { ...g, status: "erro", erro: "Timeout no gateway SERPRO (mock)" };
  }
  return {
    ...g,
    status: "gerada",
    codigoBarras: codigoBarrasMock(),
    pdfUrl: `mock://das/${g.cnpj.replace(/\D/g, "")}-${g.competencia}.pdf`,
    geradoEm: new Date().toISOString(),
    erro: undefined,
  };
}

export const dasStore = {
  listByCompetencia: (competencia: string) => ensureForCompetencia(competencia),
  list: () => read(),
  async gerar(id: string) {
    const list = read();
    const idx = list.findIndex((g) => g.id === id);
    if (idx === -1) return;
    list[idx] = await simulaSerpro(list[idx]);
    write(list);
  },
  async gerarLote(ids: string[]) {
    const list = read();
    const updated = await Promise.all(
      list.map(async (g) => (ids.includes(g.id) ? await simulaSerpro(g) : g)),
    );
    write(updated);
  },
  marcarPaga(id: string) {
    const list = read().map((g) =>
      g.id === id ? { ...g, status: "paga" as DasStatus, pagoEm: new Date().toISOString() } : g,
    );
    write(list);
  },
  enviarWhatsapp(ids: string[]) {
    const list = read().map((g) =>
      ids.includes(g.id) && g.status === "gerada"
        ? { ...g, enviadoWhatsappEm: new Date().toISOString() }
        : g,
    );
    write(list);
  },
};
