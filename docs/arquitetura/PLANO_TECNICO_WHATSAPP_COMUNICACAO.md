# PLANO TÉCNICO — MÓDULO WHATSAPP BUSINESS (COMUNICAÇÃO)
**Emitido por:** ARQUITETO
**Data:** 2026-05-20 — v2.0 (features avançadas validadas na documentação oficial)
**Status:** ✅ APROVADO

---

## VALIDAÇÃO DA EVOLUTION API (docs lidos em 2026-05-20)

Todos os recursos abaixo têm endpoint confirmado na Evolution API v2 (Baileys):

| Feature | Endpoint | Status |
|---|---|---|
| Envio texto | POST /message/sendText | ✅ |
| Envio imagem/vídeo/documento | POST /message/sendMedia | ✅ |
| Envio áudio PTT (nativo WA) | POST /message/sendWhatsAppAudio | ✅ |
| Envio sticker | POST /message/sendSticker | ✅ |
| Reação emoji | POST /message/sendReaction | ✅ |
| Responder mensagem (quoted) | campo `quoted` em qualquer envio | ✅ |
| Deletar para todos | DELETE /chat/deleteMessageForEveryone | ✅ |
| "Digitando..." outbound | POST /chat/sendPresence | ✅ |
| "Digitando..." inbound | webhook PRESENCE_UPDATE | ✅ |
| Arquivar conversa | POST /chat/archiveChat | ✅ |
| Grupos — criar/editar/membros | POST /group/* | ✅ |
| Grupos — buscar todos | GET /group/fetchAllGroups | ✅ |
| Fixar conversa | ❌ não existe na Evolution v2 — simular via metadata no banco | — |

---

## AFFECTED FILES (completo — v2)

```
MIGRATIONS (2):
  supabase/migrations/20260520_010_whatsapp_instances.sql   ← já entregue pelo BACK-END DEV
  supabase/migrations/20260520_011_whatsapp_advanced.sql    ← NOVO — reactions, groups, quoted

EDGE FUNCTIONS (5):
  supabase/functions/whatsapp-webhook/index.ts     ← CRUD eventos + presence + reactions + groups
  supabase/functions/whatsapp-instance/index.ts    ← CRUD instâncias + QR
  supabase/functions/whatsapp-send/index.ts        ← envio (text + media + audio + quoted + presence)
  supabase/functions/whatsapp-reaction/index.ts    ← NOVO — enviar/remover reação
  supabase/functions/whatsapp-groups/index.ts      ← NOVO — gestão de grupos

FRONTEND — Settings:
  src/pages/settings/tabs/WhatsAppTab.tsx
  src/components/whatsapp/InstanceCard.tsx
  src/components/whatsapp/AddInstanceModal.tsx
  src/components/whatsapp/QRCodeModal.tsx
  src/hooks/useWhatsAppInstances.ts

FRONTEND — Inbox:
  src/pages/communication/WhatsAppInbox.tsx
  src/components/whatsapp/ConversationList.tsx
  src/components/whatsapp/ConversationChat.tsx
  src/components/whatsapp/ContactPanel.tsx
  src/components/whatsapp/MessageBubble.tsx         ← NOVO — bubble com reações, quoted, status
  src/components/whatsapp/MessageInput.tsx          ← NOVO — input completo (quoted, emoji, anexos)
  src/components/whatsapp/TypingIndicator.tsx       ← NOVO — "digitando..." animado
  src/components/whatsapp/EmojiPicker.tsx           ← NOVO — picker de emojis e reações
  src/components/whatsapp/GroupsPanel.tsx           ← NOVO — gestão de grupos
  src/hooks/useWhatsAppConversations.ts
  src/hooks/useWhatsAppMessages.ts
  src/hooks/useWhatsAppPresence.ts                  ← NOVO — estado digitando
  src/hooks/useWhatsAppGroups.ts                    ← NOVO — grupos
```

---

## MIGRATION T2 — `20260520_011_whatsapp_advanced.sql`

```sql
BEGIN;

-- Quoted message reference em crm_messages
ALTER TABLE public.crm_messages
  ADD COLUMN IF NOT EXISTS quoted_message_id uuid REFERENCES public.crm_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quoted_content   text,
  ADD COLUMN IF NOT EXISTS quoted_type      text,
  ADD COLUMN IF NOT EXISTS reaction_summary jsonb DEFAULT '{}',  -- { "👍": 3, "❤️": 1 }
  ADD COLUMN IF NOT EXISTS is_deleted       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at       timestamptz;

-- Reações individuais (para mostrar quem reagiu)
CREATE TABLE public.whatsapp_reactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      uuid NOT NULL REFERENCES public.crm_messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reactor_jid     text NOT NULL,   -- número whatsapp de quem reagiu
  reactor_name    text,
  emoji           text NOT NULL,
  reacted_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_wa_reactions_unique
  ON public.whatsapp_reactions(message_id, reactor_jid);
CREATE INDEX idx_wa_reactions_message ON public.whatsapp_reactions(message_id);

ALTER TABLE public.whatsapp_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_reactions_select ON public.whatsapp_reactions FOR SELECT TO authenticated
  USING (public.has_company_role(auth.uid(), company_id,
    ARRAY['owner','admin','manager','member','viewer','accountant']::app_role[]));

CREATE POLICY wa_reactions_manage ON public.whatsapp_reactions FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), company_id,
    ARRAY['owner','admin','manager','member']::app_role[]));

-- Grupos WhatsApp
CREATE TABLE public.whatsapp_groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  instance_id         uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  group_jid           text NOT NULL,  -- ex: 120363xxxxxx@g.us
  name                text NOT NULL,
  description         text,
  picture_url         text,
  participant_count   integer DEFAULT 0,
  is_admin            boolean DEFAULT false,
  creation_ts         bigint,
  synced_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_wa_groups_jid ON public.whatsapp_groups(instance_id, group_jid);
CREATE INDEX idx_wa_groups_company ON public.whatsapp_groups(company_id);

ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_groups_select ON public.whatsapp_groups FOR SELECT TO authenticated
  USING (public.has_company_role(auth.uid(), company_id,
    ARRAY['owner','admin','manager','member','viewer']::app_role[]));

CREATE POLICY wa_groups_manage ON public.whatsapp_groups FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), company_id,
    ARRAY['owner','admin']::app_role[]));

-- Arquivamento e fixar (simulado — sem suporte nativo Evolution para pin)
ALTER TABLE public.crm_conversations
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at   timestamptz;

COMMIT;
```

---

## EDGE FUNCTION — `whatsapp-send` (versão completa v2)

### Body completo:
```typescript
{
  conversation_id: string,
  company_id: string,
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker',
  content?: string,           // texto ou caption
  media_url?: string,         // URL pública para mídia
  media_filename?: string,    // para documents
  mimetype?: string,          // ex: 'image/png', 'audio/ogg'
  quoted_message_id?: string, // UUID do crm_message a responder
  quoted_external_id?: string // external_id da mensagem a citar na Evolution API
}
```

### Fluxo completo:
```typescript
// 1. Buscar conversation → instance → instanceName
// 2. Buscar contact → phone (remover +)
// 3. Montar quoted se presente:
//    quoted = { key: { remoteJid: phone+'@s.whatsapp.net', fromMe: false, id: quoted_external_id } }

// 4. SEMPRE chamar sendPresence ANTES de texto (simula "digitando..."):
//    POST /chat/sendPresence/{instanceName}
//    { number: phone, options: 'composing', delay: 1200 }

// 5. Enviar por tipo:
//    text → POST /message/sendText/{instanceName}
//           { number, text: content, quoted?, delay: 1200 }
//
//    image/video/document → POST /message/sendMedia/{instanceName}
//           { number, mediatype, mimetype, media: media_url, caption, fileName, quoted? }
//
//    audio → POST /message/sendWhatsAppAudio/{instanceName}
//           { number, audio: media_url, quoted? }
//           (audio PTT — aparece como mensagem de voz nativa)
//
//    sticker → POST /message/sendSticker/{instanceName}
//           { number, sticker: media_url }

// 6. INSERT crm_messages com todos os campos
// 7. UPDATE crm_conversations
```

---

## EDGE FUNCTION — `whatsapp-reaction`

```typescript
// POST body:
{
  conversation_id: string,
  company_id: string,
  message_external_id: string,  // external_id do crm_message
  contact_jid: string,           // remoteJid da conversa
  emoji: string,                 // "👍" | "" (string vazia = remover reação)
  instance_id: string
}

// Lógica:
// POST /message/sendReaction/{instanceName}
// { key: { remoteJid: contact_jid, fromMe: true, id: message_external_id }, reaction: emoji }

// Atualizar banco:
// Se emoji != "": UPSERT whatsapp_reactions
// Se emoji == "": DELETE FROM whatsapp_reactions WHERE message_id=? AND reactor_jid=bot_jid
// Recalcular reaction_summary e UPDATE crm_messages.reaction_summary
```

---

## EDGE FUNCTION — `whatsapp-groups`

```typescript
// Actions:
// action=sync → GET /group/fetchAllGroups/{instanceName}?getParticipants=false
//               UPSERT whatsapp_groups, retornar lista

// action=get_members → GET /group/participants/{instanceName}?groupJid=xxx@g.us

// action=create → POST /group/create/{instanceName}
//                 { subject, participants: ["5511...@s.whatsapp.net"] }

// action=update → POST /group/updateSubject | updateDescription | updatePicture

// action=add_member → POST /group/updateParticipant/{instanceName}
//                     { groupJid, action: "add", participants: [...] }

// action=remove_member → action: "remove"
// action=promote → action: "promote" (tornar admin)
// action=demote → action: "demote"

// action=leave → DELETE /group/leaveGroup/{instanceName} { groupJid }

// action=get_invite → GET /group/inviteCode/{instanceName}?groupJid=xxx
// action=revoke_invite → POST /group/revokeInviteCode/{instanceName} { groupJid }
// action=join_by_code → GET /group/findGroupInfosByInviteCode/{instanceName}?inviteCode=xxx
```

---

## EDGE FUNCTION — `whatsapp-webhook` (eventos adicionais v2)

### `MESSAGES_REACTION` (reação recebida de contato):
```typescript
// data.reaction.key.id = ID da mensagem reagida
// data.reaction.text = emoji (ou "" para remover)
// Buscar crm_message por external_id=data.reaction.key.id
// UPSERT whatsapp_reactions com reactor_jid=remoteJid
// Recalcular e UPDATE crm_messages.reaction_summary
// Emitir Realtime para frontend atualizar bubble
```

### `PRESENCE_UPDATE` ("digitando..." de contato):
```typescript
// data.presences[jid].lastKnownPresence: 'composing' | 'paused' | 'available'
// NÃO persistir no banco — emitir via Supabase Realtime broadcast
// Canal: 'presence:{conversation_id}'
// Payload: { typing: true|false, contact_jid, timestamp }
```

### `MESSAGES_UPDATE` (status de entrega/leitura):
```typescript
// data[].key.id = external_id
// data[].update.status: 2=sent, 3=delivered, 4=read
// UPDATE crm_messages:
//   status=2 → status='sent'
//   status=3 → status='delivered', delivered_at=now()
//   status=4 → status='read', read_at=now()
// Emitir Realtime para atualizar ticks no frontend (✓ ✓✓ ✓✓azul)
```

### `MESSAGES_DELETE`:
```typescript
// UPDATE crm_messages SET is_deleted=true, deleted_at=now() WHERE external_id=?
```

### `CHATS_UPDATE` (arquivamento):
```typescript
// data.archive=true → UPDATE crm_conversations SET is_archived=true
```

### `GROUPS_UPSERT` / `GROUP_UPDATE`:
```typescript
// UPSERT whatsapp_groups com novos dados
```

### `GROUP_PARTICIPANTS_UPDATE`:
```typescript
// UPDATE whatsapp_groups SET participant_count = novo valor
// action: 'add'|'remove'|'promote'|'demote'
```

---

## FRONTEND — COMPONENTES AVANÇADOS

### `MessageBubble.tsx`

```typescript
interface MessageBubbleProps {
  message: {
    id: string
    direction: 'inbound' | 'outbound'
    message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker'
    content: string
    media_url?: string
    media_filename?: string
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
    sent_at: string
    is_deleted: boolean
    quoted_message_id?: string
    quoted_content?: string
    quoted_type?: string
    reaction_summary: Record<string, number>  // { "👍": 2 }
    external_id: string
    ai_generated: boolean
  }
  onReact: (messageId: string, externalId: string, emoji: string) => void
  onReply: (message) => void
  onDelete: (externalId: string) => void
}
```

**Elementos visuais:**
- Quoted block: fundo levemente diferente, ícone de resposta, preview de 1 linha do conteúdo citado
- Status ticks (outbound):
  - `sent` → ✓ cinza
  - `delivered` → ✓✓ cinza
  - `read` → ✓✓ azul
- Mensagem deletada: "🚫 Mensagem apagada" em itálico
- Reações: chips pequenos abaixo da bolha `{ emoji }{ count }` — clicável para reagir/remover
- Hover: aparece barra de ações (Responder | Reagir | ⋮)
- Tipos de mídia:
  - image: `<img>` com lightbox
  - video: `<video controls>`
  - audio: player customizado com waveform fake (barras animadas) + timer
  - document: ícone 📄 + nome do arquivo + botão download
  - sticker: `<img>` sem fundo (WebP transparente)
- Badge "IA" em mensagens outbound com `ai_generated=true`

---

### `MessageInput.tsx`

```typescript
interface MessageInputProps {
  quotedMessage?: Message   // mensagem sendo respondida
  onSend: (payload) => void
  onClearQuote: () => void
  disabled: boolean         // true quando assigned_mode='bot'
}
```

**Elementos:**
- Preview de quoted: faixa verde topo do input com preview + X para limpar
- Textarea: Enter envia, Shift+Enter quebra linha
- Botões:
  - [📎] → input file → aceita image/*, video/*, audio/*, .pdf, .doc, .xlsx, .zip
  - [😀] → abre EmojiPicker
  - [🎤] → toggle modo gravação de áudio (Web Audio API → blob → upload → PTT)
  - [➤] → enviar (verde, sempre visível)
- Ao selecionar arquivo: preview miniatura (image) ou nome (doc) + X cancelar
- Ao gravar áudio: botão vira vermelho + timer + ✓ enviar | ✕ cancelar

---

### `TypingIndicator.tsx`

```typescript
// Exibir quando presença do contato = 'composing'
// Animação: 3 bolinhas pulsando (CSS keyframes)
// Posição: dentro da área de mensagens, antes do fim do scroll

// Hook useWhatsAppPresence:
// Supabase Realtime broadcast channel: 'presence:{conversation_id}'
// .on('broadcast', { event: 'typing' }, ({ payload }) => {
//   setIsTyping(payload.typing)
//   // auto-clear após 5s sem atualização
// })
```

---

### `EmojiPicker.tsx`

```typescript
// Usar biblioteca: emoji-mart (https://github.com/missive/emoji-mart)
// ou fallback: grid de emojis mais usados (👍❤️😂😮😢😡🙏)

// Duas instâncias de uso:
// 1. Input de mensagem — inserir emoji no texto
// 2. Hover na MessageBubble — escolher reação rápida

// Reação rápida: barra de 6 emojis populares inline
//   👍 ❤️ 😂 😮 😢 🙏
// + botão ⊕ abre picker completo
```

---

### `GroupsPanel.tsx`

```typescript
// Aba adicional no inbox: "Grupos"
// Lista de whatsapp_groups por instance_id
// Actions: Sincronizar grupos, Ver membros, Enviar mensagem no grupo
// Criar grupo: modal com nome + campo adicionar participantes (busca em crm_contacts)
// Ao clicar em grupo: abre conversa com channel_contact_id=group_jid
```

---

## CRITÉRIOS DE ACEITE — FEATURES AVANÇADAS

### Mensagens:
- [ ] Responder mensagem: quoted aparece na bolha com preview do conteúdo original
- [ ] Áudio PTT: gravado no browser, enviado como sendWhatsAppAudio, aparece como mensagem de voz
- [ ] Imagem/vídeo recebido: renderiza inline com lightbox ao clicar
- [ ] Documento: mostra ícone + nome + botão download (não tenta renderizar)
- [ ] Mensagem deletada: exibe "🚫 Mensagem apagada" no lugar do conteúdo

### Status (ticks):
- [ ] ✓ cinza após envio (sent)
- [ ] ✓✓ cinza após entrega (delivered)
- [ ] ✓✓ azul após leitura (read)
- [ ] Atualização em tempo real via Realtime sem refresh

### Reações:
- [ ] Hover na bolha mostra barra: 👍 ❤️ 😂 😮 😢 🙏 + ⊕
- [ ] Clicar emoji: chama whatsapp-reaction, aparece chip abaixo da bolha
- [ ] Clicar emoji já selecionado: remove reação
- [ ] Reação recebida de contato: aparece via Realtime no chip da bolha

### Digitando:
- [ ] Contato digitando → animação 3 bolinhas aparece no chat
- [ ] Desaparece automaticamente após 5s sem update ou quando mensagem chega
- [ ] Outbound: sendPresence 'composing' chamado 1.2s antes de cada envio automático (bot)

### Grupos:
- [ ] Listar grupos sincronizados com a instância
- [ ] Botão "Sincronizar" busca grupos novos via Evolution API
- [ ] Criar grupo com nome + participantes
- [ ] Enviar mensagem em grupo (mesmo fluxo de conversa, channel_contact_id = group_jid @g.us)
- [ ] Ver membros do grupo

### Arquivamento:
- [ ] Botão arquivar: move conversa para aba "Arquivadas"
- [ ] Botão fixar: marca is_pinned=true, conversa aparece no topo da lista
- [ ] Fixadas aparecem com 📌 na lista

---

## ORDEM DE EXECUÇÃO (atualizada)

```
1. [BACK-END] T1 migration ← ✅ CONCLUÍDA (BACK-END DEV confirmou)
2. [BACK-END] T2 migration (20260520_011_whatsapp_advanced.sql)
3. [BACK-END] EF whatsapp-webhook v2 (inclui reactions, presence, status, groups)
4. [BACK-END] EF whatsapp-instance
5. [BACK-END] EF whatsapp-send v2 (com quoted + sendPresence + PTT)
6. [BACK-END] EF whatsapp-reaction
7. [BACK-END] EF whatsapp-groups
8. [FRONT-END] Settings tab WhatsApp (InstanceCard + QRCodeModal)
9. [FRONT-END] MessageBubble (quoted, reactions, status ticks, tipos de mídia)
10. [FRONT-END] MessageInput (emoji, quote, gravação áudio, anexos)
11. [FRONT-END] TypingIndicator + useWhatsAppPresence
12. [FRONT-END] WhatsAppInbox montagem final 3 painéis
13. [FRONT-END] GroupsPanel
14. [QA] Smoke tests AC-1 a AC-6 + features avançadas
15. [Márcio] Criar instância, escanear QR, testar envio completo
```

---

## DEPENDÊNCIAS npm NECESSÁRIAS (FRONT-END)

```json
"emoji-mart": "^5.6.0",
"@emoji-mart/data": "^1.2.1",
"@emoji-mart/react": "^1.1.1"
```

Alternativa sem dependência: implementar picker simples com grid de emojis fixos (mais leve).
