import type { Cliente, Regime } from "@/hooks/use-clientes";

export function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

export function formatCNPJ(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function isValidCNPJ(v: string) {
  const c = onlyDigits(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (base: string) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split("").reduce((acc, n, i) => acc + parseInt(n, 10) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return d1 === parseInt(c[12], 10) && d2 === parseInt(c[13], 10);
}

export type CNPJLookup = Partial<Pick<Cliente, "razaoSocial" | "nomeFantasia" | "email" | "telefone" | "atividadePrincipal" | "endereco" | "regime">>;

// Busca via BrasilAPI (público, sem auth). Fallback silencioso se offline.
export async function lookupCNPJ(cnpj: string): Promise<CNPJLookup | null> {
  const c = onlyDigits(cnpj);
  if (c.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
    if (!res.ok) return null;
    const d = await res.json();
    const regime: Regime | undefined =
      d.opcao_pelo_mei ? "MEI" :
      d.opcao_pelo_simples ? "Simples" : undefined;
    return {
      razaoSocial: d.razao_social,
      nomeFantasia: d.nome_fantasia || undefined,
      email: d.email || undefined,
      telefone: d.ddd_telefone_1 || undefined,
      atividadePrincipal: d.cnae_fiscal_descricao,
      regime,
      endereco: {
        cep: d.cep,
        logradouro: d.logradouro,
        numero: d.numero,
        bairro: d.bairro,
        municipio: d.municipio,
        uf: d.uf,
      },
    };
  } catch {
    return null;
  }
}
