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
      // Tentar parsear JSON para exibição bonita
      const parsed = JSON.parse(texts.join(""));
      return JSON.stringify(parsed, null, 2);
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
      const parsed = JSON.parse(combined);
      return parsed?.pdf ?? parsed?.base64 ?? parsed?.result?.pdf ?? null;
    } catch {
      return null;
    }
  }

  return { call, loading, extractText, extractPdf };
}
