# ⚠️ ESCOPO FECHADO — WhatsApp API APOYA

**Data de fechamento:** 2026-05-21
**Responsável:** ARQUITETO APOYA

## O que NÃO pode ser modificado sem aprovação explícita do ARQUITETO:

- `client.server.ts` — HTTP client da Evolution API
- `sb.server.ts` — Supabase service-role client
- `wa.server.ts` — Helpers de servidor
- `message.functions.ts` — Server Functions de envio/leitura
- `instance.functions.ts` — Server Functions de gestão de instâncias
- `../../../routes/api/public/evolution-webhook.$instance.ts` — Webhook receiver

## Funcionalidades fechadas (não adicionar sem PRD aprovado):

- sendText / sendMedia / sendAudio / sendReaction / sendPresence ✅
- listConversas / getMensagens ✅
- assumeConversa / liberarConversa / marcarLida / startConversa ✅
- createInstance / deleteInstance / refreshQr / fetchInstanceStatus ✅
- Webhook: connection.update, qrcode.updated, messages.upsert, messages.update, message.reaction, presence.update ✅

## Documentação completa:
`.agents/skills/apoya-whatsapp-sdk/SKILL.md`
