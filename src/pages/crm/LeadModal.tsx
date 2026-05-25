import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Separator }from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone, Mail, Building2, MapPin, TrendingUp,
  Calendar, Edit3, Trash2, CheckCircle2, XCircle,
  MessageSquare, ArrowRight,
} from "lucide-react";
import {
  Lead, LeadEtapa, ETAPA_LABEL, ETAPA_COR, TEMP_LABEL, TEMP_COR,
  CANAL_LABEL, FUNIL_COLS, useLeadsCrm,
} from "@/hooks/use-leads-crm";
import { NovoLeadForm } from "./NovoLeadForm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onRefresh: () => void;
}

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export function LeadModal({ lead, onClose, onRefresh }: LeadModalProps) {
  const { atualizarLead, moverEtapa, deletarLead } = useLeadsCrm();
  const [editando, setEditando] = useState(false);
  const [novaObs,  setNovaObs]  = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!lead) return null;

  const handleEtapa = async (etapa: LeadEtapa) => {
    try {
      await moverEtapa(lead.id, etapa);
      toast.success(`Lead movido para "${ETAPA_LABEL[etapa]}"`);
      onRefresh();
    } catch { toast.error("Erro ao mover etapa"); }
  };

  const handleObs = async () => {
    if (!novaObs.trim()) return;
    setSalvando(true);
    try {
      const obs = lead.observacoes
        ? `${lead.observacoes}\n\n[${new Date().toLocaleDateString("pt-BR")}] ${novaObs}`
        : `[${new Date().toLocaleDateString("pt-BR")}] ${novaObs}`;
      await atualizarLead(lead.id, { observacoes: obs, ultimo_contato: new Date().toISOString().slice(0, 10) });
      setNovaObs("");
      toast.success("Observação salva");
      onRefresh();
    } catch { toast.error("Erro ao salvar"); }
    finally { setSalvando(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Deletar lead "${lead.nome}"?`)) return;
    try {
      await deletarLead(lead.id);
      toast.success("Lead removido");
      onClose();
      onRefresh();
    } catch { toast.error("Erro ao deletar"); }
  };

  if (editando) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lead — {lead.nome}</DialogTitle>
        </DialogHeader>
        <NovoLeadForm
          leadInicial={lead}
          onSave={() => { setEditando(false); onRefresh(); }}
          onCancel={() => setEditando(false)}
        />
      </DialogContent>
    </Dialog>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold truncate">{lead.nome}</DialogTitle>
              {lead.razao_social && (
                <p className="text-sm text-muted-foreground mt-0.5">{lead.razao_social}</p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", ETAPA_COR[lead.etapa])}>
              {ETAPA_LABEL[lead.etapa]}
            </span>
            <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", TEMP_COR[lead.temperatura])}>
              {TEMP_LABEL[lead.temperatura]}
            </span>
            <Badge variant="secondary">{CANAL_LABEL[lead.canal] ?? lead.canal}</Badge>
            {lead.regime_tributario && <Badge variant="outline">{lead.regime_tributario}</Badge>}
          </div>
        </DialogHeader>

        <Separator />

        {/* Dados de contato */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{lead.telefone}</span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.cnpj && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{lead.cnpj}</span>
            </div>
          )}
          {(lead.municipio || lead.uf) && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{[lead.municipio, lead.uf].filter(Boolean).join(" / ")}</span>
            </div>
          )}
          {lead.responsavel && (
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{lead.responsavel}</span>
            </div>
          )}
          {lead.honorario_proposto && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-emerald-600">
                R$ {lead.honorario_proposto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {lead.ultimo_contato && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Último contato: {fmt(lead.ultimo_contato)}</span>
            </div>
          )}
        </div>

        {/* Próximo passo */}
        {lead.proximo_passo && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-800 flex items-center gap-1.5 mb-1">
              <ArrowRight className="h-3.5 w-3.5" /> Próximo passo
            </p>
            <p className="text-amber-700">{lead.proximo_passo}</p>
          </div>
        )}

        <Separator />

        {/* Mover etapa */}
        <div>
          <p className="text-sm font-medium mb-2">Mover para etapa</p>
          <div className="flex flex-wrap gap-2">
            {FUNIL_COLS.map(col => (
              <button
                key={col.etapa}
                onClick={() => handleEtapa(col.etapa)}
                disabled={col.etapa === lead.etapa}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-all border",
                  col.etapa === lead.etapa
                    ? "opacity-40 cursor-not-allowed bg-muted"
                    : "hover:scale-105 cursor-pointer bg-white hover:bg-muted"
                )}
              >
                {ETAPA_LABEL[col.etapa]}
              </button>
            ))}
          </div>
        </div>

        {/* Observações */}
        {lead.observacoes && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1 text-muted-foreground">Histórico de observações</p>
            <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed text-xs">
              {lead.observacoes}
            </pre>
          </div>
        )}

        {/* Adicionar observação */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Nova observação / registro de contato</p>
          <Textarea
            placeholder="O que aconteceu neste contato? Acordos, dúvidas, pendências..."
            value={novaObs}
            onChange={e => setNovaObs(e.target.value)}
            rows={3}
          />
          <Button size="sm" onClick={handleObs} disabled={!novaObs.trim() || salvando}>
            {salvando ? "Salvando..." : "Salvar observação"}
          </Button>
        </div>

        <Separator />

        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Criado em: {fmt(lead.created_at)}</span>
          <span>Atualizado: {fmt(lead.updated_at)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
