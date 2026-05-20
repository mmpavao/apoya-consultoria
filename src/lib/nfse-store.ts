// Mock NFS-e store backed by localStorage. Será substituído por integração NFE.io real em M7.
import { clientesStore, type Cliente } from "./clientes-store";

export type NfseStatus = "rascunho" | "emitida" | "cancelada" | "erro";

export interface NfseNota {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  regime: Cliente["regime"];
  numero?: string;
  serie: string;
  competencia: string; // YYYY-MM
  emissao: string; // YYYY-MM-DD
  tomador: string;
  cnpjTomador: string;
  descricaoServico: string;
  valorServico: number;
  aliquotaIss: number;
  valorIss: number;
  // CBS/IBS 2026
  valorCbs: number;
  valorIbs: number;
  valorLiquido: number;
  status: NfseStatus;
  xmlUrl?: string;
  pdfUrl?: string;
  enviadoWhatsappEm?: string;
  erro?: string;
}

const KEY = "apoya:nfse";

const TOMADORES = [
  { nome: "Comércio Atlas LTDA", cnpj: "10.111.222/0001-33" },
  { nome: "Prefeitura Municipal de São Paulo", cnpj: "46.395.000/0001-39" },
  { nome: "Indústria Vega S/A", cnpj: "22.333.444/0001-66" },
  { nome: "Mercado Central ME", cnpj: "33.444.555/0001-77" },
  { nome: "Studio Criativo LTDA", cnpj: "44.555.666/0001-88" },
];

const SERVICOS = [
  "Consultoria contábil e fiscal mensal",
  "Desenvolvimento de software sob encomenda",
  "Serviços de manutenção predial",
  "Assessoria jurídica empresarial",
  "Serviços fotográficos para evento corporativo",
  "Treinamento corporativo in company",
];

function read(): NfseNota[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as NfseNota[]; } catch { return []; }
}

function write(list: NfseNota[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("apoya:nfse:changed"));
}

function aliquotaPorRegime(r: Cliente["regime"]): number {
  if (r === "Simples") return 2.5;
  if (r === "Lucro Presumido") return 3;
  return 5;
}

function valorMock(c: Cliente): number {
  const seed = parseInt(c.id.replace(/\D/g, "").slice(-3) || "100", 10);
  return 1500 + (seed % 80) * 137;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function ensureForCompetencia(competencia: string) {
  const list = read();
  // NFS-e: todos exceto MEI (PRD: MEI isento de CBS/IBS 2026)
  const elig = clientesStore.list().filter(
    (c) => c.regime !== "MEI" && c.status !== "inativo",
  );
  let changed = false;
  for (const c of elig) {
    if (list.some((n) => n.clienteId === c.id && n.competencia === competencia)) continue;
    const seed = parseInt(c.id.replace(/\D/g, "").slice(-3) || "1", 10);
    const tomador = pick(TOMADORES, seed);
    const valorServico = Number(valorMock(c).toFixed(2));
    const aliq = aliquotaPorRegime(c.regime);
    const valorIss = Number((valorServico * (aliq / 100)).toFixed(2));
    // CBS/IBS 2026 - alíquotas teste (PRD): CBS 0,9% e IBS 0,1% em 2026
    const valorCbs = Number((valorServico * 0.009).toFixed(2));
    const valorIbs = Number((valorServico * 0.001).toFixed(2));
    const [y, m] = competencia.split("-").map(Number);
    list.push({
      id: crypto.randomUUID(),
      clienteId: c.id,
      clienteNome: c.razaoSocial,
      cnpj: c.cnpj,
      regime: c.regime,
      serie: "1",
      competencia,
      emissao: new Date(y, m - 1, Math.min(28, 5 + (seed % 20))).toISOString().slice(0, 10),
      tomador: tomador.nome,
      cnpjTomador: tomador.cnpj,
      descricaoServico: pick(SERVICOS, seed),
      valorServico,
      aliquotaIss: aliq,
      valorIss,
      valorCbs,
      valorIbs,
      valorLiquido: Number((valorServico - valorIss).toFixed(2)),
      status: "rascunho",
    });
    changed = true;
  }
  if (changed) write(list);
  return list.filter((n) => n.competencia === competencia);
}

async function simulaNfeIo(n: NfseNota): Promise<NfseNota> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 700));
  if (Math.random() < 0.06) {
    return { ...n, status: "erro", erro: "Rejeição NFE.io: código de serviço inválido (mock)" };
  }
  const numero = Math.floor(100000 + Math.random() * 900000).toString();
  return {
    ...n,
    status: "emitida",
    numero,
    xmlUrl: `mock://nfse/${n.cnpj.replace(/\D/g, "")}-${numero}.xml`,
    pdfUrl: `mock://nfse/${n.cnpj.replace(/\D/g, "")}-${numero}.pdf`,
    erro: undefined,
  };
}

export const nfseStore = {
  listByCompetencia: (competencia: string) => ensureForCompetencia(competencia),
  list: () => read(),
  async emitir(id: string) {
    const list = read();
    const idx = list.findIndex((n) => n.id === id);
    if (idx === -1) return;
    list[idx] = await simulaNfeIo(list[idx]);
    write(list);
  },
  async emitirLote(ids: string[]) {
    const list = read();
    const updated = await Promise.all(
      list.map(async (n) => (ids.includes(n.id) ? await simulaNfeIo(n) : n)),
    );
    write(updated);
  },
  cancelar(id: string) {
    const list = read().map((n) =>
      n.id === id ? { ...n, status: "cancelada" as NfseStatus } : n,
    );
    write(list);
  },
  enviarWhatsapp(ids: string[]) {
    const list = read().map((n) =>
      ids.includes(n.id) && n.status === "emitida"
        ? { ...n, enviadoWhatsappEm: new Date().toISOString() }
        : n,
    );
    write(list);
  },
};
