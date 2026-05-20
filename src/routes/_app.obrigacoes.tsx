import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { PageHeader, PlaceholderBlock } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/obrigacoes")({
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Obrigações" subtitle="Calendário fiscal por regime tributário" />
      <PlaceholderBlock
        icon={Calendar}
        title="Calendário de Obrigações"
        description="Geração automática por regime (MEI, Simples, Lucro Presumido, Doméstica) com alertas de multa e DIRBI 2026."
        module="Módulo M2"
      />
    </div>
  ),
  head: () => ({ meta: [{ title: "Obrigações · APOYA Gestão" }] }),
});
