// Mock clientes store backed by localStorage. Will be replaced by Supabase em M7.
export type Regime = "MEI" | "Simples" | "Lucro Presumido" | "Lucro Real";
export type Status = "ativo" | "inativo" | "pendente";

export interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  regime: Regime;
  status: Status;
  responsavel: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  inscricaoMunicipal?: string;
  inscricaoEstadual?: string;
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
    id: "c1", razaoSocial: "Padaria Pão Quente LTDA", nomeFantasia: "Pão Quente",
    cnpj: "12.345.678/0001-90", regime: "Simples", status: "ativo", responsavel: "Ana Souza",
    email: "contato@paoquente.com.br", telefone: "(11) 3333-1111",
    endereco: { municipio: "São Paulo", uf: "SP" },
    atividadePrincipal: "Comércio varejista de produtos de padaria",
    createdAt: new Date().toISOString(),
  },
  {
    id: "c2", razaoSocial: "Joana Silva 12345678900", nomeFantasia: "Joana Beleza",
    cnpj: "98.765.432/0001-10", regime: "MEI", status: "ativo", responsavel: "Carlos Lima",
    email: "joana@beleza.com", telefone: "(11) 99999-2222",
    endereco: { municipio: "Guarulhos", uf: "SP" },
    atividadePrincipal: "Cabeleireiros, manicure e pedicure",
    createdAt: new Date().toISOString(),
  },
  {
    id: "c3", razaoSocial: "TechNova Sistemas S/A", nomeFantasia: "TechNova",
    cnpj: "11.222.333/0001-44", regime: "Lucro Presumido", status: "pendente", responsavel: "Ana Souza",
    email: "fiscal@technova.com", telefone: "(11) 4002-8922",
    endereco: { municipio: "Campinas", uf: "SP" },
    atividadePrincipal: "Desenvolvimento de software sob encomenda",
    createdAt: new Date().toISOString(),
  },
  {
    id: "c4", razaoSocial: "Construtora Horizonte LTDA", nomeFantasia: "Horizonte",
    cnpj: "55.666.777/0001-88", regime: "Lucro Real", status: "ativo", responsavel: "Marcos Pinto",
    email: "contabil@horizonte.com.br", telefone: "(11) 5555-4444",
    endereco: { municipio: "São Paulo", uf: "SP" },
    atividadePrincipal: "Construção de edifícios",
    createdAt: new Date().toISOString(),
  },
  {
    id: "c5", razaoSocial: "Estúdio Fotográfico Luz LTDA", nomeFantasia: "Luz Foto",
    cnpj: "22.333.444/0001-55", regime: "Simples", status: "inativo", responsavel: "Carlos Lima",
    email: "estudio@luz.com", telefone: "(11) 2222-7777",
    endereco: { municipio: "Santo André", uf: "SP" },
    atividadePrincipal: "Atividades de fotografia",
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
};

export const RESPONSAVEIS = ["Ana Souza", "Carlos Lima", "Marcos Pinto"];
