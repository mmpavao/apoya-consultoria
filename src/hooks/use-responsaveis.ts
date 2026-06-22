/**
 * Lista de responsáveis humanos para tarefas/workflows (modo manual).
 */
import { useMemo } from "react";
import { useUsuarios } from "@/hooks/use-usuarios";

export interface Responsavel {
  nome: string;
  tipo: "humano";
}

export function useResponsaveis() {
  const { usuarios, loading } = useUsuarios();

  const responsaveis = useMemo<Responsavel[]>(
    () =>
      usuarios.map((u) => ({
        nome: u.nome?.trim() || u.email,
        tipo: "humano" as const,
      })),
    [usuarios],
  );

  return { responsaveis, loading };
}
