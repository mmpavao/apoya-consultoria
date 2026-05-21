-- Execute no SQL Editor do Supabase.
-- Corrige: trigger set_updated_at referenciava NEW.atualizado_em,
-- mas wa_instance e wa_conversa têm coluna updated_at.

CREATE OR REPLACE FUNCTION public.set_updated_at_col()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_instance_updated ON public.wa_instance;
CREATE TRIGGER trg_wa_instance_updated
  BEFORE UPDATE ON public.wa_instance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_col();

DROP TRIGGER IF EXISTS trg_wa_conversa_updated ON public.wa_conversa;
CREATE TRIGGER trg_wa_conversa_updated
  BEFORE UPDATE ON public.wa_conversa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_col();
