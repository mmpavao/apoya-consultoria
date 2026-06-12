-- Migration 016: FIX-008 — Corrigir policies bucket whatsapp-media
-- Aplicada em 2026-06-12 via Sprint Fix-2

-- Remover policies inseguras (acesso público)
DROP POLICY IF EXISTS "wa-media public read" ON storage.objects;
DROP POLICY IF EXISTS "wa-media staff write" ON storage.objects;

-- SELECT: apenas staff autenticado
CREATE POLICY "wa-media staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND public.is_staff(auth.uid())
  );

-- INSERT: apenas staff autenticado
CREATE POLICY "wa-media staff insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND public.is_staff(auth.uid())
  );

-- DELETE: apenas admin
CREATE POLICY "wa-media admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'whatsapp-media'
    AND public.is_admin()
  );

-- Tornar bucket privado
UPDATE storage.buckets SET public = false WHERE id = 'whatsapp-media';

