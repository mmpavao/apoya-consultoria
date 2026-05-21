---
name: evolution-api-expert
description: Reference for integrating with Evolution API v2 (WhatsApp). Use whenever building or debugging features that call evolution endpoints (instance management, QR code, sending text/media/audio/reactions/replies, groups, presence, webhooks). Triggers on terms like "evolution api", "whatsapp instance", "QR code whatsapp", "send media whatsapp", "evolution webhook".
---

# Evolution API v2 — Expert

Self-hosted (or managed) WhatsApp gateway based on Baileys. Auth via header `apikey`. Multi-instance: each WhatsApp number = 1 "instance" identified by `instanceName`.

## Base URL & Auth

- `EVOLUTION_API_URL` (sem trailing slash) — ex.: `https://evo.dominio.com`
- `EVOLUTION_API_KEY` — apikey master (administra todas as instâncias) OU apikey por instância
- Todo request: `Content-Type: application/json` + `apikey: <KEY>`
- Erros: HTTP 401/403 = apikey errada; 404 = instância não existe; 400 = payload inválido (resposta inclui `message` array).

## Tópicos disponíveis

Detalhes nos arquivos abaixo (carregue sob demanda):
- `references/instance.md` — criar / conectar / status / deletar / settings / set webhook
- `references/messages.md` — text, media (image/video/document/audio/sticker), reaction, reply, presence, mark as read
- `references/groups.md` — create, update participants, fetch all, invite codes
- `references/webhooks.md` — eventos, formato dos payloads, validação
- `references/errors.md` — códigos comuns + recuperação

## Padrão TanStack desta codebase

- **Backend**: `src/integrations/evolution/client.server.ts` é o único lugar que toca a Evolution. Função `evo(method, path, body?, instanceApiKey?)` retorna JSON tipado.
- **Server functions**: `src/lib/whatsapp/*.functions.ts` (createServerFn). NUNCA importar `client.server.ts` em componente.
- **Webhook único**: `src/routes/api/public/evolution-webhook/$instance.ts` validado por `webhook_token` (query `?token=`).
- **DB**: `wa_instance`, `wa_conversa`, `mensagem_whatsapp` (estendida). Realtime habilitado.
- **Mídia recebida**: baixar via `chat/getBase64FromMediaMessage`, gravar no bucket `whatsapp-media`.

## Decisões fixas

- **Webhook URL** é gerado pelo backend no momento do `createInstance` — usuário NÃO digita.
  Formato: `${PUBLIC_BASE_URL}/api/public/evolution-webhook/<instanceName>?token=<webhook_token>`.
- **Eventos assinados** (mínimo): `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `SEND_MESSAGE`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`, `MESSAGE_REACTION`, `PRESENCE_UPDATE`.
- **Departamento + agente**: ao enviar manual, prefixar conteúdo com `*[Setor — Nome do Agente]*` para o cliente identificar quem está atendendo.
- **Typing**: chamar `chat/sendPresence` com `presence: composing` antes do envio real, depois `paused`.

## Pitfalls testados

- `instanceName` precisa ser único, sem espaços, ASCII, lowercase. Validar com `^[a-z0-9_-]{3,40}$`.
- `connectionState` retorna `{state: 'open'|'connecting'|'close'}` — mapear para `connected|connecting|disconnected`.
- Após `create`, o QR vem em **2 lugares**: response inicial (se `qrcode:true`) e via webhook `QRCODE_UPDATED`. Confiar no webhook, response inicial pode estar vazio.
- `MESSAGES_UPSERT` chega TANTO para mensagens recebidas quanto enviadas pelo próprio número (campo `key.fromMe: true`). Filtrar `fromMe` para não duplicar o que já gravamos no `sendText`.
- IDs Evolution: `key.id` (msg id) é o que serve para reply/reaction.
- Mídia em base64 pode ser ENORME; só salvar no Storage, nunca no JSONB.
