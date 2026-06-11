# SPEC — Pipelines por Setor (Motor Único Configurável)
**Projeto:** APOYA Gestão · **Autor:** Claude Code (aprovado por Marcio Pavão) · **Data:** 11/06/2026 · **Versão:** 1.0

## 1. Objetivo
Cada departamento (Fiscal, Dep. Pessoal, Contábil, Financeiro — e futuramente Societário) ganha um pipeline Kanban com **etapas do seu domínio**, como o Societário já tem hoje. Porém implementado como **UM motor único configurável**, não N módulos duplicados. Humanos e agentes de IA trabalham nas mesmas tarefas, com permissões por setor e aprovação humana nas transições críticas.

## 2. Modelo de dados (Migration 007 — versionada no repo)

### 2.1 Nova tabela `pipeline_config`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid pk | |
| setor | text unique | fiscal, dp, contabil, financeiro, societario |
| nome | text | "Pipeline Fiscal" |
| etapas | jsonb | array ordenado (ver 2.3) |
| ativo | boolean default true | |
| created_at / updated_at | timestamptz | |

### 2.2 Alterações em `tarefas`
- `ADD COLUMN setor text` (nullable; tarefas antigas ficam sem setor e aparecem só no Workflows global)
- `ADD COLUMN etapa_pipeline text` (default = primeira etapa do pipeline do setor, resolvida no handler)
- Índice composto `(setor, etapa_pipeline)`

### 2.3 Formato de cada etapa no jsonb
```json
{
  "key": "pronto_transmitir",
  "label": "Pronto p/ Transmitir",
  "ordem": 4,
  "sla_horas": 24,
  "requer_aprovacao": true,
  "pode_mover": ["humano:fiscal", "agente:agente_fiscal"],
  "pode_aprovar": ["humano:fiscal", "humano:admin"]
}
```
`requer_aprovacao=true` ⇒ agente estaciona a tarefa nesta etapa; só humano com `pode_aprovar` move adiante.

### 2.4 Seeds iniciais
- **fiscal:** A Apurar → Em Apuração → Aguardando Cliente → Pronto p/ Transmitir (aprovação) → Transmitido → Comprovante Arquivado
- **dp:** Coleta de Dados → Folha em Cálculo → Conferência (aprovação) → eSocial Transmitido → Pago/Arquivado
- **contabil:** Importar Extrato → Conciliação → Pendências c/ Cliente → Revisão (aprovação) → Período Fechado
- **financeiro:** Em Dia → Lembrete D-5 → Cobrança D+1 → Negociação → Resolvida

## 3. Backend — MCP e API

### 3.1 Novas tools MCP
- `pipeline_config_listar` (read)
- `tarefas_por_pipeline {setor}` — tarefas agrupadas por etapa (payload pronto p/ kanban)
- `tarefa_mover_etapa {tarefa_id, etapa_destino, ator, ator_tipo}` — valida transição + grava evento

### 3.2 Tools alteradas
- `tarefa_criar` / `tarefa_atualizar`: aceitam `setor`; `etapa_pipeline` default = primeira etapa.

### 3.3 Permissões por setor para agentes
- `mcp_api_keys` ganha coluna `escopo_setores jsonb` (ex.: `["fiscal"]`; `["*"]` = chave master)

## 4. Frontend
- Componente `PipelineKanban` genérico (config-driven via `pipeline_config`)
- Páginas de departamento ganham aba "Pipeline"
- Workflows global = visão agregada CEO/coordenação

## 5. Regras agente ↔ humano
1. Agente cria tarefa já no setor certo, primeira etapa.
2. Agente avança etapas permitidas; em etapa com `requer_aprovacao`, estaciona e comenta.
3. Humano aprova (avança) ou rejeita (devolve com comentário).
4. Toda movimentação gera evento auditável.

## 6. Fases e critérios de aceite
| Fase | Entrega | Aceite |
|---|---|---|
| F1 | Migration 007 + seeds + tools MCP, deploy em staging | Claude Code testa via MCP |
| F2 | PipelineKanban + página Fiscal (piloto) | Marcio valida visualmente |
| F3 | Demais setores + escopo_setores nas API keys | Teste negativo de acesso cruzado |
| F4 (opcional) | Societário migra p/ o motor | Paridade com quadro atual |

**Protocolo:** git-first, staging antes de produção, evidência por fase, OK explícito do Marcio para produção.
