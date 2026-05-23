/**
 * SerproResultRenderer — Renderiza resultados do SERPRO de forma amigável
 * Substitui o <pre>{JSON}</pre> por cards visuais com campos traduzidos
 */
import { AlertCircle, CheckCircle2, FileText, Download, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Mapeamento de campos técnicos → rótulos humanos ────────────────────────
const FIELD_LABELS: Record<string, string> = {
  // CNPJ / MEI
  cnpj: "CNPJ",
  razao_social: "Razão Social",
  nome_empresarial: "Nome Empresarial",
  nome_fantasia: "Nome Fantasia",
  situacao_cadastral: "Situação Cadastral",
  data_situacao_cadastral: "Data da Situação",
  motivo_situacao_cadastral: "Motivo",
  data_abertura: "Data de Abertura",
  natureza_juridica: "Natureza Jurídica",
  porte: "Porte",
  capital_social: "Capital Social",
  atividade_principal: "Atividade Principal",
  municipio: "Município",
  uf: "UF",
  cep: "CEP",
  telefone: "Telefone",
  email: "E-mail",
  // DAS / PGMEI
  codigo_barras: "Código de Barras",
  valor: "Valor",
  valor_principal: "Valor Principal",
  valor_multa: "Valor Multa",
  valor_juros: "Valor Juros",
  competencia: "Competência",
  vencimento: "Vencimento",
  periodo_apuracao: "Período",
  // PGDAS
  receita_bruta: "Receita Bruta",
  aliquota: "Alíquota",
  valor_devido: "Valor Devido",
  data_transmissao: "Data Transmissão",
  situacao: "Situação",
  numero_recibo: "Nº Recibo",
  // Regime
  regime: "Regime Tributário",
  ano: "Ano",
  // DTE
  situacao_dte: "Situação DTE",
  data_adesao: "Data de Adesão",
  // Genérico
  codigo: "Código",
  descricao: "Descrição",
  texto: "Mensagem",
  message: "Mensagem",
  data: "Data",
  status: "Status",
  resultado: "Resultado",
};

// ── Formatadores de valores ────────────────────────────────────────────────
function formatValue(key: string, val: unknown): string {
  if (val == null || val === "") return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Não";

  const str = String(val);

  // Datas ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    try {
      return new Date(str + "T12:00:00").toLocaleDateString("pt-BR");
    } catch { return str; }
  }

  // Valores monetários
  if (key.includes("valor") || key.includes("capital")) {
    const num = Number(str.replace(",", "."));
    if (!isNaN(num)) {
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
  }

  // Alíquotas
  if (key.includes("aliquota")) {
    const num = Number(str);
    if (!isNaN(num)) return `${(num * 100).toFixed(2)}%`;
  }

  return str;
}

// ── Renderizador recursivo de objetos ──────────────────────────────────────
function renderObject(data: Record<string, unknown>, depth = 0): React.ReactNode {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");

  if (entries.length === 0) return <p className="text-xs text-muted-foreground italic">Sem dados</p>;

  return (
    <div className={depth > 0 ? "ml-3 border-l-2 border-border/30 pl-3 mt-1" : ""}>
      {entries.map(([key, val]) => {
        const label = FIELD_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

        // Objeto aninhado
        if (val && typeof val === "object" && !Array.isArray(val)) {
          return (
            <div key={key} className="mt-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
              {renderObject(val as Record<string, unknown>, depth + 1)}
            </div>
          );
        }

        // Array
        if (Array.isArray(val)) {
          if (val.length === 0) return null;
          return (
            <div key={key} className="mt-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label} ({val.length})</p>
              {val.slice(0, 5).map((item, i) => (
                <div key={i} className="ml-2 mb-1 text-xs">
                  {typeof item === "object" && item
                    ? renderObject(item as Record<string, unknown>, depth + 1)
                    : <span className="text-foreground/80">{String(item)}</span>}
                </div>
              ))}
              {val.length > 5 && <p className="text-[10px] text-muted-foreground ml-2">+ {val.length - 5} itens</p>}
            </div>
          );
        }

        // Código de barras — destacar
        if (key === "codigo_barras" || (key === "codigo" && String(val).length > 20)) {
          return (
            <div key={key} className="mt-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
              <code className="block text-[11px] font-mono bg-muted/50 rounded px-2 py-1 break-all">
                {String(val)}
              </code>
            </div>
          );
        }

        // Campo simples
        return (
          <div key={key} className="flex items-start justify-between gap-3 py-1 border-b border-border/30 last:border-0">
            <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
            <span className="text-[11px] font-medium text-foreground text-right">{formatValue(key, val)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
interface Props {
  text:     string | null;
  pdfB64?:  string | null;
  ms?:      number | null;
  onPdf?:   () => void;
}

export function SerproResultRenderer({ text, pdfB64, ms, onPdf }: Props) {
  if (!text) return null;

  let parsed: unknown = null;
  let isJson = false;

  try {
    parsed = JSON.parse(text);
    isJson = true;
  } catch {
    // texto plano
  }

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      {pdfB64 && onPdf && (
        <Button size="sm" variant="outline" className="mb-2 h-6 text-[11px] gap-1" onClick={onPdf}>
          <Download className="h-3 w-3" /> Baixar PDF
        </Button>
      )}

      {isJson && parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? renderObject(parsed as Record<string, unknown>)
        : isJson && Array.isArray(parsed) && parsed.length > 0
        ? (
          <div>
            {(parsed as unknown[]).map((item, i) => (
              <div key={i} className="mb-2 border-b border-border/30 pb-2 last:border-0">
                {typeof item === "object" && item
                  ? renderObject(item as Record<string, unknown>)
                  : <span className="text-xs text-foreground/80">{String(item)}</span>}
              </div>
            ))}
          </div>
        )
        : (
          <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{text}</p>
        )
      }

      {ms != null && (
        <div className="mt-2 flex items-center gap-1 justify-end">
          <Clock className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">{ms}ms</span>
        </div>
      )}
    </div>
  );
}
