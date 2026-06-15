# APOYA Gestão — Padrões de Desenvolvimento (Definition of Done)

Regras nascidas das correções de 06/2026. Toda mudança de tela/função deve segui-las.
São o "feito de verdade" — não só compila, **funciona e não mente**.

## Princípios

1. **Nunca fabricar dado.** Se um registro depende de um cliente/entidade, exija-o
   resolvido antes de gravar. Proibido fallback inventado (ex.: `regime ?? "Simples Nacional"`).
   Cliente não resolvido → erro claro pro usuário, não dado falso no banco.

2. **Erro ≠ zero.** Falha de carregamento NÃO pode virar "0" silencioso. Query core
   que falha deve lançar erro e a tela mostrar estado de erro + "Tentar de novo"
   (ver `useDashboard`). Mock/`DEFAULT` só para esqueleto de loading, nunca como dado real.

3. **Cadastro = modal.** Ação primária de criar/editar abre um Dialog inline no
   contexto. Não navegar para outra rota só para cadastrar. (Geração em lote, tipo
   DAS do mês, pode ser ação direta.)

4. **Persistir de verdade.** "Salvar" grava no banco. Proibido `toast.success` sem
   escrita. Preferências de setor → `departamento_config` via `useDepartamentoConfig`.

5. **Botão morto é proibido.** Sem `onClick={() => {}}`, sem `toast("em breve")` em
   afford clicável. Implemente de verdade ou remova o controle.

6. **Fonte única.** Formatação em `@/lib/format` (`fmtBRL`/`fmtDate`/`fmtDateTime`).
   Não redefinir helpers locais. Lógica repetida → hook/util compartilhado.

7. **Sem código morto.** Componente/hook sem import é removido (recuperável no git).

## Dados / Supabase

- Antes de gravar numa tabela, **confirmar as colunas reais** (REST `select=...&limit=1`
  com a anon key, ou ARQUITETO). `types.ts` pode estar DESATUALIZADO — não confie cego.
- Migration nova: arquivo versionado em `supabase/migrations/` **+** aplicar via ARQUITETO
  **+ verificar por REST** (a CI ainda não aplica migrations). Nunca assumir que aplicou.

## Verificação antes de deploy (obrigatória, nesta ordem)

```
npx tsc --noEmit      # 0 erros de tipo
npm test              # vitest verde
npm run build         # build verde
```
Depois: push `main` (= staging, CI roda os 3) → conferir run verde → tag `vX.Y.Z` (= produção)
→ conferir run verde → conferir HTTP 200 em apoyaproject.zapro.tech.

## Testes

- Lógica pura (formatadores, parsers, cálculos) **tem teste** em `*.test.ts`.
- Bug corrigido vira teste de regressão quando a lógica permite.
- O gate `npm test` no CI barra o deploy se algo quebrar.

## Governança (F1.1)

- Etapas com `requer_aprovacao` exigem aprovação humana — não burlar em automação.
- Ações externas (emitir NFS-e, cobrar, enviar) sempre com auth validada (fail-closed).

## Congelado

- **Focus NF-e**: zero esforço até o Marcio liberar.
