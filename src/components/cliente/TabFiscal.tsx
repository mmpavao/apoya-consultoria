/**
 * TabFiscal — Aba Fiscal do cliente (refatorada)
 *
 * Sub-abas:
 *   Resumo Fiscal  → dados fixos + status PGDAS/DAS/DTE (auto-fetch SERPRO)
 *   NF Emitidas    → notas emitidas pela empresa (Focus NF-e)
 *   NF Recebidas   → notas recebidas pela empresa
 *   Emitir NFS-e   → formulário de emissão
 *   Consultas      → acesso completo ao MCP SERPRO
 *
 * Filosofia: dados fixos já preenchidos, JSON nunca exposto ao usuário.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { fmtBRL, fmtDate } from "@/lib/format";
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Download, FileCode2, FileText, Hash, Info, Loader2,
  MapPin, Plus, Receipt, ReceiptText, RefreshCw, Search,
  Send, ShieldCheck, Users, XCircle, Zap, Building2, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useObrigacoes } from "@/hooks/use-obrigacoes";
import { DocumentosFiscaisTab } from "@/components/motor/DocumentosFiscaisTab";
import { ApuracaoMensalCard } from "@/components/motor/ApuracaoMensalCard";
import { REGIME_LABEL, type Cliente } from "@/hooks/use-clientes";

// ── helpers ────────────────────────────────────────────────────────────────

function downloadBlob(b64: string, filename: string, mime: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── sub-tipos de tab ───────────────────────────────────────────────────────
type FiscalTab = "resumo" | "docs" | "apuracao";

const SUB_TABS: { id: FiscalTab; label: string }[] = [
  { id: "resumo",   label: "Resumo Fiscal" },
  { id: "docs",     label: "Doc. Fiscais" },
  { id: "apuracao", label: "Apuração" },
];

// ── badge inline ───────────────────────────────────────────────────────────
function Pill({ cor, children }: { cor: "green"|"red"|"amber"|"gray"|"blue"; children: React.ReactNode }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red:   "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    gray:  "bg-slate-50 text-slate-500 border-slate-200",
    blue:  "bg-blue-50 text-blue-700 border-blue-200",
  }[cor];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}

// ── linha de dado ──────────────────────────────────────────────────────────
function DataRow({ label, value, loading }: { label: string; value?: string | null; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {loading
        ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        : <span className="text-sm font-medium text-foreground text-right">{value || "—"}</span>
      }
    </div>
  );
}

// ── card de seção ──────────────────────────────────────────────────────────
function FiscalCard({ title, icon: Icon, children, expandable, defaultOpen }: {
  title: string; icon: any; children: React.ReactNode;
  expandable?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? !expandable);
  return (
    <div className="surface-card overflow-hidden">
      <button
        className={`w-full flex items-center justify-between px-4 py-3 text-left ${expandable ? "hover:bg-muted/30 transition-colors" : ""}`}
        onClick={expandable ? () => setOpen(o => !o) : undefined}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {expandable && (open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── status item (PGDAS, DTE, etc.) ─────────────────────────────────────────
function StatusItem({ label, ok, detail, loading }: {
  label: string; ok: boolean | null; detail?: string; loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {detail && <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>}
      </div>
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : ok === null
          ? <Pill cor="gray">Verificando…</Pill>
          : ok
            ? <Pill cor="green">✓ Em dia</Pill>
            : <Pill cor="red">Pendente</Pill>
      }
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RESUMO FISCAL (auto-fetch SERPRO)
// ────────────────────────────────────────────────────────────────────────────
function ResumoFiscal({ cliente }: { cliente: Cliente & { tem_certificado?: boolean; tem_procuracao?: boolean } }) {
  const { obrigacoes } = useObrigacoes();
  const cnpj = (cliente.cnpj ?? "").replace(/\D/g, "");
  const regime = (cliente.regime ?? "").toUpperCase()
    .replace("SIMPLES NACIONAL", "SIMPLES")
    .replace("SIMPLES", "SIMPLES");

  const isMEI     = regime === "MEI";
  const isSimples = regime.includes("SIMPLES");


  const obgCliente = obrigacoes.filter(o => o.clienteId === cliente.id);
  const obgAtrasada = obgCliente.filter(o => o.status === "atrasada").length;
  const obgPendente = obgCliente.filter(o => o.status === "pendente").length;


  return (
    <div className="space-y-4">
      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Regime",      value: cliente.regime ? (REGIME_LABEL[cliente.regime] ?? cliente.regime) : "—" },
          { label: "CNPJ",        value: cliente.cnpj || "—" },
          { label: "Venc. DAS",   value: "Todo dia 20" },
          { label: "Obrigações",  value: obgAtrasada > 0 ? `${obgAtrasada} atrasada${obgAtrasada>1?"s":""}` : obgPendente > 0 ? `${obgPendente} pendente${obgPendente>1?"s":""}` : "Em dia" },
        ].map(k => (
          <div key={k.label} className="surface-card px-4 py-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-sm font-semibold text-foreground truncate">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status de obrigações (manual) */}
        <FiscalCard title="Status de Obrigações" icon={ShieldCheck} defaultOpen>
          <StatusItem
            label="Obrigações na APOYA"
            ok={obgAtrasada === 0}
            detail={obgAtrasada > 0 ? `${obgAtrasada} em atraso` : obgPendente > 0 ? `${obgPendente} pendentes` : "Todas em dia"}
          />
        </FiscalCard>

        {/* Dados fiscais fixos */}
        <FiscalCard title="Configuração Fiscal" icon={FileText} defaultOpen>
          <DataRow label="Tipo DAS"       value={isMEI ? "DASMEI (Carnê MEI)" : isSimples ? "DAS — Simples Nacional" : "—"} />
          <DataRow label="Regime Híbrido" value={cliente.regimeHibrido ? "Sim — alíquotas separadas" : "Não"} />
          <DataRow label="Município"      value={cliente.municipio ?? cliente.endereco?.municipio} />
          <DataRow label="Cód. Serviço NFS-e" value={cliente.codigoServicoNfse} />
          <DataRow label="Insc. Municipal" value={cliente.inscricaoMunicipal} />
          <DataRow label="Alíquota ISS"  value={cliente.aliquotaIss ? `${cliente.aliquotaIss}%` : undefined} />
          <DataRow label="Incentivo Fiscal" value={cliente.temIncentivoFiscal ? "Sim — redução de alíquota" : "Não"} />
        </FiscalCard>

        {/* eSocial */}
        <FiscalCard title="eSocial / Folha" icon={Users} defaultOpen>
          <DataRow label="Tem Empregados" value={cliente.temEmpregados ? "Sim — sujeito ao eSocial" : "Não"} />
          {cliente.temEmpregados && <>
            <DataRow label="DCTFWeb"         value="Mensal — até dia 15" />
            <DataRow label="EFD-Contribuições" value="Mensal — até o 2º dia útil do 2º mês seguinte" />
          </>}
        </FiscalCard>

        {/* Obrigações deste cliente (expandível) */}
        {obgCliente.length > 0 && (
          <FiscalCard title={`Obrigações (${obgCliente.length})`} icon={Clock} expandable defaultOpen={obgAtrasada > 0}>
            <div className="divide-y divide-border/40">
              {obgCliente.map(o => (
                <div key={o.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{o.tipo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.competencia} · Venc. {fmtDate(o.vencimento)}
                    </p>
                  </div>
                  <Pill cor={o.status === "concluida" ? "green" : o.status === "atrasada" ? "red" : o.status === "em_andamento" ? "blue" : "amber"}>
                    {o.status === "concluida" ? "Concluída" : o.status === "atrasada" ? "Atrasada" : o.status === "em_andamento" ? "Em andamento" : "Pendente"}
                  </Pill>
                </div>
              ))}
            </div>
          </FiscalCard>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// NF EMITIDAS
// ────────────────────────────────────────────────────────────────────────────
export function TabFiscal({ cliente }: { cliente: Cliente & { tem_certificado?: boolean; tem_procuracao?: boolean; cnpj?: string; regime?: string } }) {
  const [sub, setSub] = useState<FiscalTab>("resumo");
  const [modalNfse, setModalNfse] = useState(false);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-0.5 border-b border-border/60 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              sub === t.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "resumo"    && <ResumoFiscal   cliente={cliente} />}

      {sub === "docs" && (
        <DocumentosFiscaisTab
          clienteId={cliente.id}
          clienteCnpj={cliente.cnpj ?? ""}
        />
      )}

      {sub === "apuracao" && (
        <ApuracaoMensalCard
          clienteId={cliente.id}
          regime={cliente.regime ?? "Simples"}
        />
      )}
    </div>
  );
}
