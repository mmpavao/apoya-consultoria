-- Migration 004 — Tabelas WhatsApp + colunas fiscais clientes
-- APOYA Contabilidade | 22/05/2026
CREATE TABLE IF NOT EXISTS public.wa_instance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE, display_name text NOT NULL,
  departamentos text[] DEFAULT '{}', numero text,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text, last_qr_at timestamptz, last_connected_at timestamptz,
  webhook_token text, evolution_key text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wa_conversa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.wa_instance(id) ON DELETE CASCADE,
  jid text NOT NULL, nome_contato text, numero text,
  cliente_id uuid REFERENCES public.clientes(id),
  unread_count int NOT NULL DEFAULT 0,
  last_message text, last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, jid)
);
CREATE TABLE IF NOT EXISTS public.mensagem_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid REFERENCES public.wa_conversa(id) ON DELETE CASCADE,
  message_id text, from_me boolean NOT NULL DEFAULT false,
  tipo text NOT NULL DEFAULT 'text', body text,
  media_url text, timestamp bigint, status text DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS aliquota_iss numeric(5,2);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS codigo_municipio_ibge text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nfseio_emitente_id text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inscricao_municipal text;
ALTER TABLE public.escritorio_config ADD COLUMN IF NOT EXISTS nfseio_ambiente text DEFAULT 'Development';
ALTER TABLE public.wa_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagem_whatsapp ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wa_conversa_instance ON public.wa_conversa(instance_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversa_cliente ON public.wa_conversa(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mensagem_conversa ON public.mensagem_whatsapp(conversa_id);
CREATE INDEX IF NOT EXISTS idx_das_guias_comp ON public.das_guias(competencia);
CREATE INDEX IF NOT EXISTS idx_nfse_emitida_cliente ON public.nfse_emitida(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_vencimento ON public.cobrancas(vencimento);
