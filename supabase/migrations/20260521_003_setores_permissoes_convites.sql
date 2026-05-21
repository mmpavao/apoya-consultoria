-- ============================================================
-- Migration 003: Setores, Permissões por Setor e Convites
-- Projeto: APOYA Gestão
-- Data: 2026-05-21
-- Autor: ARQUITETO
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. SETORES
-- Representa as áreas funcionais do escritório.
-- Exemplos: fiscal, financeiro, clientes, whatsapp, admin
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,          -- ex: 'fiscal', 'financeiro'
  nome        text NOT NULL,                  -- ex: 'Fiscal', 'Financeiro'
  descricao   text,
  icone       text,                           -- nome do ícone lucide ex: 'FileText'
  cor         text DEFAULT '#6b7280',         -- cor hex para badge
  ordem       int  DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- 2. PERMISSÕES POR SETOR
-- Cada linha = uma permissão específica de uma ação dentro de um setor.
-- Ex: setor_id=fiscal, acao='emitir_nfse', label='Emitir NFS-e'
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id    uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  slug        text NOT NULL,          -- ex: 'fiscal.emitir_nfse'
  label       text NOT NULL,          -- ex: 'Emitir NFS-e'
  descricao   text,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(setor_id, slug)
);

-- ──────────────────────────────────────────────────────────────
-- 3. USER_ROLES (atualizar para incluir novos roles)
-- Roles existentes: admin, contador, assistente, cliente
-- Novos roles: agente, supervisor
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin','contador','assistente','agente','supervisor','cliente'));

-- ──────────────────────────────────────────────────────────────
-- 4. USER_SETOR_PERMISSOES
-- Relaciona usuário ↔ setor + lista de permissões concedidas.
-- Lógica: usuário pode estar em múltiplos setores com permissões diferentes.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_setor_permissoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setor_id     uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  permissao_id uuid NOT NULL REFERENCES public.permissoes(id) ON DELETE CASCADE,
  concedido_por uuid REFERENCES auth.users(id),
  concedido_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permissao_id)
);

-- ──────────────────────────────────────────────────────────────
-- 5. CONVITES
-- Token de convite seguro (SHA-256, 64 chars hex).
-- Validade: 7 dias. Uso único.
-- Apenas admin pode criar convites.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.convites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'assistente'
                    CHECK (role IN ('admin','contador','assistente','agente','supervisor')),
  token           text NOT NULL UNIQUE,        -- SHA-256 hex gerado no backend
  setores_ids     uuid[] DEFAULT '{}',          -- setores que serão atribuídos após aceite
  criado_por      uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  expira_em       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  usado_em        timestamptz,                  -- null = ainda não usado
  cancelado_em    timestamptz,                  -- null = ativo
  mensagem        text                          -- mensagem personalizada opcional
);

-- ──────────────────────────────────────────────────────────────
-- 6. TRIGGERS: updated_at automático
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER setores_updated_at
  BEFORE UPDATE ON public.setores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 7. RLS — Row Level Security
-- ──────────────────────────────────────────────────────────────

-- Helper: verifica se o usuário logado é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper: verifica se o usuário tem uma permissão específica (por slug)
CREATE OR REPLACE FUNCTION public.has_permission(p_slug text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_setor_permissoes usp
      JOIN public.permissoes p ON p.id = usp.permissao_id
      WHERE usp.user_id = auth.uid() AND p.slug = p_slug
    );
$$;

-- Helper: verifica se o usuário tem acesso a um setor (por slug)
CREATE OR REPLACE FUNCTION public.has_setor(s_slug text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_setor_permissoes usp
      JOIN public.setores s ON s.id = usp.setor_id
      WHERE usp.user_id = auth.uid() AND s.slug = s_slug
    );
$$;

-- SETORES: todos os autenticados leem; apenas admin altera
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "setores_select" ON public.setores FOR SELECT TO authenticated USING (true);
CREATE POLICY "setores_insert" ON public.setores FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "setores_update" ON public.setores FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "setores_delete" ON public.setores FOR DELETE TO authenticated USING (public.is_admin());

-- PERMISSOES: todos os autenticados leem; apenas admin altera
ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permissoes_select" ON public.permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissoes_insert" ON public.permissoes FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "permissoes_update" ON public.permissoes FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "permissoes_delete" ON public.permissoes FOR DELETE TO authenticated USING (public.is_admin());

-- USER_SETOR_PERMISSOES: usuário vê as próprias; admin vê todas
ALTER TABLE public.user_setor_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usp_select_own"  ON public.user_setor_permissoes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "usp_insert_admin" ON public.user_setor_permissoes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "usp_delete_admin" ON public.user_setor_permissoes FOR DELETE TO authenticated
  USING (public.is_admin());

-- CONVITES: admin cria e gerencia; ninguém lê token via REST (edge function valida)
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "convites_select_admin" ON public.convites FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "convites_insert_admin" ON public.convites FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "convites_update_admin" ON public.convites FOR UPDATE TO authenticated
  USING (public.is_admin());
-- Service role pode marcar convite como usado (via edge function)
CREATE POLICY "convites_service_update" ON public.convites FOR UPDATE TO service_role USING (true);

-- ──────────────────────────────────────────────────────────────
-- 8. ÍNDICES para performance
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usp_user_id     ON public.user_setor_permissoes(user_id);
CREATE INDEX IF NOT EXISTS idx_usp_setor_id    ON public.user_setor_permissoes(setor_id);
CREATE INDEX IF NOT EXISTS idx_usp_permissao   ON public.user_setor_permissoes(permissao_id);
CREATE INDEX IF NOT EXISTS idx_convites_token  ON public.convites(token);
CREATE INDEX IF NOT EXISTS idx_convites_email  ON public.convites(email);
CREATE INDEX IF NOT EXISTS idx_convites_expira ON public.convites(expira_em) WHERE usado_em IS NULL;

-- ──────────────────────────────────────────────────────────────
-- 9. SEED: Setores padrão do escritório contábil
-- ──────────────────────────────────────────────────────────────
INSERT INTO public.setores (slug, nome, descricao, icone, cor, ordem) VALUES
  ('clientes',    'Clientes',    'Gestão da carteira de clientes',              'Users',        '#3b82f6', 1),
  ('fiscal',      'Fiscal',      'DAS, NFS-e, obrigações fiscais',              'FileText',     '#8b5cf6', 2),
  ('financeiro',  'Financeiro',  'Cobranças, honorários, inadimplência',        'DollarSign',   '#10b981', 3),
  ('whatsapp',    'WhatsApp',    'Instâncias, mensagens e automações',          'MessageSquare','#22c55e',  4),
  ('obrigacoes',  'Obrigações',  'Calendário fiscal e obrigações acessórias',   'Calendar',     '#f59e0b', 5),
  ('configuracoes','Configurações','Usuários, integrações e dados do escritório','Settings',    '#6b7280', 6)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────
-- 10. SEED: Permissões por setor
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  s_clientes    uuid := (SELECT id FROM setores WHERE slug = 'clientes');
  s_fiscal      uuid := (SELECT id FROM setores WHERE slug = 'fiscal');
  s_financeiro  uuid := (SELECT id FROM setores WHERE slug = 'financeiro');
  s_whatsapp    uuid := (SELECT id FROM setores WHERE slug = 'whatsapp');
  s_obrigacoes  uuid := (SELECT id FROM setores WHERE slug = 'obrigacoes');
  s_config      uuid := (SELECT id FROM setores WHERE slug = 'configuracoes');
BEGIN

  -- Clientes
  INSERT INTO permissoes (setor_id, slug, label) VALUES
    (s_clientes, 'clientes.visualizar',  'Visualizar clientes'),
    (s_clientes, 'clientes.criar',       'Criar clientes'),
    (s_clientes, 'clientes.editar',      'Editar clientes'),
    (s_clientes, 'clientes.excluir',     'Excluir clientes'),
    (s_clientes, 'clientes.exportar',    'Exportar dados')
  ON CONFLICT (setor_id, slug) DO NOTHING;

  -- Fiscal
  INSERT INTO permissoes (setor_id, slug, label) VALUES
    (s_fiscal, 'fiscal.visualizar',      'Visualizar painel fiscal'),
    (s_fiscal, 'fiscal.gerar_das',       'Gerar DAS/DASMEI'),
    (s_fiscal, 'fiscal.emitir_nfse',     'Emitir NFS-e'),
    (s_fiscal, 'fiscal.cancelar_nfse',   'Cancelar NFS-e'),
    (s_fiscal, 'fiscal.consultar_serpro','Consultar SERPRO')
  ON CONFLICT (setor_id, slug) DO NOTHING;

  -- Financeiro
  INSERT INTO permissoes (setor_id, slug, label) VALUES
    (s_financeiro, 'financeiro.visualizar',   'Visualizar financeiro'),
    (s_financeiro, 'financeiro.cobrar',        'Registrar cobrança'),
    (s_financeiro, 'financeiro.baixar',        'Baixar pagamento'),
    (s_financeiro, 'financeiro.relatorios',    'Gerar relatórios'),
    (s_financeiro, 'financeiro.honorarios',    'Editar honorários')
  ON CONFLICT (setor_id, slug) DO NOTHING;

  -- WhatsApp
  INSERT INTO permissoes (setor_id, slug, label) VALUES
    (s_whatsapp, 'whatsapp.visualizar',   'Visualizar WhatsApp'),
    (s_whatsapp, 'whatsapp.enviar',       'Enviar mensagens'),
    (s_whatsapp, 'whatsapp.instancias',   'Gerenciar instâncias'),
    (s_whatsapp, 'whatsapp.templates',    'Editar templates')
  ON CONFLICT (setor_id, slug) DO NOTHING;

  -- Obrigações
  INSERT INTO permissoes (setor_id, slug, label) VALUES
    (s_obrigacoes, 'obrigacoes.visualizar', 'Visualizar obrigações'),
    (s_obrigacoes, 'obrigacoes.registrar',  'Registrar cumprimento'),
    (s_obrigacoes, 'obrigacoes.criar',      'Criar obrigações'),
    (s_obrigacoes, 'obrigacoes.editar',     'Editar obrigações')
  ON CONFLICT (setor_id, slug) DO NOTHING;

  -- Configurações (apenas admin tem por padrão)
  INSERT INTO permissoes (setor_id, slug, label) VALUES
    (s_config, 'config.usuarios',     'Gerenciar usuários'),
    (s_config, 'config.convites',     'Enviar convites'),
    (s_config, 'config.integracoes',  'Gerenciar integrações'),
    (s_config, 'config.escritorio',   'Editar dados do escritório')
  ON CONFLICT (setor_id, slug) DO NOTHING;

END $$;

-- ──────────────────────────────────────────────────────────────
-- FIM da Migration 003
-- ──────────────────────────────────────────────────────────────
