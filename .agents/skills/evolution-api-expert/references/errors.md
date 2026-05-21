# Erros & recuperação

| HTTP | Causa                                       | Ação                                        |
|------|---------------------------------------------|---------------------------------------------|
| 400  | payload inválido (campos faltando)          | Validar com Zod antes de chamar             |
| 401  | apikey ausente/errada                       | Conferir EVOLUTION_API_KEY                  |
| 403  | apikey sem permissão na instância           | Usar master OU apikey daquela instância     |
| 404  | instância não existe                        | Recriar via `/instance/create`              |
| 409  | nome de instância já em uso                 | Mostrar erro ao usuário e exigir outro nome |
| 5xx  | servidor Evolution caiu                     | Retry 3x com backoff exponencial 1/2/4s     |

## Conexão caída

Sintoma: `connectionState.state === 'close'` ou webhook `connection.update` com `close`.

1. Marcar `wa_instance.status='disconnected'`
2. UI mostra botão "Reconectar" → chama `GET /instance/connect/{name}` → novo QR em `QRCODE_UPDATED`
3. Se múltiplas falhas de pareamento (>3 em 1h), recomendar deletar e criar nova instância.

## QR expirado

QR vale ~60s. Webhook `QRCODE_UPDATED` reemite automaticamente enquanto não houver pareamento. UI deve reagir em realtime à coluna `wa_instance.qr_code` (Supabase realtime).

## Mensagem não entregue

`MESSAGES_UPDATE` com `status='ERROR'` → marcar `mensagem_whatsapp.status='erro'`, mostrar ⚠️ no balão.

## Rate limit WhatsApp (não da Evolution)

Não há código HTTP — sintoma é número ser desconectado pelo WhatsApp. Mitigar:
- delay 1–3s entre envios em massa (campo `delay` em `sendText`)
- nunca enviar 100+ msgs em <1min para números frios
- warm-up: instância nova → 20 msgs/dia primeira semana
