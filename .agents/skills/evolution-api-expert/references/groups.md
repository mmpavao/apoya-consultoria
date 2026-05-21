# Groups

## POST /group/create/{instance}
```json
{ "subject":"Time fiscal", "description":"...", "participants":["5511...","5511..."] }
```

## GET /group/fetchAllGroups/{instance}?getParticipants=true
## GET /group/findGroupInfos/{instance}?groupJid=120363xxxx@g.us
## GET /group/participants/{instance}?groupJid=...

## POST /group/updateParticipant/{instance}?groupJid=...
```json
{ "action":"add"|"remove"|"promote"|"demote", "participants":["5511..."] }
```

## POST /group/updateGroupSubject/{instance}?groupJid=...
`{ "subject":"Novo nome" }`

## POST /group/updateGroupDescription/{instance}?groupJid=...
`{ "description":"..." }`

## POST /group/updateGroupPicture/{instance}?groupJid=...
`{ "image":"<base64-or-url>" }`

## GET /group/inviteCode/{instance}?groupJid=...
## POST /group/revokeInviteCode/{instance}?groupJid=...
## POST /group/sendInvite/{instance}
`{ "groupJid":"...", "description":"...", "numbers":["5511..."] }`

## DELETE /group/leaveGroup/{instance}?groupJid=...

## POST /group/toggleEphemeral/{instance}?groupJid=...
`{ "expiration": 0|86400|604800|7776000 }`

## POST /group/updateSetting/{instance}?groupJid=...
`{ "action": "announcement"|"not_announcement"|"locked"|"unlocked" }`
