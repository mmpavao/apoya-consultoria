import type { Cliente } from "@/hooks/use-clientes";
import type { Escritorio } from "@/hooks/use-escritorio";

export interface ContratoPlaceholderContext {
  cliente: Pick<
    Cliente,
    | "razaoSocial"
    | "nomeFantasia"
    | "cnpj"
    | "cpf"
    | "endereco"
    | "municipio"
    | "uf"
    | "valorHonorario"
    | "diaVencimento"
  >;
  escritorio: Pick<Escritorio, "razaoSocial" | "cnpj" | "diaCobranca">;
  valorTotal?: number;
  dataInicio?: string;
}

function fmtEndereco(
  endereco?: Cliente["endereco"],
  municipio?: string,
  uf?: string,
): string {
  const parts = [
    endereco?.logradouro,
    endereco?.numero,
    endereco?.complemento,
    endereco?.bairro,
    municipio ?? endereco?.municipio,
    uf ?? endereco?.uf,
    endereco?.cep,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function fmtValor(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtData(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString("pt-BR");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

/** Substitui placeholders dos templates de contrato antes de gravar o HTML. */
export function substituirPlaceholders(
  html: string,
  ctx: ContratoPlaceholderContext,
): string {
  const { cliente, escritorio, valorTotal, dataInicio } = ctx;
  const valor = valorTotal ?? cliente.valorHonorario ?? 0;
  const diaVenc = cliente.diaVencimento ?? escritorio.diaCobranca ?? 10;
  const cidade = cliente.municipio ?? cliente.endereco?.municipio ?? "—";
  const nomeCliente = cliente.razaoSocial ?? cliente.nomeFantasia ?? "—";

  const map: Record<string, string> = {
    "[CNPJ APOYA]": escritorio.cnpj || "—",
    "[ENDEREÇO APOYA]": escritorio.razaoSocial || "—",
    "[RAZÃO SOCIAL CLIENTE]": nomeCliente,
    "[CNPJ/CPF CLIENTE]": cliente.cnpj || cliente.cpf || "—",
    "[ENDEREÇO CLIENTE]": fmtEndereco(cliente.endereco, cliente.municipio, cliente.uf),
    "[NOME DO CLIENTE]": nomeCliente,
    "[VALOR]": fmtValor(valor),
    "[DIA VENCIMENTO]": String(diaVenc),
    "[CIDADE]": cidade,
    "[DATA]": fmtData(dataInicio),
  };

  let out = html;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(key).join(value);
  }
  return out;
}
