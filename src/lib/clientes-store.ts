// Mock clientes store backed by localStorage. Será substituído por Supabase na Fase B.
// Os labels do regime mantêm "Simples" como chave interna (UI exibe "Simples Nacional")
// para evitar quebra das stores M2–M7 que já referenciam essa chave.
export type Regime = "MEI" | "Simples" | "Lucro Presumido" | "Lucro Real" | "Doméstica";
export type Status = "ativo" | "inadimplente" | "suspenso" | "inativo" | "em_analise";
export type TierServico = "MEI" | "Simples" | "Empresarial" | "Doméstica";
export type FormaPagamento = "PIX" | "Boleto" | "Débito automático";

export interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  regime: Regime;
  regimeHibrido?: boolean; // somente Simples Nacional
  tier?: TierServico;
  status: Status;
  responsavel: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  inscricaoMunicipal?: string;
  inscricaoEstadual?: string;
  codigoServicoNfse?: string;
  diaVencimento?: number; // 1-28
  valorHonorario?: number;
  formaPagamento?: FormaPagamento;
  temEmpregados?: boolean;
  temIncentivoFiscal?: boolean;
  endereco?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
  };
  atividadePrincipal?: string;
  observacoes?: string;
  createdAt: string;
}

const KEY = "apoya:clientes";

const SEED: Cliente[] = [
  {
    id: "c1", razaoSocial: "Padaria São José LTDA", nomeFantasia: "Pão Quente",
    cnpj: "12.345.678/0001-90", regime: "Simples", tier: "Simples", status: "ativo", responsavel: "Ana Souza",
    email: "contato@paoquente.com.br", telefone: "(11) 3333-1111", whatsapp: "+5512999990001",
    codigoServicoNfse: "17.19", diaVencimento: 10, valorHonorario: 450, formaPagamento: "PIX",
    temEmpregados: true,
    endereco: { municipio: "São Paulo", uf: "SP" },
    atividadePrincipal: "Comércio varejista de produtos de padaria",
    createdAt: new Date().toISOString(),
  },
  {
    id: "c2", razaoSocial: "Consultório Dental Lima LTDA", nomeFantasia: "Dental Lima",
    cnpj: "98.765.432/0001-11", regime: "Lucro Presumido", tier: "Empresarial", status: "ativo", responsavel: "Carlos Lima",
    email: "joana@dental.com", telefone: "(11) 99999-2222", whatsapp: "+5512999990002",
    codigoServicoNfse: "4.01", diaVencimento: 5, valorHonorario: 890, formaPagamento: "Boleto",
    temEmpregados: true,
    endereco: { municipio: "São Paulo", uf: "SP" },
    atividadePrincipal: "Atividades odontológicas",
    createdAt: new Date().toISOString(),
  },
  {
    id: "c3", razaoSocial: "João Silva 12345678900", nomeFantasia: "João MEI",
    cnpj: "11.111.111/0001-55", regime: "MEI", tier: "MEI", status: "inadimplente", responsavel: "Ana Souza",
    email: "joao@mei.com", telefone: "(11) 4002-8922", whatsapp: "+5512999990003",
    diaVencimento: 10, valorHonorario: 89, formaPagamento: "PIX",
    endereco: { municipio: "Campinas", uf: "SP" },
    atividadePrincipal: "Serviços de entrega rápida",
    createdAt: new Date().toISOString(),
  },
  {
    id: "c4", razaoSocial: "Transportadora Rápida LTDA", nomeFantasia: "Rápida",
    cnpj: "22.222.222/0001-66", regime: "Lucro Real", tier: "Empresarial", status: "ativo", responsavel: "Marcos Pinto",
    email: "contabil@rapida.com.br", telefone: "(11) 5555-4444", whatsapp: "+5512999990004",
    codigoServicoNfse: "16.01", diaVencimento: 15, valorHonorario: 1480, formaPagamento: "Boleto",
    temEmpregados: true, temIncentivoFiscal: true,
    endereco: { municipio: "São Paulo", uf: "SP" },
    atividadePrincipal: "Transporte rodoviário de carga",
    createdAt: new Date().toISOString(),
  },
  {
    id: "c5", razaoSocial: "Maria Doméstica", cnpj: "33.333.333/0001-77",
    regime: "Doméstica", tier: "Doméstica", status: "suspenso", responsavel: "Carlos Lima",
    email: "maria@dom.com", telefone: "(11) 2222-7777", whatsapp: "+5512999990005",
    diaVencimento: 5, valorHonorario: 150, formaPagamento: "PIX",
    endereco: { municipio: "Santo André", uf: "SP" },
    atividadePrincipal: "Empregadora doméstica",
    createdAt: new Date().toISOString(),
  },
];

function read(): Cliente[] {
  if (typeof window === "undefined") return SEED;
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    localStorage.setItem(KEY, JSON.stringify(SEED));
    return SEED;
  }
  try { return JSON.parse(raw) as Cliente[]; } catch { return SEED; }
}

function write(list: Cliente[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("apoya:clientes:changed"));
}

export const clientesStore = {
  list: () => read(),
  get: (id: string) => read().find((c) => c.id === id),
  create: (c: Omit<Cliente, "id" | "createdAt">) => {
    const novo: Cliente = { ...c, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    write([novo, ...read()]);
    return novo;
  },
  update: (id: string, patch: Partial<Cliente>) => {
    const list = read().map((c) => (c.id === id ? { ...c, ...patch } : c));
    write(list);
  },
  remove: (id: string) => write(read().filter((c) => c.id !== id)),
  resetSeed: () => write(SEED),
};

export const RESPONSAVEIS = ["Ana Souza", "Carlos Lima", "Marcos Pinto"];

export const REGIME_LABEL: Record<Regime, string> = {
  MEI: "MEI",
  Simples: "Simples Nacional",
  "Lucro Presumido": "Lucro Presumido",
  "Lucro Real": "Lucro Real",
  "Doméstica": "Doméstica",
};

export const STATUS_LABEL: Record<Status, string> = {
  ativo: "Ativo",
  inadimplente: "Inadimplente",
  suspenso: "Suspenso",
  inativo: "Inativo",
  em_analise: "Em análise",
};
