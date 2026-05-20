import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { PageHeader, PlaceholderBlock } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/fiscal/nfse")({
  component: () => (
    <div className="space-y-6">
      <PageHeader title="NFS-e em Lote" subtitle="Emissão via NFE.io com CBS/IBS 2026" />
      <PlaceholderBlock
        icon={Receipt}
        title="NFS-e em Lote"
        description="Emissão para todos os clientes (exceto MEI isento de CBS/IBS), download XML/PDF e envio automático via WhatsApp."
        module="Módulo M4"
      />
    </div>
  ),
  head: () => ({ meta: [{ title: "NFS-e em Lote · APOYA Gestão" }] }),
});
