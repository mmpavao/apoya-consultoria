// Configurações do escritório (mock, localStorage).
export type UsuarioRole = "admin" | "fiscal" | "financeiro" | "dp";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: UsuarioRole;
  ativo: boolean;
  criadoEm: string;
}

export interface Integracao {
  id: "asaas" | "nfeio" | "evolution" | "serpro";
  nome: string;
  descricao: string;
  apiKey: string;
  baseUrl: string;
  ativo: boolean;
  ultimaSync?: string;
}

export interface TemplateWA {
  id: string;
  nome: string;
  evento: "das-gerado" | "nfse-emitida" | "cobranca-vencendo" | "cobranca-vencida" | "boas-vindas";
  texto: string;
  ativo: boolean;
}

export interface Escritorio {
  razaoSocial: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  responsavel: string;
  crc: string;
}

const K_USERS = "apoya:cfg:usuarios";
const K_INT = "apoya:cfg:integracoes";
const K_TPL = "apoya:cfg:templates";
const K_ESC = "apoya:cfg:escritorio";

function read<T>(k: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(k);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
function write<T>(k: string, v: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(k, JSON.stringify(v));
  window.dispatchEvent(new CustomEvent("apoya:config:changed"));
}

const SEED_USERS: Usuario[] = [
  { id: crypto.randomUUID?.() ?? "u1", nome: "Carla Mendes", email: "carla@apoya.com.br", role: "admin", ativo: true, criadoEm: "2025-08-12" },
  { id: crypto.randomUUID?.() ?? "u2", nome: "Rafael Souza", email: "rafael@apoya.com.br", role: "fiscal", ativo: true, criadoEm: "2025-09-03" },
  { id: crypto.randomUUID?.() ?? "u3", nome: "Patrícia Lima", email: "patricia@apoya.com.br", role: "financeiro", ativo: true, criadoEm: "2025-10-21" },
  { id: crypto.randomUUID?.() ?? "u4", nome: "Diego Almeida", email: "diego@apoya.com.br", role: "dp", ativo: false, criadoEm: "2026-01-08" },
];

const SEED_INT: Integracao[] = [
  { id: "asaas", nome: "Asaas", descricao: "Gateway de cobrança (PIX/boleto)", apiKey: "$aas_prod_••••••••••••3F8a", baseUrl: "https://api.asaas.com/v3", ativo: true, ultimaSync: "2026-05-20T08:14:00Z" },
  { id: "nfeio", nome: "Focus NF-e", descricao: "Emissão e consulta de NFS-e", apiKey: "fioJ••••••••••••••••", baseUrl: "https://homologacao.focusnfe.com.br/v2", ativo: true, ultimaSync: "2026-06-03T00:00:00Z" },
  { id: "evolution", nome: "Evolution API", descricao: "WhatsApp não-oficial", apiKey: "evo_••••••••••••91bd", baseUrl: "https://wa.apoya.com.br", ativo: true, ultimaSync: "2026-05-20T09:02:00Z" },
  { id: "serpro", nome: "SERPRO Gateway", descricao: "Consulta CNPJ + DAS Simples", apiKey: "srp_••••••••••••7c04", baseUrl: "https://serpro.apoya.com.br:4010", ativo: true, ultimaSync: "2026-05-20T09:10:00Z" },
];

const SEED_TPL: TemplateWA[] = [
  { id: "t1", nome: "DAS gerado", evento: "das-gerado", texto: "Olá {CLIENTE}! Sua guia DAS da competência {COMP} já está disponível. Vencimento em {VENC}. Valor: R$ {VALOR}.", ativo: true },
  { id: "t2", nome: "NFS-e emitida", evento: "nfse-emitida", texto: "Oi {CLIENTE}, emitimos a NFS-e nº {NUMERO} no valor de R$ {VALOR}. Anexamos PDF e XML.", ativo: true },
  { id: "t3", nome: "Cobrança vencendo", evento: "cobranca-vencendo", texto: "Lembrete: sua mensalidade vence em {VENC}. Pague com PIX em segundos: {LINK}", ativo: true },
  { id: "t4", nome: "Cobrança vencida", evento: "cobranca-vencida", texto: "{CLIENTE}, identificamos atraso de {DIAS} dias na cobrança {DESC}. Regularize por: {LINK}", ativo: true },
  { id: "t5", nome: "Boas-vindas", evento: "boas-vindas", texto: "Seja bem-vindo(a) à APOYA, {CLIENTE}! Qualquer dúvida, é só responder aqui.", ativo: false },
];

const SEED_ESC: Escritorio = {
  razaoSocial: "APOYA Contabilidade Digital LTDA",
  cnpj: "55.123.456/0001-90",
  email: "contato@apoya.com.br",
  telefone: "(11) 4040-1010",
  endereco: "Av. Paulista, 1578 · cj. 1204 · São Paulo/SP",
  responsavel: "Carla Mendes",
  crc: "CRC/SP 1SP-298.471/O-3",
};

export const configStore = {
  // Usuários
  listUsers(): Usuario[] {
    const v = read<Usuario[]>(K_USERS);
    if (v) return v;
    write(K_USERS, SEED_USERS);
    return SEED_USERS;
  },
  saveUser(u: Usuario) {
    const list = configStore.listUsers();
    const i = list.findIndex((x) => x.id === u.id);
    if (i === -1) list.push(u); else list[i] = u;
    write(K_USERS, list);
  },
  removeUser(id: string) {
    write(K_USERS, configStore.listUsers().filter((u) => u.id !== id));
  },
  toggleUser(id: string) {
    write(K_USERS, configStore.listUsers().map((u) => u.id === id ? { ...u, ativo: !u.ativo } : u));
  },
  // Integrações
  listIntegracoes(): Integracao[] {
    const v = read<Integracao[]>(K_INT);
    if (v) return v;
    write(K_INT, SEED_INT);
    return SEED_INT;
  },
  saveIntegracao(i: Integracao) {
    const list = configStore.listIntegracoes().map((x) => x.id === i.id ? i : x);
    write(K_INT, list);
  },
  toggleIntegracao(id: Integracao["id"]) {
    write(K_INT, configStore.listIntegracoes().map((x) => x.id === id ? { ...x, ativo: !x.ativo } : x));
  },
  async testIntegracao(id: Integracao["id"]): Promise<{ ok: boolean; latencyMs: number; msg: string }> {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 700));
    const ok = Math.random() > 0.1;
    const list = configStore.listIntegracoes().map((x) => x.id === id ? { ...x, ultimaSync: new Date().toISOString() } : x);
    write(K_INT, list);
    return { ok, latencyMs: Math.round(120 + Math.random() * 300), msg: ok ? "Conexão estabelecida" : "Falha de autenticação (mock)" };
  },
  // Templates
  listTemplates(): TemplateWA[] {
    const v = read<TemplateWA[]>(K_TPL);
    if (v) return v;
    write(K_TPL, SEED_TPL);
    return SEED_TPL;
  },
  saveTemplate(t: TemplateWA) {
    const list = configStore.listTemplates();
    const i = list.findIndex((x) => x.id === t.id);
    if (i === -1) list.push(t); else list[i] = t;
    write(K_TPL, list);
  },
  removeTemplate(id: string) {
    write(K_TPL, configStore.listTemplates().filter((t) => t.id !== id));
  },
  // Escritório
  getEscritorio(): Escritorio {
    const v = read<Escritorio>(K_ESC);
    if (v) return v;
    write(K_ESC, SEED_ESC);
    return SEED_ESC;
  },
  saveEscritorio(e: Escritorio) {
    write(K_ESC, e);
  },
};

export const roleLabels: Record<UsuarioRole, string> = {
  admin: "Administrador",
  fiscal: "Fiscal",
  financeiro: "Financeiro",
  dp: "Depto. Pessoal",
};
