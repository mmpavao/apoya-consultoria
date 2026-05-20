import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { PageHeader, PlaceholderBlock } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/fiscal/serpro")({
  component: () => (
    <div className="space-y-6">
      <PageHeader title="SERPRO" subtitle="Status do gateway serpro.apoya.com.br:4010" />
      <PlaceholderBlock
        icon={Shield}
        title="SERPRO Gateway"
        description="Monitoramento da VPS, certificados digitais e consultas diretas ao SERPRO."
        module="Módulo M3"
      />
    </div>
  ),
  head: () => ({ meta: [{ title: "SERPRO · APOYA Gestão" }] }),
});
