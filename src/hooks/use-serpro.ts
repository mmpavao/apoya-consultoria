/**
 * Hook useSerpro — proxy para /api/serpro/call
 * Permite chamar qualquer tool do MCP SERPRO com validação de elegibilidade.
 */
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

export type SerproCallResult = {
  ok: boolean;
  content?: Array<{ type: string; text?: string }>;
  duracao_ms?: number;
  error?: string;
  blocked?: boolean;
};

export function useSerpro() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [loading, setLoading] = useState(false);

  const call = useCallback(
    async (
      tool: string,
      params: Record<string, unknown> = {},
      clienteId?: string,
    ): Promise<SerproCallResult> => {
      if (!token) return { ok: false, error: "Não autenticado" };
      setLoading(true);
      try {
        const res = await fetch("/api/serpro/call", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tool, params, cliente_id: clienteId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data?.error ?? `HTTP ${res.status}`, blocked: data?.blocked };
        return { ok: true, ...data };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? "Erro de rede" };
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  /** Extrai texto simples do resultado */
  function extractText(result: SerproCallResult): string {
    if (!result.ok) return result.error ?? "Erro desconhecido";
    const texts = (result.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "");
    if (texts.length === 0) return "Sem dados";
    try {
      // O MCP retorna: {"ok": true, "result": <dados reais>}
      // Desembrulhar para exibir só os dados reais
      const outer = JSON.parse(texts.join(""));
      // Se o result do MCP falhou, mostrar o erro
      if (outer?.ok === false) {
        return "⚠️ " + (outer?.error ?? "Acesso negado pelo SERPRO");
      }
      // Desembrulhar result
      const inner = outer?.result ?? outer;
      if (typeof inner === "string" && inner.trim() === "") return "Sem dados retornados";
      if (typeof inner === "string") return inner;
      return JSON.stringify(inner, null, 2);
    } catch {
      return texts.join("\n");
    }
  }

  /** Extrai base64 de PDF do resultado */
  function extractPdf(result: SerproCallResult): string | null {
    if (!result.ok) return null;
    const texts = (result.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "");
    const combined = texts.join("");
    try {
      const outer = JSON.parse(combined);
      const inner = outer?.result ?? outer;
      return inner?.pdf ?? inner?.base64 ?? outer?.result?.pdf ?? null;
    } catch {
      return null;
    }
  }

  return { call, loading, extractText, extractPdf };
}
