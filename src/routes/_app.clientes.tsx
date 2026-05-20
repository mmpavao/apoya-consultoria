import { createFileRoute } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PlaceholderBlock } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/clientes")({
  component: () => (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="75 ativos · cadastro com busca na Receita Federal"
        actions={<Button className="rounded-xl"><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button>}
      />
      <PlaceholderBlock
        icon={Building2}
        title="Cadastro de Clientes"
        description="Tabela com busca, filtros por regime/status/responsável, badges de regime tributário e formulário com autopreenchimento via CNPJ."
        module="Módulo M1"
      />
    </div>
  ),
  head: () => ({ meta: [{ title: "Clientes · APOYA Gestão" }] }),
});
