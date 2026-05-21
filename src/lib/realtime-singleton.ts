/**
 * APOYA Realtime Singleton
 * ─────────────────────────────────────────────────────────────────────
 * Centraliza TODOS os channels do Supabase Realtime em um único lugar.
 * Isso evita o erro "cannot add postgres_changes callbacks after subscribe()"
 * que ocorre quando múltiplos componentes chamam o mesmo hook (ex: useClientes
 * aparece em 7 lugares) e cada um tenta criar um channel com o mesmo nome.
 *
 * Padrão: cada tabela tem um único channel. Mutations disparam CustomEvents
 * no window, e os hooks escutam esses eventos em vez de criar channels próprios.
 */
import { supabase } from "@/integrations/supabase/client";

type TableName =
  | "clientes"
  | "cobrancas"
  | "obrigacoes"
  | "wa_instance"
  | "wa_conversa"
  | "mensagem_whatsapp";

const CHANNEL_ID = "apoya:realtime:master";

let initialized = false;

/**
 * Inicializa o channel master de realtime.
 * Deve ser chamado UMA VEZ no root da aplicação (_app.tsx).
 */
export function initRealtime() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  supabase
    .channel(CHANNEL_ID)
    .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => {
      window.dispatchEvent(new CustomEvent("apoya:rt:clientes"));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "cobrancas" }, () => {
      window.dispatchEvent(new CustomEvent("apoya:rt:cobrancas"));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "obrigacoes" }, () => {
      window.dispatchEvent(new CustomEvent("apoya:rt:obrigacoes"));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "wa_instance" }, () => {
      window.dispatchEvent(new CustomEvent("apoya:rt:wa_instance"));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversa" }, () => {
      window.dispatchEvent(new CustomEvent("apoya:rt:wa_conversa"));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "mensagem_whatsapp" }, () => {
      window.dispatchEvent(new CustomEvent("apoya:rt:mensagem_whatsapp"));
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Realtime] Master channel connected ✓");
      }
      if (status === "CHANNEL_ERROR") {
        console.error("[Realtime] Master channel error — retrying...");
        initialized = false; // permite reinicializar
      }
    });
}

/**
 * Hook helper: escuta eventos de realtime para uma tabela específica.
 * Usa useEffect internamente — deve ser chamado dentro de um componente React.
 */
import { useEffect } from "react";

export function useRealtimeTable(table: TableName, callback: () => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const event = `apoya:rt:${table}`;
    window.addEventListener(event, callback);
    return () => window.removeEventListener(event, callback);
  }, [table, callback]);
}
