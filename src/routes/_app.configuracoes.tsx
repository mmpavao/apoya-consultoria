import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PageHeader, PlaceholderBlock } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/configuracoes")({
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Usuários, integrações e dados do escritório" />
      <PlaceholderBlock
        icon={Settings}
        title="Configurações"
        description="Gestão de usuários (admin/fiscal/financeiro/DP), chaves de API (Asaas, NFE.io, Evolution), templates de WhatsApp."
        module="Módulo M7"
      />
    </div>
  ),
  head: () => ({ meta: [{ title: "Configurações · APOYA Gestão" }] }),
});
