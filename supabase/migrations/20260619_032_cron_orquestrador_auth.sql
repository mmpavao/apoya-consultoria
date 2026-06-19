-- Fix BLOCKER: o cron diário do orquestrador disparava SEM Authorization →
-- 401 todo dia às 11:00 UTC, fan-out aos experts nunca rodava.
--
-- Desenho self-contained (sem manuseio humano de secret):
--   1. Gera um secret dedicado no Vault (CRON_ORQUESTRADOR_SECRET).
--   2. RPC SECURITY DEFINER verify_cron_secret() — o orquestrador (service-role)
--      valida o Bearer recebido contra o Vault. anon/authenticated NÃO podem
--      chamar (sem oráculo). env da function e Vault são stores distintos; por
--      isso a validação acontece no banco, não comparando com AGENTS_GATE_SECRET.
--   3. Reagenda o cron injetando 'Authorization: Bearer <secret do Vault>'.
-- Idempotente.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto;
create extension if not exists supabase_vault;

-- 1. Secret do cron no Vault (só cria se ainda não existir).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'CRON_ORQUESTRADOR_SECRET') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'CRON_ORQUESTRADOR_SECRET',
      'Bearer usado pelo pg_cron para autenticar no agente-orquestrador'
    );
  end if;
end $$;

-- 2. RPC de verificação (o orquestrador chama via service-role).
create or replace function public.verify_cron_secret(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'CRON_ORQUESTRADOR_SECRET'
      and decrypted_secret = p_token
  );
$$;

revoke all on function public.verify_cron_secret(text) from public;
revoke all on function public.verify_cron_secret(text) from anon;
revoke all on function public.verify_cron_secret(text) from authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

-- 3. Reagenda o cron COM o header de Authorization vindo do Vault.
do $$
begin
  perform cron.unschedule('apoya-orquestrador-diario');
exception when others then
  null; -- não existia ainda
end $$;

select cron.schedule(
  'apoya-orquestrador-diario',
  '0 11 * * *',  -- 11:00 UTC = 08:00 America/Sao_Paulo
  $cron$
  select net.http_post(
    url     := 'https://ajaqbdsalxfgrwpjbtbn.supabase.co/functions/v1/agente-orquestrador',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'CRON_ORQUESTRADOR_SECRET'
      )
    ),
    body    := '{"trigger": "cron"}'::jsonb
  );
  $cron$
);
