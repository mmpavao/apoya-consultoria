/**
 * Hook: useEscritorio
 * Lê e atualiza dados do escritório via tabela escritorio_config no Supabase.
 * Colunas sensíveis (api_keys) são protegidas pelo SECURITY_FIXES.sql (column-level REVOKE).
 * Templates de WhatsApp são gerenciados aqui.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Escritorio {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  crc: string;
  email: string;
  telefone: string;
  whatsapp: string;
  logotipoUrl?: string;
  diaCobranca: number;
  diasSuspensao: number;
  // Templates WhatsApp
  templateWaDas: string;
  templateWaNfse: string;
  templateWaCobranca: string;
}

function fromDb(r: Record<string, unknown>): Escritorio {
  return {
    id:               r.id as string,
    razaoSocial:      (r.razao_social as string)       ?? "",
    nomeFantasia:     (r.nome_fantasia as string)      ?? "",
    cnpj:             (r.cnpj as string)               ?? "",
    crc:              (r.crc as string)                ?? "",
    email:            (r.email as string)              ?? "",
    telefone:         (r.telefone as string)           ?? "",
    whatsapp:         (r.whatsapp as string)           ?? "",
    logotipoUrl:      r.logotipo_url as string | undefined,
    diaCobranca:      Number(r.dia_cobranca ?? 10),
    diasSuspensao:    Number(r.dias_suspensao ?? 45),
    templateWaDas:    (r.template_wa_das as string)    ?? "",
    templateWaNfse:   (r.template_wa_nfse as string)   ?? "",
    templateWaCobranca: (r.template_wa_cobranca as string) ?? "",
  };
}

const DEFAULT: Escritorio = {
  id: "", razaoSocial: "", nomeFantasia: "", cnpj: "", crc: "",
  email: "", telefone: "", whatsapp: "", diaCobranca: 10, diasSuspensao: 45,
  templateWaDas: "Olá {{nome}}, sua guia DAS de {{competencia}} vence em {{vencimento}}. Valor: R$ {{valor}}. Acesse: {{link}}",
  templateWaNfse: "Olá {{nome}}, sua NFS-e de {{competencia}} foi emitida. PDF: {{link}}",
  templateWaCobranca: "Olá {{nome}}, sua mensalidade de {{competencia}} no valor de R$ {{valor}} vence em {{vencimento}}. Pague via: {{link}}",
};

export function useEscritorio() {
  const [escritorio, setEscritorio] = useState<Escritorio>(DEFAULT);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error: err } = await db
        .from("escritorio_config")
        .select(`
          id, razao_social, nome_fantasia, cnpj, crc,
          email, telefone, whatsapp, logotipo_url,
          dia_cobranca, dias_suspensao,
          template_wa_das, template_wa_nfse, template_wa_cobranca
        `)
        .single();

      if (err && err.code !== "PGRST116") throw err;
      if (data) setEscritorio(fromDb(data));
      // Se não existir registro, usa DEFAULT
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar dados do escritório");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const save = useCallback(async (patch: Partial<Escritorio>) => {
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const dbPatch: Record<string, unknown> = {};
      if (patch.razaoSocial    !== undefined) dbPatch.razao_social        = patch.razaoSocial;
      if (patch.nomeFantasia   !== undefined) dbPatch.nome_fantasia       = patch.nomeFantasia;
      if (patch.cnpj           !== undefined) dbPatch.cnpj                = patch.cnpj;
      if (patch.crc            !== undefined) dbPatch.crc                 = patch.crc;
      if (patch.email          !== undefined) dbPatch.email               = patch.email;
      if (patch.telefone       !== undefined) dbPatch.telefone            = patch.telefone;
      if (patch.whatsapp       !== undefined) dbPatch.whatsapp            = patch.whatsapp;
      if (patch.diaCobranca    !== undefined) dbPatch.dia_cobranca        = patch.diaCobranca;
      if (patch.diasSuspensao  !== undefined) dbPatch.dias_suspensao      = patch.diasSuspensao;
      if (patch.templateWaDas       !== undefined) dbPatch.template_wa_das      = patch.templateWaDas;
      if (patch.templateWaNfse      !== undefined) dbPatch.template_wa_nfse     = patch.templateWaNfse;
      if (patch.templateWaCobranca  !== undefined) dbPatch.template_wa_cobranca = patch.templateWaCobranca;

      let err;
      if (escritorio.id) {
        ({ error: err } = await db.from("escritorio_config").update(dbPatch).eq("id", escritorio.id));
      } else {
        ({ error: err } = await db.from("escritorio_config").insert(dbPatch));
      }
      if (err) throw err;
      toast.success("Dados salvos com sucesso");
      await fetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }, [escritorio.id, fetch]);

  return { escritorio, loading, saving, save, refresh: fetch };
}
