import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ─── Types ───────────────────────────────────────────────────────────────── */
export type LeadEtapa =
  | "novo" | "qualificacao" | "coleta_dados" | "proposta"
  | "negociacao" | "fechado_ganho" | "fechado_perdido";

export type LeadTemperatura = "frio" | "morno" | "quente";

export type LeadCanal =
  | "whatsapp" | "whatsapp_organico" | "whatsapp_indicacao"
  | "instagram" | "site" | "indicacao" | "google" | "outro";

export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  regime_tributario?: string;
  situacao_cadastral?: string;
  porte?: string;
  municipio?: string;
  uf?: string;
  socios?: unknown[];
  etapa: LeadEtapa;
  temperatura: LeadTemperatura;
  origem: string;
  canal: LeadCanal;
  responsavel: string;
  honorario_proposto?: number;
  cliente_id?: string;
  contato_id?: string;
  conversa_id?: string;
  ultimo_contato?: string;
  proximo_passo?: string;
  motivo_perda?: string;
  observacoes?: string;
  tags: string[];
  metadados: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type LeadFormData = Omit<Lead, "id" | "created_at" | "updated_at" | "created_by">;

export type LeadFilters = {
  etapa?: LeadEtapa;
  temperatura?: LeadTemperatura;
  canal?: LeadCanal;
  responsavel?: string;
  search?: string;
};

/* ─── Labels & helpers ────────────────────────────────────────────────────── */
export const ETAPA_LABEL: Record<LeadEtapa, string> = {
  novo:           "Novo",
  qualificacao:   "Qualificação",
  coleta_dados:   "Coleta de Dados",
  proposta:       "Proposta",
  negociacao:     "Negociação",
  fechado_ganho:  "Fechado ✅",
  fechado_perdido:"Perdido ❌",
};

export const ETAPA_COR: Record<LeadEtapa, string> = {
  novo:           "bg-slate-100 text-slate-700",
  qualificacao:   "bg-blue-100 text-blue-700",
  coleta_dados:   "bg-yellow-100 text-yellow-700",
  proposta:       "bg-violet-100 text-violet-700",
  negociacao:     "bg-orange-100 text-orange-700",
  fechado_ganho:  "bg-emerald-100 text-emerald-700",
  fechado_perdido:"bg-red-100 text-red-600",
};

export const TEMP_LABEL: Record<LeadTemperatura, string> = {
  frio: "🥶 Frio", morno: "🌡️ Morno", quente: "🔥 Quente",
};

export const TEMP_COR: Record<LeadTemperatura, string> = {
  frio:   "bg-sky-100 text-sky-700",
  morno:  "bg-amber-100 text-amber-700",
  quente: "bg-red-100 text-red-600",
};

export const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", whatsapp_organico: "WhatsApp Orgânico",
  whatsapp_indicacao: "WhatsApp Indicação", instagram: "Instagram",
  site: "Site", indicacao: "Indicação", google: "Google", outro: "Outro",
};

export const FUNIL_COLS: { etapa: LeadEtapa; accent: string; bg: string }[] = [
  { etapa: "novo",           accent: "border-t-slate-400",   bg: "bg-slate-50/60"   },
  { etapa: "qualificacao",   accent: "border-t-blue-400",    bg: "bg-blue-50/60"    },
  { etapa: "coleta_dados",   accent: "border-t-yellow-400",  bg: "bg-yellow-50/60"  },
  { etapa: "proposta",       accent: "border-t-violet-400",  bg: "bg-violet-50/60"  },
  { etapa: "negociacao",     accent: "border-t-orange-400",  bg: "bg-orange-50/60"  },
  { etapa: "fechado_ganho",  accent: "border-t-emerald-400", bg: "bg-emerald-50/60" },
  { etapa: "fechado_perdido",accent: "border-t-red-400",     bg: "bg-red-50/60"     },
];

// Helper seguro Supabase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tb = () => (supabase as any).from("leads_crm");

/* ─── Hook principal ──────────────────────────────────────────────────────── */
export function useLeadsCrm(filters?: LeadFilters) {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = tb().select("*").order("created_at", { ascending: false });
      if (filters?.etapa)      q = q.eq("etapa", filters.etapa);
      if (filters?.temperatura)q = q.eq("temperatura", filters.temperatura);
      if (filters?.canal)      q = q.eq("canal", filters.canal);
      if (filters?.responsavel)q = q.eq("responsavel", filters.responsavel);
      if (filters?.search) {
        q = q.or(
          `nome.ilike.%${filters.search}%,` +
          `razao_social.ilike.%${filters.search}%,` +
          `telefone.ilike.%${filters.search}%,` +
          `cnpj.ilike.%${filters.search}%`
        );
      }
      const { data, error: err } = await q;
      if (err) throw err;
      setLeads((data ?? []).map((l: Lead) => ({
        ...l,
        tags: Array.isArray(l.tags) ? l.tags : [],
        metadados: typeof l.metadados === "object" && l.metadados ? l.metadados as Record<string, unknown> : {},
        socios: Array.isArray(l.socios) ? l.socios : [],
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar leads");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const criarLead = useCallback(async (data: Partial<LeadFormData>) => {
    const { data: row, error: err } = await tb().insert({
      ...data,
      tags:      data.tags ?? [],
      metadados: data.metadados ?? {},
    }).select().single();
    if (err) throw err;
    await fetchLeads();
    return row as Lead;
  }, [fetchLeads]);

  const atualizarLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    const { error: err } = await tb().update(updates).eq("id", id);
    if (err) throw err;
    await fetchLeads();
  }, [fetchLeads]);

  const moverEtapa = useCallback(async (id: string, etapa: LeadEtapa) => {
    const { error: err } = await tb().update({ etapa }).eq("id", id);
    if (err) throw err;
    await fetchLeads();
  }, [fetchLeads]);

  const deletarLead = useCallback(async (id: string) => {
    const { error: err } = await tb().delete().eq("id", id);
    if (err) throw err;
    await fetchLeads();
  }, [fetchLeads]);

  // Stats para dashboard
  const stats = {
    total:          leads.length,
    novos:          leads.filter(l => l.etapa === "novo").length,
    emNegociacao:   leads.filter(l => ["proposta","negociacao"].includes(l.etapa)).length,
    fechadosGanhos: leads.filter(l => l.etapa === "fechado_ganho").length,
    perdidos:       leads.filter(l => l.etapa === "fechado_perdido").length,
    quentes:        leads.filter(l => l.temperatura === "quente").length,
    mrr:            leads
      .filter(l => l.etapa === "fechado_ganho" && l.honorario_proposto)
      .reduce((s, l) => s + (l.honorario_proposto ?? 0), 0),
    pipeline:       leads
      .filter(l => !["fechado_ganho","fechado_perdido"].includes(l.etapa) && l.honorario_proposto)
      .reduce((s, l) => s + (l.honorario_proposto ?? 0), 0),
  };

  return {
    leads, loading, error,
    refetch: fetchLeads,
    criarLead, atualizarLead, moverEtapa, deletarLead,
    stats,
  };
}
