-- ============================================================
-- APOYA Gestão — Migration 009: Tabela de Automações
-- ============================================================

create table if not exists public.automacoes_config (
  id               uuid primary key default uuid_generate_v4(),
  nome             text not null,
  descricao        text,
  categoria        text not null check (categoria in ('cobranca','fiscal','comunicacao','compliance','sistema')),
  tipo_gatilho     text not null check (tipo_gatilho in ('agendado','evento','webhook','manual')),
  horario          text,                         -- "08:00"
  dias_semana      integer[],                    -- [1,2,3,4,5]
  evento_gatilho   text,                         -- "Cliente cadastrado"
  tipo_acao        text not null check (tipo_acao in ('whatsapp','email','sistema','api')),
  mensagem         text,
  destinatario     text default 'todos',
  url_webhook      text,
  status           text not null default 'ativa' check (status in ('ativa','pausada','erro','executando')),
  ultima_execucao  timestamptz,
  proxima_execucao text,
  execucoes_hoje   integer default 0,
  total_execucoes  integer default 0,
  customizada      boolean default true,         -- false = pré-configurada pelo sistema
  detalhe          text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Trigger para updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists automacoes_config_updated_at on public.automacoes_config;
create trigger automacoes_config_updated_at
  before update on public.automacoes_config
  for each row execute function public.set_updated_at();

-- RLS: apenas usuários autenticados (admin/contador)
alter table public.automacoes_config enable row level security;

create policy "Usuários autenticados lêem automações"
  on public.automacoes_config for select
  using (auth.role() = 'authenticated');

create policy "Admins e contadores gerenciam automações"
  on public.automacoes_config for all
  using (auth.role() = 'authenticated');

-- ── Seed: automações pré-configuradas do sistema ─────────────
insert into public.automacoes_config
  (nome, descricao, categoria, tipo_gatilho, horario, dias_semana, evento_gatilho,
   tipo_acao, mensagem, destinatario, status, proxima_execucao, customizada, detalhe,
   execucoes_hoje, total_execucoes)
values
  ('Régua de Cobrança',
   'Envia lembrete automático por WhatsApp D-3, D0 e D+5 do vencimento do honorário',
   'cobranca', 'agendado', '08:00', array[1,2,3,4,5], null,
   'whatsapp', 'Olá {nome}, aqui é a APOYA. Seu honorário vence em breve. Qualquer dúvida, fale conosco!',
   'todos', 'ativa', 'Amanhã, 08:00', false, '3 lembretes configurados', 3, 94),

  ('Suspensão Automática',
   'Suspende acesso do cliente após 45 dias de inadimplência e reativa após confirmação de pagamento',
   'cobranca', 'evento', null, null, 'Cobrança vencida',
   'sistema', null, 'inadimplentes', 'ativa', 'Ao: Cobrança vencida', false, 'Integrado com Asaas', 1, 38),

  ('Alerta de DAS',
   'Notifica por WhatsApp e e-mail quando DAS vence em 5 dias. Gera boleto automaticamente',
   'fiscal', 'agendado', '09:00', array[1,2,3,4,5], null,
   'whatsapp', 'Olá {nome}, sua guia DAS vence em 5 dias. Acesse o portal para verificar.',
   'todos', 'ativa', 'Amanhã, 09:00', false, 'Vence dia 20 de cada mês', 2, 67),

  ('Monitor de Obrigações',
   'Verifica diariamente obrigações acessórias pendentes e notifica o contador responsável',
   'fiscal', 'agendado', '07:00', array[1,2,3,4,5], null,
   'email', 'Relatório diário de obrigações pendentes.',
   'todos', 'ativa', 'Amanhã, 07:00', false, 'DCTFWeb, eSocial, SPED, PGDAS', 1, 82),

  ('Validação NFS-e',
   'Confere notas emitidas no mês, detecta rejeitadas e alerta para reemissão',
   'fiscal', 'agendado', '23:00', array[1,2,3,4,5,6,0], null,
   'sistema', null,
   'todos', 'ativa', 'Hoje, 23:00', false, 'Integrado com NFE.io', 1, 45),

  ('Boas-vindas WhatsApp',
   'Envia mensagem automática de boas-vindas quando novo cliente é cadastrado no sistema',
   'comunicacao', 'evento', null, null, 'Cliente cadastrado',
   'whatsapp', 'Olá {nome}! Seja bem-vindo à APOYA. Estamos aqui para cuidar da sua contabilidade com excelência! 🎉',
   'evento', 'ativa', 'Ao: Cliente cadastrado', false, 'Trigger: novo cliente', 0, 12),

  ('Relatório Mensal',
   'Envia relatório gerencial completo para cada cliente no primeiro dia útil do mês',
   'comunicacao', 'agendado', '09:00', array[1], null,
   'email', 'Segue em anexo o relatório gerencial do mês. Qualquer dúvida, estamos à disposição.',
   'todos', 'pausada', '01/06/2026', false, 'Por e-mail + PDF', 0, 5),

  ('Alerta de Certificado Digital',
   'Avisa o cliente e o contador 60, 30 e 15 dias antes do vencimento do certificado A1/A3',
   'compliance', 'agendado', '06:00', array[1,2,3,4,5], null,
   'whatsapp', 'Atenção {nome}: seu certificado digital vence em breve. Entre em contato para renovação.',
   'todos', 'ativa', 'Amanhã, 06:00', false, '3 alertas: 60/30/15 dias', 2, 31),

  ('Monitor Procuração eCAC',
   'Verifica validade das procurações no eCAC via SERPRO e alerta vencimentos',
   'compliance', 'agendado', '06:30', array[1,2,3,4,5], null,
   'email', 'Procuração eCAC próxima ao vencimento para {nome}. Renovação necessária.',
   'todos', 'ativa', 'Amanhã, 06:30', false, 'API SERPRO integrada', 1, 28),

  ('Backup de Dados',
   'Exporta snapshot completo do banco para storage seguro toda madrugada',
   'sistema', 'agendado', '03:00', array[0,1,2,3,4,5,6], null,
   'sistema', null,
   'todos', 'ativa', 'Amanhã, 03:00', false, 'Supabase Storage', 1, 103),

  ('Sincronização SERPRO',
   'Atualiza situação fiscal e dados cadastrais de todos os clientes semanalmente',
   'sistema', 'agendado', '02:00', array[0], null,
   'sistema', null,
   'todos', 'ativa', 'Dom, 02:00', false, 'Gateway mcp.zapro.tech', 0, 22)
on conflict do nothing;
