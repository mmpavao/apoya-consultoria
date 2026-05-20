import { clientesStore, type Cliente, type Regime } from "./clientes-store";

export type ObrigacaoStatus = "pendente" | "concluida" | "atrasada";
export type ObrigacaoTipo = "DAS" | "DASN-Simei" | "DCTFWeb" | "EFD-Contribuições" | "EFD-ICMS/IPI" | "ECF" | "ECD" | "DIRBI" | "DEFIS" | "NFSe";

export interface Obrigacao {
  id: string;
  clienteId: string;
  clienteNome: string;
  regime: Regime;
  tipo: ObrigacaoTipo;
  descricao: string;
  competencia: string; // YYYY-MM
  vencimento: string; // YYYY-MM-DD
  status: ObrigacaoStatus;
  valor?: number;
  responsavel: string;
  concluidaEm?: string;
}

const KEY = "apoya:obrigacoes";

// Catálogo de obrigações por regime
const CATALOGO: Record<Regime, { tipo: ObrigacaoTipo; descricao: string; dia: number; valor?: number }[]> = {
  MEI: [
    { tipo: "DAS", descricao: "DAS-MEI mensal", dia: 20, valor: 75.9 },
  ],
  Simples: [
    { tipo: "DAS", descricao: "DAS — Simples Nacional", dia: 20 },
    { tipo: "DCTFWeb", descricao: "DCTFWeb mensal", dia: 15 },
    { tipo: "DIRBI", descricao: "DIRBI — Benefícios fiscais", dia: 20 },
  ],
  "Lucro Presumido": [
    { tipo: "DCTFWeb", descricao: "DCTFWeb mensal", dia: 15 },
    { tipo: "EFD-Contribuições", descricao: "EFD-Contribuições", dia: 10 },
    { tipo: "DIRBI", descricao: "DIRBI — Benefícios fiscais", dia: 20 },
  ],
  "Lucro Real": [
    { tipo: "DCTFWeb", descricao: "DCTFWeb mensal", dia: 15 },
    { tipo: "EFD-Contribuições", descricao: "EFD-Contribuições", dia: 10 },
    { tipo: "EFD-ICMS/IPI", descricao: "EFD ICMS/IPI", dia: 25 },
    { tipo: "DIRBI", descricao: "DIRBI — Benefícios fiscais", dia: 20 },
  ],
  "Doméstica": [
    { tipo: "DAS", descricao: "DAE — Doméstica", dia: 7 },
  ],
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function genForMonth(clientes: Cliente[], ano: number, mes: number): Obrigacao[] {
  const out: Obrigacao[] = [];
  const today = new Date();
  for (const c of clientes) {
    if (c.status === "inativo") continue;
    for (const item of CATALOGO[c.regime]) {
      const vencDate = new Date(ano, mes - 1, item.dia);
      const vencimento = `${ano}-${pad(mes)}-${pad(item.dia)}`;
      const competencia = `${ano}-${pad(mes)}`;
      const isPast = vencDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      // status seed: passado vira concluída ou atrasada; futuro pendente
      let status: ObrigacaoStatus = "pendente";
      let concluidaEm: string | undefined;
      if (isPast) {
        // 70% concluida, 30% atrasada
        const seed = (c.id.charCodeAt(0) + item.dia + mes) % 10;
        if (seed < 7) {
          status = "concluida";
          concluidaEm = vencimento;
        } else {
          status = "atrasada";
        }
      }
      out.push({
        id: `${c.id}-${competencia}-${item.tipo}`,
        clienteId: c.id,
        clienteNome: c.nomeFantasia || c.razaoSocial,
        regime: c.regime,
        tipo: item.tipo,
        descricao: item.descricao,
        competencia,
        vencimento,
        status,
        valor: item.valor,
        responsavel: c.responsavel,
        concluidaEm,
      });
    }
  }
  return out;
}

function read(): Obrigacao[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { return JSON.parse(raw) as Obrigacao[]; } catch { /* ignore */ }
  }
  // Gerar para mês atual e anterior
  const now = new Date();
  const clientes = clientesStore.list();
  const seed = [
    ...genForMonth(clientes, now.getFullYear(), now.getMonth() + 1),
    ...genForMonth(clientes, now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(), now.getMonth() === 0 ? 12 : now.getMonth()),
  ];
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
}

function write(list: Obrigacao[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("apoya:obrigacoes:changed"));
}

export const obrigacoesStore = {
  list: () => read(),
  toggle: (id: string) => {
    const list = read().map((o) => {
      if (o.id !== id) return o;
      if (o.status === "concluida") {
        const venc = new Date(o.vencimento);
        const isLate = venc < new Date();
        return { ...o, status: isLate ? "atrasada" as const : "pendente" as const, concluidaEm: undefined };
      }
      return { ...o, status: "concluida" as const, concluidaEm: new Date().toISOString().slice(0, 10) };
    });
    write(list);
  },
  regenerate: (ano: number, mes: number) => {
    const existing = read().filter((o) => o.competencia !== `${ano}-${pad(mes)}`);
    const novos = genForMonth(clientesStore.list(), ano, mes);
    write([...existing, ...novos]);
  },
};
