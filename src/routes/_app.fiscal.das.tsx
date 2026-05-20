import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PageHeader, PlaceholderBlock } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/fiscal/das")({
  component: () => (
    <div className="space-y-6">
      <PageHeader title="DAS em Lote" subtitle="Geração e envio em massa via SERPRO + WhatsApp" />
      <PlaceholderBlock
        icon={FileText}
        title="DAS em Lote"
        description="Lista de clientes Simples + MEI, geração via gateway SERPRO, salvamento no Storage e envio em massa por WhatsApp."
        module="Módulo M3"
      />
    </div>
  ),
  head: () => ({ meta: [{ title: "DAS em Lote · APOYA Gestão" }] }),
});
