-- ============================================================
-- WHATSAPP / EVOLUTION API v2 — schema multi-instância + inbox
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Storage bucket para mídia (imagens, áudios, docs recebidos/enviados)
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policies bucket: staff lê e grava, service_role livre
DROP POLICY IF EXISTS "wa-media staff read"  ON storage.objects;
DROP POLICY IF EXISTS "wa-media staff write" ON storage.objects;
DROP POLICY IF EXISTS "wa-media public read" ON storage.objects;

CREATE POLICY "wa-media public read" ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "wa-media staff write" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND (is_staff(auth.uid()) OR auth.role() = 'service_role'));

-- ============================================================
-- wa_instance
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wa_instance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL UNIQUE,
  display_name      text NOT NULL,
  departamentos     text[] NOT NULL DEFAULT '{}',
  numero            text,
  status            text NOT NULL DEFAULT 'created',
  qr_code           text,
  last_qr_at        timestamptz,
  last_connected_at timestamptz,
  webhook_token     text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  evolution_apikey  text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_instance_status ON public.wa_instance(status);

DROP TRIGGER IF EXISTS trg_wa_instance_updated ON public.wa_instance;
CREATE TRIGGER trg_wa_instance_updated
  BEFORE UPDATE ON public.wa_instance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- wa_conversa
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wa_conversa (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id           uuid NOT NULL REFERENCES public.wa_instance(id) ON DELETE CASCADE,
  cliente_id            uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  telefone              text NOT NULL,
  nome_contato          text,
  avatar_url            text,
  ultima_mensagem       text,
  ultima_em             timestamptz,
  nao_lidas             integer NOT NULL DEFAULT 0,
  assigned_to           uuid,
  assigned_at           timestamptz,
  departamento          text,
  contato_digitando_ate timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, telefone)
);
CREATE INDEX IF NOT EXISTS idx_wa_conversa_inst     ON public.wa_conversa(instance_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversa_assigned ON public.wa_conversa(assigned_to);

DROP TRIGGER IF EXISTS trg_wa_conversa_updated ON public.wa_conversa;
CREATE TRIGGER trg_wa_conversa_updated
  BEFORE UPDATE ON public.wa_conversa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Estender mensagem_whatsapp
-- ============================================================
ALTER TABLE public.mensagem_whatsapp
  ADD COLUMN IF NOT EXISTS instance_id   uuid REFERENCES public.wa_instance(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS conversa_id   uuid REFERENCES public.wa_conversa(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS agente_id     uuid,
  ADD COLUMN IF NOT EXISTS agente_nome   text,
  ADD COLUMN IF NOT EXISTS departamento  text,
  ADD COLUMN IF NOT EXISTS reply_to      text,
  ADD COLUMN IF NOT EXISTS reaction      text,
  ADD COLUMN IF NOT EXISTS reaction_to   text,
  ADD COLUMN IF NOT EXISTS mime_type     text;

CREATE INDEX IF NOT EXISTS idx_msgwa_conv ON public.mensagem_whatsapp(conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msgwa_inst ON public.mensagem_whatsapp(instance_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.wa_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_instance admin all"   ON public.wa_instance;
DROP POLICY IF EXISTS "wa_instance staff read"  ON public.wa_instance;
DROP POLICY IF EXISTS "wa_instance service all" ON public.wa_instance;

CREATE POLICY "wa_instance admin all" ON public.wa_instance
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "wa_instance staff read" ON public.wa_instance
  FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "wa_instance service all" ON public.wa_instance
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wa_conversa staff all"   ON public.wa_conversa;
DROP POLICY IF EXISTS "wa_conversa service all" ON public.wa_conversa;

CREATE POLICY "wa_conversa staff all" ON public.wa_conversa
  FOR ALL USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "wa_conversa service all" ON public.wa_conversa
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Realtime
-- ============================================================
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='wa_instance';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_instance; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='wa_conversa';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversa; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='mensagem_whatsapp';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagem_whatsapp; END IF;
END $$;
