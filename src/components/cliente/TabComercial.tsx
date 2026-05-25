/**
 * TabComercial — Serviços + Contratos + Financeiro em sub-abas unificadas
 * Substitui as 3 abas isoladas por uma única feature inteligente
 */
import { useState } from "react";
import { Package, FileSignature, DollarSign } from "lucide-react";
import { TabServicos }   from "./TabServicos";
import { TabContratos }  from "./TabContratos";
import { TabFinanceiro } from "./TabFinanceiro";
import type { Cliente } from "@/hooks/use-clientes";

type SubTab = "servicos" | "contratos" | "financeiro";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "servicos",   label: "Serviços",   icon: Package,       desc: "Serviços contratados e mensalidades" },
  { id: "contratos",  label: "Contratos",  icon: FileSignature, desc: "Documentos, assinaturas e aditivos" },
  { id: "financeiro", label: "Financeiro", icon: DollarSign,    desc: "Cobranças, honorários e pagamentos" },
];

interface Props {
  cliente: Cliente;
}

export function TabComercial({ cliente }: Props) {
  const [sub, setSub] = useState<SubTab>("servicos");
  const active = SUB_TABS.find(t => t.id === sub)!;

  return (
    <div className="space-y-4">
      {/* Sub-nav inline — estilo pill */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/40 w-fit">
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          const isActive = sub === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-background text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Descrição contextual */}
      <p className="text-xs text-muted-foreground pl-1">{active.desc}</p>

      {/* Conteúdo da sub-aba */}
      {sub === "servicos"   && <TabServicos   clienteId={cliente.id} />}
      {sub === "contratos"  && (
        <TabContratos
          clienteId={cliente.id}
          clienteEmail={cliente.email}
          clienteWhatsapp={cliente.whatsapp}
          clienteNome={cliente.razaoSocial}
        />
      )}
      {sub === "financeiro" && <TabFinanceiro cliente={cliente} />}
    </div>
  );
}

export default TabComercial;
