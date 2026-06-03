/**
 * CnpjLookup — Campo de CNPJ com lookup automático via Focus NF-e
 * Quando o CNPJ atinge 14 dígitos consulta a Focus NF-e e retorna os dados.
 */
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import { useBuscarCnpj, type FocusCnpj } from "@/hooks/use-focus-apis";

interface CnpjLookupProps {
  value?: string;
  onChange?: (cnpj: string, dados: FocusCnpj | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFill?: boolean;
  className?: string;
}

function formatCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function statusVariant(status?: string) {
  if (status === "ativa") return "default";
  if (status === "suspensa") return "outline";
  return "destructive";
}

export function CnpjLookup({
  value = "",
  onChange,
  label = "CNPJ",
  placeholder = "00.000.000/0000-00",
  disabled = false,
  autoFill = true,
  className,
}: CnpjLookupProps) {
  const [raw, setRaw] = useState(value.replace(/\D/g, ""));
  const { data: empresa, loading, error } = useBuscarCnpj(raw);

  useEffect(() => {
    if (raw.length === 14) {
      onChange?.(raw, empresa ?? null);
    }
  }, [empresa]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 14);
    setRaw(digits);
    if (digits.length < 14) onChange?.(digits, null);
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Input
          value={formatCnpj(raw)}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
          maxLength={18}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!loading && empresa && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {!loading && error && raw.length === 14 && <AlertCircle className="h-4 w-4 text-red-500" />}
        </div>
      </div>
      {autoFill && empresa && (
        <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            {empresa.razao_social}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariant(empresa.situacao_cadastral) as any} className="text-xs">
              {empresa.situacao_cadastral?.toUpperCase() ?? "—"}
            </Badge>
            {empresa.optante_simples_nacional && <Badge variant="outline" className="text-xs">Simples Nacional</Badge>}
            {empresa.optante_mei && <Badge variant="outline" className="text-xs">MEI</Badge>}
          </div>
          {empresa.endereco && (
            <p className="text-xs text-muted-foreground">
              {empresa.endereco.nome_municipio} — {empresa.endereco.uf} | CEP {empresa.endereco.cep}
            </p>
          )}
        </div>
      )}
      {error && raw.length === 14 && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default CnpjLookup;
