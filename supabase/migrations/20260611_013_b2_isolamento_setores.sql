-- ============================================================
-- B2 — Isolamento por setor (humanos)
-- 20260611_013_b2_isolamento_setores.sql
-- ============================================================

-- 1. Setores faltantes
INSERT INTO public.setores (slug, nome, descricao, icone, cor, ordem, ativo)
VALUES
  ('dp',         'Dep. Pessoal', 'Folha de pagamento, admissões, demissões', 'Users2',   '#8b5cf6', 10, true),
  ('contabil',   'Contábil',     'Escrituração contábil, balanço, DRE',      'BookOpen', '#0ea5e9', 20, true),
  ('societario', 'Societário',   'Contratos, sócios, alterações societárias','Landmark', '#10b981', 30, true),
  ('tributario', 'Tributário',   'Planejamento tributário, declarações',      'Receipt',  '#f59e0b', 40, true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Permissões base para setores novos
DO $$
DECLARE
  dp_id  uuid; ctb_id uuid; soc_id uuid; tri_id uuid;
BEGIN
  SELECT id INTO dp_id  FROM public.setores WHERE slug = 'dp';
  SELECT id INTO ctb_id FROM public.setores WHERE slug = 'contabil';
  SELECT id INTO soc_id FROM public.setores WHERE slug = 'societario';
  SELECT id INTO tri_id FROM public.setores WHERE slug = 'tributario';

  INSERT INTO public.permissoes (setor_id, slug, label) VALUES
    (dp_id,  'dp.visualizar',           'Visualizar DP'),
    (dp_id,  'dp.folha',                'Folha de Pagamento'),
    (dp_id,  'dp.admissao',             'Admissão/Demissão'),
    (ctb_id, 'contabil.visualizar',     'Visualizar Contábil'),
    (ctb_id, 'contabil.lancamentos',    'Lançamentos'),
    (ctb_id, 'contabil.relatorios',     'Relatórios Contábeis'),
    (soc_id, 'societario.visualizar',   'Visualizar Societário'),
    (soc_id, 'societario.alteracoes',   'Alterações Societárias'),
    (tri_id, 'tributario.visualizar',   'Visualizar Tributário'),
    (tri_id, 'tributario.planejamento', 'Planejamento Tributário')
  ON CONFLICT (setor_id, slug) DO NOTHING;
END $$;

-- 3. Tabela user_setores (acesso direto por slug — sem JOIN triplo)
CREATE TABLE IF NOT EXISTS public.user_setores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setor_slug   text NOT NULL,
  papel        text NOT NULL DEFAULT 'operador'
                 CHECK (papel IN ('operador', 'aprovador', 'gestor')),
  concedido_por uuid REFERENCES auth.users(id),
  concedido_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, setor_slug)
);

ALTER TABLE public.user_setores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_setores' AND policyname='us_select_own'
  ) THEN
    CREATE POLICY "us_select_own"   ON public.user_setores FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR public.is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_setores' AND policyname='us_insert_admin'
  ) THEN
    CREATE POLICY "us_insert_admin" ON public.user_setores FOR INSERT TO authenticated
      WITH CHECK (public.is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_setores' AND policyname='us_update_admin'
  ) THEN
    CREATE POLICY "us_update_admin" ON public.user_setores FOR UPDATE TO authenticated
      USING (public.is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_setores' AND policyname='us_delete_admin'
  ) THEN
    CREATE POLICY "us_delete_admin" ON public.user_setores FOR DELETE TO authenticated
      USING (public.is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_setores' AND policyname='us_service_all'
  ) THEN
    CREATE POLICY "us_service_all"  ON public.user_setores FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- 4. has_setor atualizada (user_setores + is_admin)
CREATE OR REPLACE FUNCTION public.has_setor(s_slug text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_setores us
      WHERE us.user_id = auth.uid() AND us.setor_slug = s_slug
    );
$$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_setores_user_id    ON public.user_setores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_setores_setor_slug ON public.user_setores(setor_slug);

-- 5. Seed: admins (Marcio, Daniel, O Contador, marcio@apoya) = TODOS os setores
INSERT INTO public.user_setores (user_id, setor_slug, papel)
SELECT u.id, s.slug, 'gestor'
FROM auth.users u
CROSS JOIN public.setores s
WHERE u.email IN ('pavaosmart@gmail.com','marcio@apoya.com.br','daniel@apoya.com.br','ocontador@meucontador.io')
  AND s.ativo = true
ON CONFLICT (user_id, setor_slug) DO NOTHING;

-- Seed: demais usuários por função
INSERT INTO public.user_setores (user_id, setor_slug, papel)
SELECT u.id, v.setor, 'operador'
FROM auth.users u
JOIN (VALUES
  ('sofia@meucontador.io',   'fiscal'),
  ('hugo@meucontador.io',    'dp'),
  ('marcos@meucontador.io',  'contabil'),
  ('pedro@meucontador.io',   'societario'),
  ('carla@meucontador.io',   'financeiro'),
  ('rafael@meucontador.io',  'tributario'),
  ('ana@meucontador.io',     'clientes'),
  ('ana@meucontador.io',     'whatsapp')
) AS v(email, setor) ON u.email = v.email
ON CONFLICT (user_id, setor_slug) DO NOTHING;

-- 6. Usuário de teste fiscal (só fiscal)
INSERT INTO public.user_setores (user_id, setor_slug, papel)
SELECT u.id, 'fiscal', 'operador'
FROM auth.users u WHERE u.email = 'test.fiscal.b2@apoya.com.br'
ON CONFLICT (user_id, setor_slug) DO NOTHING;

-- 7. Seed user_setor_permissoes: popular com permissoes existentes
-- Para cada user_setores, inserir todas as permissões do setor
INSERT INTO public.user_setor_permissoes (user_id, setor_id, permissao_id, concedido_por)
SELECT DISTINCT us.user_id, p.setor_id, p.id, us.user_id
FROM public.user_setores us
JOIN public.setores s ON s.slug = us.setor_slug
JOIN public.permissoes p ON p.setor_id = s.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_setor_permissoes usp2
  WHERE usp2.user_id = us.user_id AND usp2.permissao_id = p.id
);
