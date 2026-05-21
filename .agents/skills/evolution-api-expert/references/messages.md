# Message endpoints

Header `apikey: <KEY>`. Path inclui `{instanceName}`.

`number` é E.164 sem `+` (ex.: `5511999990000`). Para grupo: `120363xxxx@g.us`.

## POST /message/sendText/{instance}
```json
{
  "number": "5511999990000",
  "text": "Olá!",
  "delay": 0,
  "linkPreview": true,
  "quoted": { "key": { "id": "MSG_ID_TO_REPLY" } }   // opcional (reply)
}
```

## POST /message/sendMedia/{instance}
```json
{
  "number": "5511999990000",
  "mediatype": "image",                  // image | video | document
  "mimetype": "image/jpeg",
  "caption": "Segue boleto",
  "media": "https://...",                // URL pública OU base64
  "fileName": "boleto.pdf",
  "quoted": { "key": { "id":"..."} }
}
```

## POST /message/sendWhatsAppAudio/{instance}
```json
{ "number":"5511...", "audio":"<base64-or-url>", "encoding": true }
```
(`encoding: true` força PTT — bolinha azul de áudio).

## POST /message/sendSticker/{instance}
```json
{ "number":"5511...", "sticker":"<base64-or-url-webp>" }
```

## POST /message/sendReaction/{instance}
```json
{
  "reactionMessage": {
    "key": { "remoteJid":"5511...@s.whatsapp.net", "fromMe":false, "id":"MSG_ID" },
    "reaction": "👍"
  }
}
```
Para remover reação: `reaction: ""`.

## POST /chat/sendPresence/{instance}
```json
{ "number":"5511...", "presence":"composing", "delay": 1200 }
```
`presence`: `composing` (digitando), `recording` (gravando áudio), `paused`, `available`, `unavailable`.

## POST /chat/markMessageAsRead/{instance}
```json
{ "readMessages": [ { "remoteJid":"5511...@s.whatsapp.net", "fromMe":false, "id":"MSG_ID" } ] }
```

## POST /chat/whatsappNumbers/{instance}
```json
{ "numbers": ["5511...","5511..."] }
```
Response: `[{ exists:true, jid:"5511...@s.whatsapp.net", number:"5511..." }, ...]`

## POST /chat/getBase64FromMediaMessage/{instance}
```json
{ "message": { "key": { "id":"MSG_ID" } }, "convertToMp4": false }
```
Response: `{ mediaType, fileName, base64, mimetype, size }`.

## DELETE /message/deleteMessage/{instance}
```json
{ "id":"MSG_ID", "remoteJid":"...", "fromMe": true, "participant": null }
```
