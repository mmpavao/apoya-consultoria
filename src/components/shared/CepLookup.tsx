/**
 * CepLookup — Campo CEP com preenchimento automático de endereço via Focus NF-e
 */
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useBuscarCep, type FocusCep } from "@/hooks/use-focus-apis";

interface CepLookupProps {
  value?: string;
  onChange?: (cep: string, dados: FocusCep | null) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

function formatCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function CepLookup({
  value = "",
  onChange,
  label = "CEP",
  disabled = false,
  className,
}: CepLookupProps) {
  const [raw, setRaw] = useState(value.replace(/\D/g, ""));
  const { data: end, loading, error } = useBuscarCep(raw);

  useEffect(() => {
    if (raw.length === 8) onChange?.(raw, end ?? null);
  }, [end]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    setRaw(digits);
    if (digits.length < 8) onChange?.(digits, null);
  }

  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Input
          value={formatCep(raw)}
          onChange={handleChange}
          placeholder="00000-000"
          disabled={disabled}
          className="pr-10"
          maxLength={9}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!loading && end && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        </div>
      </div>
      {end && (
        <p className="text-xs text-muted-foreground">
          {[end.tipo_logradouro, end.nome_logradouro, end.bairro, end.nome_localidade, end.uf]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}
      {error && raw.length === 8 && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default CepLookup;
