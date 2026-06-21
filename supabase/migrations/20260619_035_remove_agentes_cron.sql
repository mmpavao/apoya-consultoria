-- Onda L1 — remoção da automação de agentes.
-- O time de agentes (orquestrador + experts) foi descontinuado; o sistema passa
-- a ser 100% manual. Remove o cron diário, a RPC e o secret do Vault que só
-- serviam ao orquestrador. Idempotente.

-- 1. Desagenda o cron diário do orquestrador.
do $$
begin
  perform cron.unschedule('apoya-orquestrador-diario');
exception when others then
  null; -- já não existia
end $$;

-- 2. Remove a RPC de validação do secret do cron (não há mais cron de agente).
drop function if exists public.verify_cron_secret(text);

-- 3. Remove o secret dedicado do Vault.
do $$
begin
  delete from vault.secrets where name = 'CRON_ORQUESTRADOR_SECRET';
exception when others then
  null;
end $$;
