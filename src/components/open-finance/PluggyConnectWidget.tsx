/**
 * PluggyConnectWidget — componente frontend para conexão Open Finance via Pluggy Connect
 *
 * Uso:
 *   <PluggyConnectWidget
 *     clienteId="uuid-do-cliente"   // opcional — vincula a conexão ao cliente no Supabase
 *     onSuccess={(itemId) => ...}   // callback com o item_id após conexão bem-sucedida
 *     onClose={() => ...}           // callback ao fechar/cancelar
 *   />
 *
 * Fluxo:
 *   1. Componente chama /api/pluggy/connect-token (backend) com o JWT do usuário logado
 *   2. Backend autentica na Pluggy e retorna um accessToken temporário
 *   3. Widget PluggyConnect abre com esse token
 *   4. Cliente escolhe banco, autentica e autoriza
 *   5. onSuccess recebe o item_id → salvar no Supabase
 */
import { useState, useEffect } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** ID da empresa no Supabase — usado como clientUserId na Pluggy para rastreamento */
  clienteId?: string;
  /** Chamado com o item_id após a conexão bem-sucedida */
  onSuccess?: (itemId: string, itemData: unknown) => void;
  /** Chamado ao fechar o widget (sucesso ou cancelamento) */
  onClose?: () => void;
  /** Ativar modo sandbox da Pluggy (usar apenas em desenvolvimento) */
  sandbox?: boolean;
};

export function PluggyConnectWidget({
  clienteId,
  onSuccess,
  onClose,
  sandbox = false,
}: Props) {
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    async function fetchConnectToken() {
      try {
        setLoading(true);
        setError(null);

        // Pegar JWT do usuário logado
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError("Usuário não autenticado.");
          return;
        }

        // Chamar o backend para gerar o Connect Token
        const res = await fetch("/api/pluggy/connect-token", {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            clientUserId: clienteId ?? session.user.id,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Erro HTTP ${res.status}`);
        }

        const { accessToken } = await res.json();
        setConnectToken(accessToken);
      } catch (e: any) {
        console.error("[Pluggy] fetchConnectToken error:", e);
        setError(e.message ?? "Erro ao conectar com Open Finance.");
      } finally {
        setLoading(false);
      }
    }

    fetchConnectToken();
  }, [clienteId]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm">Preparando conexão bancária…</span>
      </div>
    );
  }

  // ── Erro ─────────────────────────────────────────────────────────────────
  if (error || !connectToken) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-destructive">
        <WifiOff className="h-8 w-8" />
        <span className="text-sm text-center max-w-xs">
          {error ?? "Não foi possível iniciar a conexão. Tente novamente."}
        </span>
      </div>
    );
  }

  // ── Widget Pluggy Connect ─────────────────────────────────────────────────
  return (
    <PluggyConnect
      connectToken={connectToken}
      includeSandbox={sandbox}
      onSuccess={(itemData: any) => {
        const itemId = itemData?.item?.id;
        toast.success("Banco conectado com sucesso!");
        onSuccess?.(itemId, itemData);
        onClose?.();
      }}
      onError={(err: any) => {
        console.error("[Pluggy] widget error:", err);
        toast.error("Erro ao conectar banco. Tente novamente.");
      }}
      onClose={() => {
        onClose?.();
      }}
    />
  );
}
