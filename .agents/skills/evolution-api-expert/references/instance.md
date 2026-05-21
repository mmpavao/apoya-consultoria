# Instance endpoints

Base: `${EVOLUTION_API_URL}`  · Header: `apikey: ${EVOLUTION_API_KEY}`

## POST /instance/create

```json
{
  "instanceName": "apoya-fiscal",
  "qrcode": true,
  "integration": "WHATSAPP-BAILEYS",
  "webhook": {
    "url": "https://app.com/api/public/evolution-webhook/apoya-fiscal?token=xxx",
    "byEvents": false,
    "base64": false,
    "events": [
      "MESSAGES_UPSERT","MESSAGES_UPDATE","SEND_MESSAGE",
      "CONNECTION_UPDATE","QRCODE_UPDATED",
      "MESSAGE_REACTION","PRESENCE_UPDATE"
    ]
  },
  "rejectCall": false,
  "msgCall": "",
  "groupsIgnore": false,
  "alwaysOnline": false,
  "readMessages": false,
  "readStatus": false,
  "syncFullHistory": false
}
```

Response (resumo):
```json
{
  "instance": { "instanceName":"apoya-fiscal", "status":"created" },
  "hash": { "apikey": "PER_INSTANCE_KEY" },   // pode vir; usar nas próximas chamadas dessa instância (opcional, master também funciona)
  "qrcode": { "code":"data:image/png;base64,..." , "base64":"...", "pairingCode":null }
}
```

## GET /instance/connect/{instanceName}

Força novo QR code (se desconectada). Response: `{ pairingCode, code, base64 }` ou `{ instance: { state:'open' } }` se já conectado.

## GET /instance/connectionState/{instanceName}
`{ instance: { state: 'open' | 'connecting' | 'close' } }`

## GET /instance/fetchInstances?instanceName=...

## DELETE /instance/logout/{instanceName}
Desconecta sem apagar (preserva sessão).

## DELETE /instance/delete/{instanceName}
Apaga instância e credenciais.

## POST /instance/restart/{instanceName}

## POST /settings/set/{instanceName}
```json
{ "reject_call": false, "groups_ignore": false, "always_online": false, "read_messages": false, "read_status": false, "sync_full_history": false }
```

## POST /webhook/set/{instanceName}
Atualiza webhook depois da criação (mesmo schema do `create.webhook`).
