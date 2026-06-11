# Plano Técnico Sprint 1 — Motor Contábil
**Data:** 2026-05-22 · **Status:** APROVADO PARA EXECUÇÃO

## affected_files
```
migrations/
  006_motor_contabil.sql              [CRIAR] — 6 novas tabelas + índices

src/hooks/
  use-cnpj-lookup.ts                  [MODIFICAR] — adicionar enriquecimento SERPRO
  use-cnpj-serpro.ts                  [CRIAR] — hook dedicado ao lookup SERPRO

src/components/
  ClienteFormDialog.tsx               [MODIFICAR] — auto-fill no onBlur + SERPRO enrichment
  cliente/TabFiscal.tsx               [MODIFICAR] — fix stopPropagation em botões internos
  cliente/TabFinanceiro.tsx           [MODIFICAR] — fix stopPropagation
  motor/                              [CRIAR pasta]
    DocumentosFiscaisTab.tsx          [CRIAR] — lista NF entrada/saída classificadas
    ApuracaoMensalCard.tsx            [CRIAR] — card de apuração por competência
    ExtratoBancarioTab.tsx            [CRIAR] — upload e conciliação de extrato

src/routes/
  _app.clientes_.$id.tsx              [MODIFICAR] — adicionar tabs Motor (Documentos, Apuração)
  _app.fiscal.das.tsx                 [MODIFICAR] — fix botões sem stopPropagation
```

## approach
1. Migration SQL — criar tabelas motor sem quebrar tabelas existentes
2. Hook CNPJ enriquecido — BrasilAPI (cadastro) + SERPRO (regime, situação, PGDAS)
3. Auto-fill no onBlur do campo CNPJ (não exigir botão)
4. Fix navegação — todos os botões dentro de contextos clicáveis ganham stopPropagation
5. Tabs de Motor na página do cliente — DocumentosFiscais + ApuracaoMensal
6. Build + validação TypeScript
7. Deploy

## execution_order
1. SQL migration (banco — sem risco de quebrar app)
2. use-cnpj-serpro.ts (hook novo)
3. use-cnpj-lookup.ts (modificar para usar SERPRO como enrichment)
4. ClienteFormDialog.tsx (onBlur auto-fill)
5. Fix stopPropagation nos botões problemáticos
6. Componentes motor (DocumentosFiscaisTab, ApuracaoMensalCard)
7. _app.clientes_.$id.tsx (adicionar tabs motor)
8. Build + fix erros TypeScript
9. Deploy

## acceptance_criteria
- [ ] CNPJ digitado → onBlur → preenche razão social, regime, endereço automaticamente
- [ ] CNPJ MEI → detecta regime MEI + preenche campo regime automaticamente
- [ ] Aba Fiscal → sub-tabs navegam sem sair da página do cliente
- [ ] Botões de ação no hero card não causam navegação indesejada
- [ ] Tabela `documentos_fiscais` existe no Supabase
- [ ] Tabela `lancamentos_contabeis` existe no Supabase
- [ ] Tabela `apuracoes_mensais` existe no Supabase
- [ ] Aba "Documentos Fiscais" visível na página do cliente
- [ ] Build sem erros TypeScript
- [ ] Deploy Cloudflare Workers com sucesso
