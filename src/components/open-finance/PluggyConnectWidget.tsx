/**
 * PluggyConnectWidget — componente frontend para conexão Open Finance via Pluggy Connect
 *
 * Uso:
 *   <PluggyConnectWidget
 *     clienteId="uuid-do-cliente"
 *     onSuccess={(itemId) => ...}
 *     onClose={() => ...}
 *   />
 *
 * Fluxo:
 *   1. Chama POST /api/pluggy/connect-token para obter o accessToken server-side
 *   2. Abre o widget Pluggy Connect com o token
 *   3. Após o usuário autorizar o banco, chama onSuccess(itemId)
 *   4. O webhook /api/webhooks/pluggy sincroniza os dados automaticamente
 */
import React, { useEffect, useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import { Loader2 } from "lucide-react";

interface PluggyConnectWidgetProps {
  clienteId?: string;
  onSuccess?: (itemId: string) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export function PluggyConnectWidget({
  clienteId,
  onSuccess,
  onClose,
  onError,
}: PluggyConnectWidgetProps) {
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      try {
        const res = await fetch("/api/pluggy/connect-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientUserId: clienteId }),
          credentials: "include",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as any)?.error ?? `HTTP ${res.status}`);
        }

        const { accessToken } = await res.json() as { accessToken: string };
        if (!cancelled) {
          setConnectToken(accessToken);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? "Erro ao conectar");
          setLoading(false);
          onError?.(err);
        }
      }
    }

    fetchToken();
    return () => { cancelled = true; };
  }, [clienteId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Preparando conexão segura...</p>
      </div>
    );
  }

  if (error || !connectToken) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="text-sm text-destructive">Não foi possível iniciar a conexão.</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <PluggyConnect
      connectToken={connectToken}
      onSuccess={(itemData: any) => {
        const itemId = itemData?.item?.id ?? itemData?.id ?? "";
        onSuccess?.(itemId);
      }}
      onError={(err: any) => {
        onError?.(new Error(err?.message ?? "Erro no widget Pluggy"));
      }}
      onClose={() => onClose?.()}
    />
  );
}
