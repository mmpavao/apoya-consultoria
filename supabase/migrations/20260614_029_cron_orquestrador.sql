-- Cron diário do time de agentes: dispara o orquestrador todo dia às 08:00 BRT
-- (11:00 UTC). O orquestrador faz fan-out aos 5 experts, cada um tria seu
-- pipeline, parando nos gates de aprovação humana. Idempotente.
--
-- Requer extensões pg_cron e pg_net (disponíveis no Supabase).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (se existir) para reaplicar com segurança.
do $$
begin
  perform cron.unschedule('apoya-orquestrador-diario');
exception when others then
  null; -- não existia ainda
end $$;

-- Agenda: 11:00 UTC = 08:00 America/Sao_Paulo.
select cron.schedule(
  'apoya-orquestrador-diario',
  '0 11 * * *',
  $cron$
  select net.http_post(
    url     := 'https://ajaqbdsalxfgrwpjbtbn.supabase.co/functions/v1/agente-orquestrador',
    -- O orquestrador agora é FAIL-CLOSED: exige a service role key.
    -- Ao aplicar, substituir <<SERVICE_ROLE_KEY>> pela chave real do projeto.
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <<SERVICE_ROLE_KEY>>'
    ),
    body    := '{"trigger": "cron"}'::jsonb
  );
  $cron$
);
