# Webhooks (eventos recebidos)

Evolution faz `POST` para a URL configurada. Body sempre contém:
```json
{ "event": "messages.upsert", "instance":"apoya-fiscal", "data": { ... } }
```

Validar via query `?token=<webhook_token>` armazenado em `wa_instance.webhook_token`.

## CONNECTION_UPDATE
```json
{ "event":"connection.update", "instance":"...", "data": { "state":"open"|"connecting"|"close", "statusReason":200 } }
```
Ação: atualizar `wa_instance.status` (open→connected, close→disconnected, connecting→connecting) e `last_connected_at` quando open.

## QRCODE_UPDATED
```json
{ "event":"qrcode.updated", "instance":"...", "data": { "qrcode": { "code":"data:image/png;base64,...","base64":"..." } } }
```
Ação: gravar `wa_instance.qr_code` + `last_qr_at`.

## MESSAGES_UPSERT
```json
{
  "event":"messages.upsert",
  "instance":"...",
  "data": {
    "key": { "remoteJid":"5511...@s.whatsapp.net", "fromMe":false, "id":"3EB0..." },
    "pushName":"Fulano",
    "message": {
      "conversation":"texto simples",
      "extendedTextMessage": { "text":"..." },
      "imageMessage": { "caption":"...", "mimetype":"image/jpeg" },
      "audioMessage": { "ptt":true, "mimetype":"audio/ogg" },
      "documentMessage": { "fileName":"x.pdf","mimetype":"application/pdf" },
      "videoMessage": { "caption":"...","mimetype":"video/mp4" },
      "reactionMessage": { "key":{"id":"..."}, "text":"👍" }
    },
    "messageType":"conversation",
    "messageTimestamp": 1716302410
  }
}
```
Fluxo backend:
1. Ignorar se `key.fromMe === true` E o `id` já está em `mensagem_whatsapp.evolution_id` (já registramos no envio).
2. Upsert `wa_conversa` por `(instance_id, telefone)`. Telefone = `remoteJid` antes do `@`.
3. Insert `mensagem_whatsapp` com `direcao='entrada'`, `evolution_id=key.id`, conteúdo extraído conforme `messageType`.
4. Se mídia: chamar `chat/getBase64FromMediaMessage`, gravar em `whatsapp-media/<instance>/<id>.<ext>`, salvar `arquivo_url`.
5. Incrementar `nao_lidas` se `assigned_to IS NULL` ou agente atual não estiver olhando.

## MESSAGES_UPDATE
Status de entrega/leitura: `data.update.status` = `READ|DELIVERY_ACK|PLAYED|PENDING|SERVER_ACK`.
Atualizar `mensagem_whatsapp.status` (entregue/lida) via `evolution_id`.

## SEND_MESSAGE
Confirmação do envio iniciado pelo próprio sistema. Pode ser ignorado se já gravamos.

## MESSAGE_REACTION
```json
{ "data": { "key":{"id":"MSG_REAGIDO"}, "reaction": {"text":"❤️"}, "fromMe":false } }
```
Gravar como nova linha `tipo='reaction'`, `reaction_to=key.id`, `reaction=text`.

## PRESENCE_UPDATE
```json
{ "data": { "id":"5511...@s.whatsapp.net", "presences": { "5511...@s.whatsapp.net": { "lastKnownPresence":"composing" } } } }
```
Atualizar `wa_conversa.contato_digitando_ate = now() + 8s` se `composing|recording`.
