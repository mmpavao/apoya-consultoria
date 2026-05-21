/**
 * Hook: useConvites
 * CRUD de convites — apenas admin.
 * A criação do token seguro acontece no servidor (Edge Function send-invite).
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Convite {
  id: string;
  email: string;
  role: string;
  setores_ids: string[];
  criado_em: string;
  expira_em: string;
  usado_em?: string;
  cancelado_em?: string;
  mensagem?: string;
  criado_por?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useConvites() {
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await db
        .from("convites")
        .select("id, email, role, setores_ids, criado_em, expira_em, usado_em, cancelado_em, mensagem, criado_por")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      setConvites(data ?? []);
    } catch {
      toast.error("Erro ao carregar convites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  /** Envia convite via Edge Function (gera token seguro no servidor) */
  const enviar = useCallback(async (params: {
    email: string;
    role: string;
    setores_ids?: string[];
    mensagem?: string;
  }) => {
    setSending(true);
    try {
      const { data, error } = await db.functions.invoke("send-invite", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Convite enviado para ${params.email}`);
      await fetch();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar convite";
      toast.error(msg);
      return { ok: false, error: msg };
    } finally {
      setSending(false);
    }
  }, [fetch]);

  /** Cancelar convite (admin) */
  const cancelar = useCallback(async (id: string) => {
    const { error } = await db
      .from("convites")
      .update({ cancelado_em: new Date().toISOString() })
      .eq("id", id)
      .is("usado_em", null);
    if (error) { toast.error("Erro ao cancelar convite"); return; }
    toast.success("Convite cancelado");
    await fetch();
  }, [fetch]);

  /** Reenviar convite (cria novo, cancela o antigo) */
  const reenviar = useCallback(async (convite: Convite) => {
    await cancelar(convite.id);
    await enviar({
      email: convite.email,
      role: convite.role,
      setores_ids: convite.setores_ids,
      mensagem: convite.mensagem,
    });
  }, [cancelar, enviar]);

  const pendentes  = convites.filter(c => !c.usado_em && !c.cancelado_em && new Date(c.expira_em) > new Date());
  const expirados  = convites.filter(c => !c.usado_em && !c.cancelado_em && new Date(c.expira_em) <= new Date());
  const aceitos    = convites.filter(c => !!c.usado_em);
  const cancelados = convites.filter(c => !!c.cancelado_em);

  return {
    convites, loading, sending,
    pendentes, expirados, aceitos, cancelados,
    enviar, cancelar, reenviar, refetch: fetch,
  };
}
