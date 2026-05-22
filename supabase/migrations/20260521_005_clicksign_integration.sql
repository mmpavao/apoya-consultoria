-- ============================================================
-- Migration 005 — Integração Clicksign
-- Data: 2026-05-21
-- ============================================================

-- 1. Adicionar colunas Clicksign na tabela contrato_cliente
ALTER TABLE contrato_cliente
  ADD COLUMN IF NOT EXISTS clicksign_envelope_id   TEXT,
  ADD COLUMN IF NOT EXISTS clicksign_document_id   TEXT,
  ADD COLUMN IF NOT EXISTS clicksign_signer_id     TEXT,
  ADD COLUMN IF NOT EXISTS clicksign_sign_url      TEXT,
  ADD COLUMN IF NOT EXISTS clicksign_status        TEXT DEFAULT 'nao_enviado'
    CHECK (clicksign_status IN ('nao_enviado','enviando','aguardando_assinatura','assinado','cancelado','expirado','recusado')),
  ADD COLUMN IF NOT EXISTS clicksign_enviado_em    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicksign_assinado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicksign_pdf_url       TEXT,
  ADD COLUMN IF NOT EXISTS clicksign_notify_email  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS clicksign_notify_whatsapp BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS clicksign_deadline_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS clicksign_remind_days   INTEGER DEFAULT 3;

-- 2. Audit log de eventos do Clicksign (webhooks recebidos)
CREATE TABLE IF NOT EXISTS clicksign_evento (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id   UUID REFERENCES contrato_cliente(id) ON DELETE CASCADE,
  envelope_id   TEXT NOT NULL,
  event_name    TEXT NOT NULL,
  event_data    JSONB,
  processed_at  TIMESTAMPTZ DEFAULT NOW(),
  raw_payload   JSONB
);

CREATE INDEX IF NOT EXISTS idx_clicksign_evento_contrato ON clicksign_evento(contrato_id);
CREATE INDEX IF NOT EXISTS idx_clicksign_evento_envelope ON clicksign_evento(envelope_id);

-- 3. RLS para clicksign_evento
ALTER TABLE clicksign_evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_clicksign_evento" ON clicksign_evento
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_clicksign_evento" ON clicksign_evento
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contrato_cliente c
      JOIN cliente cl ON cl.id = c.cliente_id
      WHERE c.id = clicksign_evento.contrato_id
    )
  );

-- 4. Config de integração Clicksign na tabela config_escritorio (se existir)
-- Verifica se a tabela config_escritorio tem coluna de integracoes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'config_escritorio') THEN
    ALTER TABLE config_escritorio
      ADD COLUMN IF NOT EXISTS clicksign_ambiente TEXT DEFAULT 'production'
        CHECK (clicksign_ambiente IN ('production', 'sandbox')),
      ADD COLUMN IF NOT EXISTS clicksign_ativo BOOLEAN DEFAULT true;
  END IF;
END;
$$;

-- 5. Index para buscas rápidas por envelope_id
CREATE INDEX IF NOT EXISTS idx_contrato_clicksign_envelope ON contrato_cliente(clicksign_envelope_id)
  WHERE clicksign_envelope_id IS NOT NULL;
