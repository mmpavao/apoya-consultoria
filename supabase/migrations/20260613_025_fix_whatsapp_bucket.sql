-- SEC-006: Tornar bucket whatsapp-media privado
-- Auditoria 12/06/2026: bucket público com SELECT sem autenticação
-- permite acesso a documentos pessoais (RG, notas) por URL adivinhável

-- 1. Tornar bucket privado
UPDATE storage.buckets
  SET public = false
  WHERE name = 'whatsapp-media';

-- 2. Remover policy de leitura anônima
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "allow_public_read_whatsapp" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_media_public_read" ON storage.objects;

-- 3. Criar policy restrita a staff
CREATE POLICY "staff_read_whatsapp_media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'whatsapp-media'
    AND is_staff(auth.uid())
  );

-- 4. Staff e service-role podem inserir/deletar
CREATE POLICY IF NOT EXISTS "staff_write_whatsapp_media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND is_staff(auth.uid())
  );

CREATE POLICY IF NOT EXISTS "staff_delete_whatsapp_media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'whatsapp-media'
    AND is_staff(auth.uid())
  );

COMMENT ON TABLE storage.buckets IS 'whatsapp-media: privado desde 13/06/2026 — SEC-006';
