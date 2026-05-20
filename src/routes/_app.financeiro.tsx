import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { PageHeader, PlaceholderBlock } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/financeiro")({
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle="Cobranças Asaas e régua de inadimplência" />
      <PlaceholderBlock
        icon={DollarSign}
        title="Cobranças e Inadimplência"
        description="Integração Asaas (PIX/boleto/débito), régua automática 7/15/30/45 dias e suspensão automática."
        module="Módulo M5"
      />
    </div>
  ),
  head: () => ({ meta: [{ title: "Financeiro · APOYA Gestão" }] }),
});
