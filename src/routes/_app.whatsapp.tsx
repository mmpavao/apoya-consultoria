import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { PageHeader, PlaceholderBlock } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/whatsapp")({
  component: () => (
    <div className="space-y-6">
      <PageHeader title="WhatsApp" subtitle="Conversas via Evolution API" />
      <PlaceholderBlock
        icon={MessageSquare}
        title="Central de WhatsApp"
        description="Lista de conversas com filtros, histórico de mensagens automáticas/manuais, envio de arquivos (DAS, NFS-e, boletos)."
        module="Módulo M6"
      />
    </div>
  ),
  head: () => ({ meta: [{ title: "WhatsApp · APOYA Gestão" }] }),
});
