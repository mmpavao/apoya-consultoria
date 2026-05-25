-- ══════════════════════════════════════════════════════════════
-- 008 · UNIQUE constraint para upsert de sócios
-- ══════════════════════════════════════════════════════════════

-- Remover registros duplicados antes (mantém o mais antigo)
DELETE FROM public.cliente_socio a
  USING public.cliente_socio b
  WHERE a.id > b.id
    AND a.cliente_id = b.cliente_id
    AND a.cnpj_cpf_socio IS NOT NULL
    AND a.cnpj_cpf_socio = b.cnpj_cpf_socio;

-- Adicionar constraint UNIQUE (somente quando cnpj_cpf_socio não é nulo)
-- Como Postgres não suporta partial UNIQUE direto com upsert, usamos índice único parcial
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cliente_socio_cnpj_cpf
  ON public.cliente_socio(cliente_id, cnpj_cpf_socio)
  WHERE cnpj_cpf_socio IS NOT NULL AND cnpj_cpf_socio <> '';
