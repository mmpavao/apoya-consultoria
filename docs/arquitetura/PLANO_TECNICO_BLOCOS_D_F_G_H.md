# PLANO TÉCNICO — Blocos D, F, G, H
**ARQUITETO | 2026-05-19**

---

## ESTADO VERIFICADO (Auditoria pré-plano)

| Bloco | Status | Evidência |
|---|---|---|
| A — Schema banco | ✅ CONCLUÍDO | 394 tabelas, 839 FKs, 1.210 policies, 244 triggers |
| B — Edge Functions | ✅ CONCLUÍDO | 108/108 ACTIVE no Supabase huefciqpcorcvguabtcj |
| C — Refatoração IA | ✅ CONCLUÍDO | 0 refs ao gateway Lovable, 12 funções com GEMINI_API_KEY |

**Ponto de partida para o time:** commit `222bcac8` no `mmpavao/genpro360-clone`

---

## BLOCO D — Configuração de Auth
**Agente responsável:** BACK-END DEV
**Aguarda:** Marcio fornecer credenciais Google OAuth + RESEND_API_KEY

```json
{
  "bloco": "D",
  "titulo": "Configuração de Auth no Supabase destino",
  "agente": "BACK-END DEV",
  "pre_requisitos": [
    "Google OAuth Client ID + Secret (Marcio fornece)",
    "RESEND_API_KEY (Marcio fornece)"
  ],
  "affected_files": [
    "supabase/config.toml (referência — configuração é via Dashboard/API)"
  ],
  "approach": [
    "D.1 — Habilitar Google OAuth via Supabase Management API (POST /v1/projects/{ref}/config/auth)",
    "D.2 — Configurar SMTP Resend via Management API (host: smtp.resend.com, port: 465)",
    "D.3 — Registrar auth hook: auth-email-hook como 'send email' hook no Dashboard",
    "D.4 — Configurar redirect URLs: https://genpro360-clone.pages.dev/**, http://localhost:5173/**"
  ],
  "execution_order": ["D.1", "D.2", "D.3", "D.4"],
  "acceptance_criteria": [
    "Login com Google OAuth redireciona corretamente para o dashboard",
    "E-mail de convite é enviado via Resend (verificar logs da Edge Function auth-email-hook)",
    "E-mail de recuperação de senha é entregue",
    "Redirect URLs não geram erro de 'invalid redirect'"
  ],
  "bloqueadores": [
    "AGUARDA: Google OAuth Client ID + Secret",
    "AGUARDA: RESEND_API_KEY"
  ]
}
```

---

## BLOCO F — Migração de Dados
**Agente responsável:** BACK-END DEV
**Aguarda:** Marcio fornecer service_role do Supabase ORIGEM (nxsbiddnaeatnjczouye)

```json
{
  "bloco": "F",
  "titulo": "Migração de dados da origem para o destino",
  "agente": "BACK-END DEV",
  "pre_requisitos": [
    "GENPRO_ORIGEM_SERVICE_ROLE_KEY (Marcio fornece — projeto nxsbiddnaeatnjczouye)",
    "Bloco D concluído (auth deve estar configurado antes de importar users)"
  ],
  "affected_files": [
    "scripts/migrate-auth-users.ts (criar)",
    "scripts/migrate-public-data.ts (criar)",
    "scripts/migrate-storage-urls.ts (criar)"
  ],
  "approach": [
    "F.1 — Exportar auth.users da origem via Management API (/v1/projects/nxsbiddnaeatnjczouye/auth/users)",
    "F.2 — Importar usuários no destino preservando UUIDs (via Admin API)",
    "F.3 — Exportar tabelas public.* via service_role REST (ordem respeitando FKs)",
    "F.4 — Importar no destino desabilitando triggers temporariamente (session_replication_role=replica)",
    "F.5 — Atualizar URLs de storage: substituir nxsbiddnaeatnjczouye por huefciqpcorcvguabtcj em todas as colunas de URL",
    "F.6 — Configurar vault secret email_queue_service_role_key no destino",
    "F.7 — Sincronizar arquivos de storage bucket a bucket via signed URLs"
  ],
  "execution_order": ["F.1", "F.2", "F.3", "F.4", "F.5", "F.6", "F.7"],
  "acceptance_criteria": [
    "Contagem de registros por tabela: destino >= 95% da origem (tolerância para dados em trânsito)",
    "Nenhum UUID quebrado (FKs íntegras após importação)",
    "URLs de storage resolvem no bucket do destino",
    "Usuários conseguem logar com senha existente"
  ],
  "bloqueadores": [
    "AGUARDA: GENPRO_ORIGEM_SERVICE_ROLE_KEY",
    "DEPENDE: Bloco D concluído"
  ]
}
```

---

## BLOCO G — Cutover do Frontend
**Agente responsável:** FRONT-END DEV
**Depende:** Blocos D e F concluídos

```json
{
  "bloco": "G",
  "titulo": "Apontar frontend para o Supabase destino",
  "agente": "FRONT-END DEV",
  "pre_requisitos": [
    "Bloco D concluído (auth configurado)",
    "Bloco F concluído (dados migrados)"
  ],
  "affected_files": [
    ".env.production (atualizar 3 variáveis)",
    "src/integrations/supabase/types.ts (regenerar via CLI)",
    "src/integrations/supabase/client.ts (verificar se usa env vars — não hardcode)"
  ],
  "approach": [
    "G.1 — Atualizar .env.production: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PROJECT_ID",
    "G.2 — Regenerar types.ts: npx supabase gen types typescript --project-id huefciqpcorcvguabtcj",
    "G.3 — Verificar client.ts: confirmar que não há hardcode de URL/key do projeto origem",
    "G.4 — Build de produção: npm run build && verificar ausência de erros de tipo",
    "G.5 — Deploy no Cloudflare Pages apontando para novo destino"
  ],
  "execution_order": ["G.1", "G.2", "G.3", "G.4", "G.5"],
  "acceptance_criteria": [
    "Build sem erros de TypeScript",
    "Login funciona no ambiente de staging (genpro360-clone.pages.dev)",
    "Nenhuma chamada vai para nxsbiddnaeatnjczouye (verificar Network tab)",
    "100% das chamadas vão para huefciqpcorcvguabtcj"
  ],
  "bloqueadores": [
    "DEPENDE: Bloco D concluído",
    "DEPENDE: Bloco F concluído"
  ]
}
```

---

## BLOCO H — Validação Final (QA)
**Agente responsável:** QA TESTER
**Depende:** Bloco G concluído

```json
{
  "bloco": "H",
  "titulo": "Smoke tests e validação end-to-end",
  "agente": "QA TESTER",
  "pre_requisitos": [
    "Bloco G concluído (frontend apontando para destino)"
  ],
  "affected_files": [
    "incoming_files/genpro360-migration/07-validation/smoke-tests.sql (executar)",
    "incoming_files/genpro360-migration/07-validation/checklist.md (seguir)"
  ],
  "approach": [
    "H.1 — Executar smoke-tests.sql no Supabase destino e comparar contagens com origem",
    "H.2 — Testar fluxo de login: email/senha + Google OAuth",
    "H.3 — Testar operações críticas: criar empresa, convidar usuário, emitir NF",
    "H.4 — Testar integrações: Stripe (checkout), upload de arquivo, envio de e-mail",
    "H.5 — Verificar cron jobs ativos (16 jobs devem aparecer no pg_cron)",
    "H.6 — Verificar Edge Functions: chamar cada função crítica e confirmar resposta 200"
  ],
  "execution_order": ["H.1", "H.2", "H.3", "H.4", "H.5", "H.6"],
  "acceptance_criteria": [
    "smoke-tests.sql: 0 falhas",
    "Login email/senha: sucesso em < 3s",
    "Login Google OAuth: sucesso com redirect correto",
    "Criação de empresa: persiste no banco sem erro",
    "Convite de usuário: e-mail entregue via Resend",
    "Upload de arquivo: URL acessível no bucket do destino",
    "Todos os 16 cron jobs: status active no pg_cron"
  ],
  "bloqueadores": [
    "DEPENDE: Bloco G concluído"
  ]
}
```

---

## FLUXO DE DELEGAÇÃO

```
ARQUITETO
    │
    ├── [AGUARDA CREDENCIAIS DO MARCIO]
    │       Google OAuth + RESEND_API_KEY → libera Bloco D
    │       service_role origem → libera Bloco F
    │
    ├── Bloco D → BACK-END DEV → revisão ARQUITETO → QA valida
    │
    ├── Bloco F → BACK-END DEV → revisão ARQUITETO → QA valida contagens
    │
    ├── Bloco G → FRONT-END DEV → revisão ARQUITETO → QA valida network
    │
    └── Bloco H → QA TESTER → relatório final → ARQUITETO emite veredicto
```

---

## CRITÉRIO DE CUTOVER PARA PRODUÇÃO

Só após H concluído com 0 falhas, o ARQUITETO emite **APROVADO ✅** e Marcio decide o momento do cutover em www.genpro360.com.

A produção atual (Lovable Cloud) permanece **INTOCÁVEL** até esse momento.
