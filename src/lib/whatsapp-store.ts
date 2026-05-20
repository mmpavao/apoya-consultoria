// Mock WhatsApp store backed by localStorage (Evolution API mock).
import { clientesStore } from "./clientes-store";

export type MsgDirection = "in" | "out";
export type MsgKind = "text" | "file";
export type ConversationTag = "automacao" | "manual" | "cobranca" | "fiscal" | "suporte";

export interface Mensagem {
  id: string;
  direction: MsgDirection;
  kind: MsgKind;
  content: string;
  fileName?: string;
  fileType?: "pdf" | "xml" | "img";
  createdAt: string;
  lida: boolean;
  autor?: string; // se manual
}

export interface Conversa {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  avatar: string;
  ultimaMensagem: string;
  ultimaAt: string;
  naoLidas: number;
  tag: ConversationTag;
  mensagens: Mensagem[];
}

const KEY = "apoya:whatsapp:conversas";

function read(): Conversa[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as Conversa[]; } catch { return []; }
}

function write(list: Conversa[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("apoya:whatsapp:changed"));
}

const TEMPLATES: Array<{ tag: ConversationTag; texts: string[] }> = [
  { tag: "automacao", texts: [
    "Olá! Sua guia DAS de competência {COMP} já está disponível. Vencimento em 20/{M}.",
    "Lembrete automático: NFS-e emitida com sucesso. Anexamos o PDF e o XML.",
  ]},
  { tag: "cobranca", texts: [
    "Identificamos atraso de 7 dias na cobrança {DESC}. Pague pelo PIX para evitar juros.",
    "Sua mensalidade vence amanhã. Posso te enviar o link de pagamento?",
  ]},
  { tag: "fiscal", texts: [
    "Bom dia! Preciso da nota de serviço do mês passado para conciliar.",
    "Recebemos o XML da NFE.io. Está tudo certo com a tomadora.",
  ]},
  { tag: "manual", texts: [
    "Oi! Pode confirmar o endereço atualizado da empresa?",
    "Conversei com a Ana — vamos agendar uma call amanhã às 10h.",
  ]},
  { tag: "suporte", texts: [
    "Bom dia, estou com dúvida no acesso ao portal do cliente.",
    "Consegue me reenviar o boleto deste mês? Não chegou no e-mail.",
  ]},
];

function pickT(seed: number) {
  return TEMPLATES[seed % TEMPLATES.length];
}

function seedIfEmpty() {
  const list = read();
  if (list.length > 0) return list;
  const clientes = clientesStore.list();
  const now = Date.now();
  const seeded: Conversa[] = clientes.slice(0, 10).map((c, i) => {
    const t = pickT(i);
    const competencia = "10/2026";
    const text = t.texts[i % t.texts.length]
      .replace("{COMP}", competencia)
      .replace("{M}", "11")
      .replace("{DESC}", "Honorários contábeis");
    const naoLidas = i % 3 === 0 ? 1 + (i % 3) : 0;
    const mensagens: Mensagem[] = [
      {
        id: crypto.randomUUID(),
        direction: i % 2 === 0 ? "out" : "in",
        kind: "text",
        content: text,
        createdAt: new Date(now - (i + 1) * 1000 * 60 * 47).toISOString(),
        lida: true,
        autor: i % 2 === 0 ? "APOYA (auto)" : undefined,
      },
    ];
    if (i % 3 === 0) {
      mensagens.push({
        id: crypto.randomUUID(),
        direction: "out",
        kind: "file",
        content: "DAS-11-2026.pdf",
        fileName: "DAS-11-2026.pdf",
        fileType: "pdf",
        createdAt: new Date(now - (i + 1) * 1000 * 60 * 45).toISOString(),
        lida: true,
        autor: "APOYA (auto)",
      });
    }
    if (naoLidas > 0) {
      mensagens.push({
        id: crypto.randomUUID(),
        direction: "in",
        kind: "text",
        content: "Recebido, obrigado!",
        createdAt: new Date(now - (i + 1) * 1000 * 60 * 5).toISOString(),
        lida: false,
      });
    }
    const last = mensagens[mensagens.length - 1];
    return {
      id: crypto.randomUUID(),
      clienteId: c.id,
      clienteNome: c.razaoSocial,
      telefone: c.whatsapp || c.telefone || "(11) 9 9999-0000",
      avatar: c.razaoSocial.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
      ultimaMensagem: last.kind === "file" ? `📎 ${last.fileName}` : last.content,
      ultimaAt: last.createdAt,
      naoLidas,
      tag: t.tag,
      mensagens,
    };
  });
  write(seeded);
  return seeded;
}

export const whatsappStore = {
  list: () => seedIfEmpty().sort((a, b) => +new Date(b.ultimaAt) - +new Date(a.ultimaAt)),
  get: (id: string) => read().find((c) => c.id === id),
  marcarLida(id: string) {
    const list = read().map((c) =>
      c.id === id
        ? { ...c, naoLidas: 0, mensagens: c.mensagens.map((m) => ({ ...m, lida: true })) }
        : c,
    );
    write(list);
  },
  enviar(id: string, content: string, autor = "Você") {
    const list = read();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const msg: Mensagem = {
      id: crypto.randomUUID(),
      direction: "out",
      kind: "text",
      content,
      createdAt: new Date().toISOString(),
      lida: true,
      autor,
    };
    list[idx] = {
      ...list[idx],
      mensagens: [...list[idx].mensagens, msg],
      ultimaMensagem: content,
      ultimaAt: msg.createdAt,
    };
    write(list);
    // resposta automática mock
    setTimeout(() => {
      const cur = read();
      const j = cur.findIndex((c) => c.id === id);
      if (j === -1) return;
      const reply: Mensagem = {
        id: crypto.randomUUID(),
        direction: "in",
        kind: "text",
        content: "Mensagem recebida ✓ — retornaremos em breve.",
        createdAt: new Date().toISOString(),
        lida: false,
      };
      cur[j] = {
        ...cur[j],
        mensagens: [...cur[j].mensagens, reply],
        ultimaMensagem: reply.content,
        ultimaAt: reply.createdAt,
        naoLidas: cur[j].naoLidas + 1,
      };
      write(cur);
    }, 1400 + Math.random() * 1200);
  },
  enviarArquivo(id: string, fileName: string, fileType: "pdf" | "xml" | "img") {
    const list = read();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const msg: Mensagem = {
      id: crypto.randomUUID(),
      direction: "out",
      kind: "file",
      content: fileName,
      fileName,
      fileType,
      createdAt: new Date().toISOString(),
      lida: true,
      autor: "Você",
    };
    list[idx] = {
      ...list[idx],
      mensagens: [...list[idx].mensagens, msg],
      ultimaMensagem: `📎 ${fileName}`,
      ultimaAt: msg.createdAt,
    };
    write(list);
  },
};
