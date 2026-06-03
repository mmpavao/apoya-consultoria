-- ============================================================
-- Migration: Remover colunas NFE.io, adicionar colunas Focus NF-e
-- Data: 2026-06-03
-- ============================================================

-- 1. Escritório config: adicionar focus_ambiente (substituindo nfseio_ambiente/nfseio_emitente_id)
ALTER TABLE public.escritorio_config
  ADD COLUMN IF NOT EXISTS focus_ambiente text DEFAULT 'homologacao';

-- 2. Índice único para focus_ref em nfse_emitida (evita duplicatas ao sincronizar)
CREATE UNIQUE INDEX IF NOT EXISTS nfse_emitida_focus_ref_idx
  ON public.nfse_emitida (focus_ref)
  WHERE focus_ref IS NOT NULL;

-- 3. Índice único para focus_ref em nfse_recebida
CREATE UNIQUE INDEX IF NOT EXISTS nfse_recebida_focus_ref_idx
  ON public.nfse_recebida (focus_ref)
  WHERE focus_ref IS NOT NULL;

-- 4. Garantir focus_ref em nfse_emitida (para upsert via OnConflict)
ALTER TABLE public.nfse_emitida
  ADD COLUMN IF NOT EXISTS focus_ref text;

-- 5. Garantir focus_ref em nfse_recebida
ALTER TABLE public.nfse_recebida
  ADD COLUMN IF NOT EXISTS focus_ref text;

-- 6. Adicionar campo pdf_url em nfse_recebida (Focus devolve URL do PDF)
ALTER TABLE public.nfse_recebida
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- 7. Manter nfseio_cert_id e nfseio_cert_uploaded_at em config_certificado
--    (podem ser reutilizados para o cert da Focus)
-- (sem alteração necessária — já existem)
