# APOYA Gestão — PRD para Lovable
**Versão:** 1.0  
**Data:** 2026-05-20  
**Preparado por:** ARQUITETO  
**Destinado a:** Wilson APOYA (para colar no Lovable e gerar o protótipo)  

---

## ⚠️ INSTRUÇÕES CRÍTICAS PARA WILSON ANTES DE COMEÇAR

### O que o Lovable vai tentar fazer de errado (e como impedir)

**PROBLEMA 1 — Lovable vai querer usar Supabase Cloud (próprio dele)**
→ **IMPEÇA.** Conecte MANUALMENTE o projeto Supabase da APOYA (ID: a ser criado) nas configurações do projeto Lovable ANTES de gerar qualquer código. Nunca deixe o Lovable criar um Supabase novo.

**PROBLEMA 2 — Lovable vai gerar Edge Functions sem autenticação**
→ 8 em cada 9 apps gerados por IA têm Edge Functions abertas na internet sem nenhuma verificação de quem está chamando. Qualquer pessoa com a URL pode invocar com permissões de admin.
→ Sempre exija no prompt: *"Todas as Edge Functions devem verificar o JWT do usuário via Authorization header antes de qualquer operação"*

**PROBLEMA 3 — Lovable vai desabilitar RLS (Row Level Security)**
→ O maior erro de segurança. Com RLS desabilitado, usuário A pode ver dados do usuário B.
→ Sempre exija: *"RLS deve estar habilitado em todas as tabelas. Nunca usar service_role key no frontend"*

**PROBLEMA 4 — Lovable vai expor a anon key em variáveis de ambiente visíveis**
→ A SUPABASE_ANON_KEY é pública por design. A SERVICE_ROLE_KEY nunca deve aparecer no frontend.
→ Sempre exija: *"SERVICE_ROLE_KEY só pode ser usada em Edge Functions server-side, nunca no cliente React"*

**PROBLEMA 5 — Lovable vai tentar fazer tudo de uma vez e quebrar**
→ Resultado: código inconsistente, banco quebrado, rollback impossível.
→ Estratégia: um módulo por vez, na ordem M1 → M2 → M3 → M4 → M5 → M6 → M7. Só avance quando o anterior estiver aprovado.

**PROBLEMA 6 — Lovable vai conectar ao Supabase ANTES do frontend estar estável**
→ Se reverter o código depois do Supabase conectado, o schema do banco quebra e não reverte junto.
→ Estratégia: construir o frontend com dados mockados primeiro. Conectar Supabase apenas depois que a UI estiver aprovada visualmente.

**PROBLEMA 7 — Lovable vai usar localStorage para guardar tokens**
→ Vulnerabilidade XSS. O Supabase Auth gerencia tokens automaticamente via cookies httpOnly.
→ Sempre exija: *"Usar Supabase Auth nativo. Não armazenar tokens em localStorage manualmente"*

---

## KNOWLEDGE FILE — Cole isso no campo "Knowledge" do projeto Lovable

```
# APOYA Gestão — Knowledge File

## O que é este projeto
Sistema de gestão contábil para o escritório APOYA Contabilidade.
Substitui processos manuais repetitivos: geração de DAS, emissão de NFS-e, 
envio de documentos via WhatsApp e controle de inadimplência.
75 clientes ativos. Operado por Daniel Araújo e equipe interna.
Clientes NÃO acessam o sistema — é exclusivo para uso interno do escritório.

## Stack obrigatória
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Supabase (PostgreSQL + Edge Functions Deno)
- Auth: Supabase Auth (magic link + email/senha)
- Deploy: Cloudflare Pages (NUNCA Lovable Cloud)
- Pagamentos: Asaas
- WhatsApp: Evolution API (API externa)
- NFS-e: NFE.io (API externa)
- SERPRO: VPS gateway em serpro.apoya.com.br:4010

## Regras absolutas de segurança
1. RLS habilitado em TODAS as tabelas — sem exceção
2. SERVICE_ROLE_KEY apenas em Edge Functions server-side
3. ANON_KEY no frontend é permitida (é pública por design)
4. Toda Edge Function deve verificar JWT antes de operar
5. Nunca armazenar tokens em localStorage manualmente
6. Toda Edge Function de CRON deve verificar CRON_SECRET header

## Design system
- Cor primária: #F97316 (laranja APOYA)
- Border radius: rounded-2xl
- Sombras: shadow-sm
- Fonte: Inter ou Geist (padrão shadcn)
- Mobile-first: tudo deve funcionar em tela de 375px
- Dark mode: NÃO implementar — foco em clareza para uso diário

## Usuários do sistema
- Admin (Daniel Araújo): acesso total
- Fiscal: acesso a obrigações, SERPRO, NFS-e
- Financeiro: acesso a cobranças, Asaas, inadimplência
- DP (Depto. Pessoal): acesso a folha, eSocial
- Sem role de cliente — clientes não acessam

## Idioma
Português brasileiro em toda a interface. 
Datas no formato DD/MM/YYYY. 
Moeda: R$ com ponto para milhar e vírgula para decimal.

## O que NÃO construir neste projeto
- Portal do cliente (fase futura)
- App mobile nativo (PWA já cobre)
- Módulo de Depto Pessoal completo (fase 2)
- Integração direta SPED (fase 2)
- Módulo de Ativo Imobilizado (fase 2)
```

---

## PROMPT 0 — INÍCIO DO PROJETO (cole este primeiro, antes de qualquer outra coisa)

```
Crie um sistema de gestão contábil chamado "APOYA Gestão" para o escritório 
APOYA Contabilidade e Auditoria.

CONTEXTO DO NEGÓCIO:
Escritório contábil com 75 clientes (empresas). Gerido por Daniel Araújo.
O sistema é usado exclusivamente pela equipe interna — clientes não acessam.
Objetivo: automatizar tudo que hoje é feito manualmente (DAS, NFS-e, cobranças, WhatsApp).

STACK OBRIGATÓRIA:
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (banco de dados + auth) — eu vou conectar meu próprio projeto Supabase
- NÃO use Lovable Cloud para deploy — o deploy será no Cloudflare Pages
- NÃO instale Firebase, Amplify ou qualquer outro backend além do Supabase

DESIGN:
- Cor primária: #F97316 (laranja)
- rounded-2xl, shadow-sm
- Mobile-first (375px mínimo)
- Sidebar com ícones + labels

ESTRUTURA DE NAVEGAÇÃO (sidebar):
1. Dashboard (ícone: LayoutDashboard)
2. Clientes (ícone: Building2)
3. Obrigações (ícone: Calendar)
4. Fiscal — submenu:
   - DAS em Lote (ícone: FileText)
   - NFS-e em Lote (ícone: Receipt)
   - SERPRO (ícone: Shield)
5. Financeiro (ícone: DollarSign)
6. WhatsApp (ícone: MessageSquare)
7. Configurações (ícone: Settings)

PRIMEIRO PASSO:
Crie apenas o shell da aplicação:
- Layout com sidebar responsiva (colapsável em mobile)
- Roteamento com React Router
- Tela de login com Supabase Auth
- Placeholder pages para cada item do menu
- Header com nome do usuário logado e botão logout
- Não conecte ao Supabase ainda — use dados mockados

Após criar, aguarde minha aprovação visual antes de avançar.
```

---

## PROMPT 1 — MÓDULO M1: CADASTRO DE CLIENTES

```
Agora vamos construir o Módulo M1: Cadastro de Clientes.

PÁGINA: /clientes

LISTA DE CLIENTES (tela principal):
- Tabela com colunas: Razão Social, CNPJ, Regime, Status, WhatsApp, Responsável, Ações
- Badges coloridos para Status: 
  * ativo = verde
  * inadimplente = amarelo  
  * suspenso = vermelho
  * inativo = cinza
  * em_analise = azul
- Badges para Regime: MEI (roxo), Simples Nacional (laranja), Lucro Presumido (azul), Lucro Real (azul escuro), Doméstica (verde)
- Barra de busca por nome/CNPJ
- Filtros: regime, status, responsável
- Botão "Novo Cliente" (laranja)
- Contador de clientes ativos no topo
- Paginação (50 por página)

FORMULÁRIO DE CADASTRO (modal ou drawer):
Campos obrigatórios:
- CNPJ (com máscara XX.XXX.XXX/XXXX-XX)
- Botão "Buscar na Receita Federal" — ao clicar, preenche automaticamente: razão social, nome fantasia, CNPJ, endereço, atividade principal (CNAE)
- Regime Tributário (select: MEI, Simples Nacional, Lucro Presumido, Lucro Real, Doméstica)
- Regime Híbrido (toggle — aparece apenas para Simples Nacional)
- Tier de Serviço (select: MEI, Simples, Empresarial, Doméstica)
- WhatsApp (campo obrigatório — formato +5511999999999)
- Email do responsável
- Nome do responsável
- Inscrição Municipal
- Código de Serviço NFS-e (texto livre + helper "Tabela LC 116/2003")
- Dia de vencimento da cobrança (select: 1 a 28)
- Valor do honorário mensal (R$)
- Forma de pagamento (PIX / Boleto / Débito automático)
- Observações (textarea)
- Usuário responsável interno (select com usuários do sistema)

DETALHES DO CLIENTE (/clientes/:id):
Tabs:
1. Dados Cadastrais — todos os campos acima editáveis
2. Obrigações — lista das obrigações do mês atual
3. Financeiro — cobranças + status de pagamento
4. NFS-e — notas emitidas
5. WhatsApp — histórico de mensagens
6. Contratos — contratos assinados

DADOS MOCKADOS PARA DESENVOLVIMENTO:
Use estes 5 clientes de exemplo:
1. Padaria São José | 12.345.678/0001-90 | Simples Nacional | ativo | +5512999990001
2. Consultório Dental Lima | 98.765.432/0001-11 | Lucro Presumido | ativo | +5512999990002
3. João Silva MEI | 11.111.111/0001-55 | MEI | inadimplente | +5512999990003
4. Transportadora Rápida | 22.222.222/0001-66 | Lucro Real | ativo | +5512999990004
5. Maria Doméstica | 33.333.333/0001-77 | Doméstica | suspenso | +5512999990005

REGRAS DE NEGÓCIO:
- CNPJ não pode se repetir
- WhatsApp é obrigatório (é o canal principal de comunicação)
- Se regime = MEI, tier deve ser "MEI" automaticamente
- Se status = suspenso, mostrar banner vermelho no topo da página do cliente
- Se regime_hibrido = true, mostrar badge "Regime Híbrido" na lista

NÃO CONECTE AO SUPABASE AINDA.
Use useState/localStorage para persistência temporária.
Aguarde minha aprovação visual antes de avançar.
```

---

## PROMPT 2 — MÓDULO M2: CALENDÁRIO DE OBRIGAÇÕES

```
Construa o Módulo M2: Calendário de Obrigações.

PÁGINA: /obrigacoes

VISÃO GERAL (tela principal):
- Selector de mês/ano no topo
- Cards de resumo: Total pendentes | Concluídas | Vencidas | Em andamento
- Filtro por: tipo de obrigação, regime, status, responsável
- Kanban com 4 colunas: "A Fazer" | "Em Andamento" | "Enviado ao Cliente" | "Concluído"
- Cada card no Kanban mostra: nome do cliente, tipo de obrigação, data de vencimento, badge de status

REGRAS DO CALENDÁRIO FISCAL (codificar no sistema — não é configurável pelo usuário):

MEI — obrigações geradas automaticamente:
- DASMEI: todo mês, vence dia 20
- DASN-SIMEI: 1 vez/ano, vence 31/maio

SIMPLES NACIONAL:
- PGDAS-D: todo mês, vence dia 20
- DAS: todo mês, vence dia 20 (junto com PGDAS-D)
- DEFIS: 1 vez/ano, vence 31/março
- eSocial: dia 15 (se tiver empregados — campo no cadastro)
- Folha/FGTS: dia 7 (se tiver empregados)

LUCRO PRESUMIDO:
- DARF IRPJ+CSLL: último dia útil mês seguinte (apuração trimestral)
- DARF PIS/COFINS: dia 25 mês seguinte
- GPS (INSS): dia 20
- FGTS: dia 7
- EFD-Reinf: dia 15
- DCTFWeb: último dia útil (SUBSTITUIU a DCTF Mensal — extinta em 2026)
- EFD-Contribuições: 10º dia útil do 2º mês seguinte
- ECF: 31/julho (anual)
- ECD: 29/maio (anual)

DOMÉSTICA:
- DAE: dia 7

NOVIDADE 2026 — DIRBI:
- Clientes com incentivos fiscais: dia 20 (campo "tem_incentivo_fiscal" no cadastro)

ALERTA DE MULTA (mostrar no card quando vencida):
- DAS: multa automática SERPRO
- DCTFWeb: R$200/mês ou 2% dos tributos (máx 20%)
- EFD-Contribuições LP: R$500/mês
- EFD-Contribuições LR: R$1.500/mês

AÇÃO RÁPIDA nos cards:
- Marcar como concluída
- Atribuir responsável
- Adicionar observação
- Ver detalhes do cliente

ALERTA ESPECIAL — REFORMA TRIBUTÁRIA:
Para clientes Simples Nacional, exibir banner em março e agosto:
"⚠️ Janela de escolha do regime híbrido (IBS/CBS) se abre em [abril/setembro]. 
Revisar clientes que podem se beneficiar."

DADOS MOCKADOS:
Gere obrigações para os 5 clientes do M1 no mês atual.
Simule: 3 pendentes, 1 em andamento, 1 vencida.

NÃO CONECTE AO SUPABASE AINDA.
Aguarde aprovação visual antes de avançar.
```

---

## PROMPT 3 — MÓDULO M3: DAS EM LOTE

```
Construa o Módulo M3: DAS em Lote.

PÁGINA: /fiscal/das-lote

OBJETIVO:
Gerar DAS/DASMEI para todos os clientes elegíveis com 1 clique,
via integração com o gateway SERPRO em serpro.apoya.com.br:4010

TELA PRINCIPAL:
Header com: "DAS em Lote — [mês/ano atual]"

Seção 1 — Simples Nacional (DAS):
- Lista de todos os clientes com regime = simples_nacional e status = ativo
- Colunas: cliente, CNPJ, competência, vencimento (dia 20), status DAS
- Status possíveis: pendente (cinza) | gerando (amarelo spinner) | gerado (verde) | erro (vermelho)
- Botão: "Gerar DAS para todos" (processa em paralelo, barra de progresso)
- Botão: "Enviar todos via WhatsApp" (ativa após geração)
- Ação individual: ícone de gerar / ícone de enviar WhatsApp / ícone de download PDF

Seção 2 — MEI (DASMEI):
- Mesma estrutura, apenas clientes com regime = mei
- Mesmo conjunto de ações

Resumo no topo:
- Badge: "X clientes processados | Y enviados | Z com erro"

FLUXO DE GERAÇÃO:
1. Usuário clica "Gerar DAS para todos"
2. Sistema mostra progresso em tempo real (X de 75 concluídos)
3. Para cada cliente: chama Edge Function `das-generate-single`
4. Edge Function chama serpro.apoya.com.br:4010/das/gerar
5. Recebe PDF em base64, salva no Supabase Storage, atualiza status

FLUXO DE ENVIO WHATSAPP:
1. Usuário clica "Enviar todos via WhatsApp"
2. Para cada cliente com DAS gerado:
   - Chama Edge Function `whatsapp-send`
   - Envia PDF com mensagem template:
     "Olá [nome]! 📋 Segue o DAS de [competência] no valor de R$[valor], 
      vencimento [data]. Qualquer dúvida, é só chamar! 🧾"
3. Status muda para "enviado"

TRATAMENTO DE ERROS:
- Erro SERPRO: mostrar motivo + botão "Tentar novamente"
- Erro WhatsApp: mostrar ícone de aviso + botão "Reenviar"
- Log de erros exportável em CSV

IMPORTANTE — SOBRE AS EDGE FUNCTIONS:
Crie os stubs das Edge Functions com:
1. Verificação de JWT obrigatória (Authorization header)
2. Resposta mockada (não precisa chamar API real ainda — isso vem depois)
3. CORS configurado para o domínio da APOYA

Template de Edge Function segura:
- Verificar Authorization header
- Validar JWT com Supabase anon client
- Extrair user.id do token (nunca do request body)
- Retornar mock de sucesso para desenvolvimento
- Log da ação no audit_log

NÃO CONECTE AO SUPABASE AINDA.
Aguarde aprovação visual antes de avançar.
```

---

## PROMPT 4 — MÓDULO M4: NFS-e EM LOTE

```
Construa o Módulo M4: NFS-e em Lote.

PÁGINA: /fiscal/nfse-lote

OBJETIVO:
Emitir NFS-e da APOYA para todos os clientes ativos do mês,
via NFE.io. Resolve a maior dor operacional do escritório.

TELA PRINCIPAL:
Header: "NFS-e em Lote — [mês/ano atual]"
Subtítulo: "Emissão de notas fiscais de honorários da APOYA"

Cards de resumo:
- Total a emitir | Emitidas | Com erro | Enviadas ao cliente

Lista de clientes:
- Todos os clientes com status = ativo
- Colunas: cliente, CNPJ, código serviço, valor honorário, status NFS-e
- Status: pendente | emitindo | emitida | erro | cancelada | enviada_cliente
- Badge especial "Regime Híbrido" para clientes SN com regime_hibrido = true
- Badge "MEI — sem CBS/IBS" para clientes MEI (isentos em 2026)
- Badge "CBS/IBS destacado" para demais clientes (obrigatório 2026)

Botão "Emitir todas NFS-e" (laranja, destaque)
Botão "Enviar todas via WhatsApp" (ativa após emissão)

FLUXO DE EMISSÃO:
1. Clique em "Emitir todas"
2. Progresso em tempo real
3. Para cada cliente, chama Edge Function `nfse-emit-single`
4. EF chama NFE.io com:
   - prestador: APOYA (CNPJ 43.507.838/0001-89)
   - tomador: dados do cliente
   - valor: cliente.valor_honorario
   - código serviço: cliente.codigo_servico_nfse
   - CBS: 0.9% (exceto MEI)
   - IBS: 0.1% (exceto MEI)
   - descrição: "Serviços de contabilidade referente à competência [mês/ano]"
5. Recebe XML + PDF, salva no Storage, atualiza status

DETALHES DA NFS-e (expandir linha):
- Número da nota
- Data de emissão
- Valor
- Código de verificação
- Botão download XML
- Botão download PDF
- Botão cancelar nota (com confirmação)
- Status de envio WhatsApp

MENSAGEM WHATSAPP para NFS-e:
"Olá [nome]! 🧾 Segue a Nota Fiscal de Serviços referente aos honorários 
contábeis de [mês/ano] no valor de R$[valor]. 
APOYA Contabilidade agradece a confiança! 😊"

TRATAMENTO DE ERROS:
- Erro NFE.io: mostrar código + descrição do erro + botão retry
- Nota já emitida no mês: bloquear e mostrar aviso
- Cancelamento: apenas para notas emitidas há menos de 24h (regra NFE.io)

COLUNAS DE RETENTATIVA:
- Notas com erro: botão "Tentar novamente"
- Máximo 3 tentativas automáticas (com delay de 30s entre elas)

NÃO CONECTE AO SUPABASE AINDA.
Aguarde aprovação visual antes de avançar.
```

---

## PROMPT 5 — MÓDULO M5: FINANCEIRO AUTOMATIZADO

```
Construa o Módulo M5: Financeiro Automatizado.

PÁGINA: /financeiro

TABS PRINCIPAIS:
1. Cobranças do Mês
2. Inadimplência
3. Histórico

--- TAB 1: COBRANÇAS DO MÊS ---

Cards de resumo no topo:
- Total a cobrar (soma de honorários de clientes ativos)
- Cobranças enviadas
- Pagas (com total em R$)
- Em atraso

Lista de cobranças:
Colunas: Cliente | Valor | Vencimento | Forma | Status Asaas | Ações
Status com badge colorido:
  - pendente (cinza) — cobrança não criada ainda
  - enviada (azul) — boleto/PIX enviado
  - paga (verde) — webhook confirmado
  - vencida (vermelho) — passou do vencimento
  - cancelada (cinza escuro)

Ações por linha:
  - Enviar cobrança (cria no Asaas + envia WhatsApp)
  - Copiar PIX copia-e-cola
  - Visualizar boleto
  - Cancelar cobrança

Botão "Gerar cobranças do mês" — cria para todos os clientes ativos que ainda não têm

--- TAB 2: INADIMPLÊNCIA ---

Título: "Régua de Cobrança"
Explicação visual da régua:
  Dia 1 → Cobrança enviada
  +7 dias → ⚠️ Primeiro lembrete WhatsApp
  +15 dias → ⚠️ Segundo lembrete + notificação interna
  +30 dias → 🔴 Alerta crítico + flag no dashboard
  +45 dias → 🚫 SUSPENSÃO AUTOMÁTICA do serviço

Lista de clientes inadimplentes:
  - Dias de atraso (com barra de progresso colorida 0-45 dias)
  - Última tentativa de contato
  - Total em aberto
  - Botão "Enviar lembrete WhatsApp"
  - Botão "Suspender agora" (para casos especiais)
  - Botão "Negociar" (abre campo de observação)

Badge especial para clientes em 44+ dias: "⚡ Suspensão amanhã"

Após suspensão:
  - Status do cliente muda para "suspenso"
  - WhatsApp automático: "Prezado [nome], infelizmente sua conta foi 
    suspensa por atraso de 45 dias. Entre em contato para regularizar."
  - Banner vermelho na tela do cliente

Reativação automática:
  - Quando webhook Asaas confirmar pagamento → status volta para "ativo"
  - WhatsApp automático: "✅ Pagamento confirmado! Sua conta foi reativada. 
    Obrigado por regularizar! APOYA Contabilidade."

--- TAB 3: HISTÓRICO ---
  - Todos os pagamentos confirmados
  - Filtro por mês/ano/cliente
  - Total recebido no período
  - Exportar CSV

NÃO CONECTE AO SUPABASE AINDA.
Aguarde aprovação visual antes de avançar.
```

---

## PROMPT 6 — MÓDULO M6: WHATSAPP CENTRAL

```
Construa o Módulo M6: WhatsApp Central.

PÁGINA: /whatsapp

LAYOUT:
Split view (como WhatsApp Web):
- Coluna esquerda (30%): lista de conversas
- Coluna direita (70%): conversa ativa

COLUNA ESQUERDA — Lista de conversas:
  - Foto/avatar com inicial do nome do cliente (cor baseada no regime)
  - Nome da empresa
  - Última mensagem (preview de 50 chars)
  - Horário da última mensagem
  - Badge de não lidas (bolinha laranja com número)
  - Filtros: Todas | Não lidas | Enviados automaticamente | Respostas humanas
  - Busca por nome/número

COLUNA DIREITA — Conversa:
  - Header: nome da empresa + CNPJ + badge de regime + badge de status financeiro
  - Botão "Ver cliente" (link para /clientes/:id)
  
  Área de mensagens:
  - Mensagens enviadas pelo sistema: fundo laranja claro, alinhado direita, label "Automático 🤖"
  - Mensagens enviadas manualmente: fundo azul claro, alinhado direita, label "Manual 👤"  
  - Mensagens recebidas: fundo branco, alinhado esquerda
  - Timestamp em cada mensagem
  - Status: ✓ enviada | ✓✓ entregue | ✓✓ (azul) lida | ❌ erro
  - Ícone de clipe para mensagens com arquivo (DAS, NFS-e, boleto)
  
  Input de nova mensagem:
  - Campo de texto
  - Botão de emoji
  - Botão de anexar arquivo (PDF)
  - Botão enviar (laranja)
  - Sugestões rápidas: [Enviar DAS] [Enviar NFS-e] [Enviar Boleto] [Lembrete]

PAINEL DE AUTOMAÇÕES (ícone de robô no header):
  Drawer lateral com toggle de cada automação:
  - ✅ DAS disponível → enviar PDF automaticamente
  - ✅ NFS-e emitida → enviar PDF automaticamente
  - ✅ Boleto gerado → enviar link PIX automaticamente
  - ✅ Lembrete 7 dias → enviar lembrete de vencimento
  - ✅ Lembrete 15 dias → enviar segundo lembrete
  - ⚠️ Suspensão → enviar aviso de suspensão
  - ✅ Reativação → enviar confirmação de reativação
  
  Cada toggle com: ativo/inativo + última execução + total de envios

STATUS DA CONEXÃO (topo da página):
  Badge verde "Evolution API Conectada" ou vermelho "Desconectada"
  (verificar via endpoint /health do Evolution API)

DADOS MOCKADOS:
  Use as 5 empresas do M1.
  Simule histórico de 10-15 mensagens por empresa (mix de automáticas e manuais).
  Simule 2 empresas com mensagens não lidas.

NÃO CONECTE AO SUPABASE AINDA.
Aguarde aprovação visual antes de avançar.
```

---

## PROMPT 7 — MÓDULO M7: DASHBOARD EXECUTIVO

```
Construa o Módulo M7: Dashboard Executivo.

PÁGINA: / (rota raiz após login)

OBJETIVO:
Daniel abre o sistema e em 10 segundos sabe o estado de tudo.
Zero "precisar ir atrás" — o sistema é proativo.

LAYOUT — grade de cards responsiva:

LINHA 1 — Financeiro (4 cards):
  💰 Receita do mês: R$[total_honorarios_ativos] | meta vs. realizado
  ✅ Pagas: [n] clientes | R$[total]
  ⏳ Pendentes: [n] clientes | R$[total]
  🔴 Em atraso: [n] clientes | R$[total] | botão "Ver inadimplentes"

LINHA 2 — Obrigações (3 cards):
  📋 Obrigações do mês: [total] | [concluídas] / [total]
  ⚠️ Vencendo em 3 dias: lista rápida (máx 5) com link direto
  ❌ Vencidas: [n] obrigações em atraso | botão "Ver todas"

LINHA 3 — NFS-e e DAS (2 cards):
  🧾 NFS-e do mês: [n] emitidas / [total_clientes] | [n] pendentes
  📄 DAS do mês: [n] gerados / [total_elegíveis] | [n] pendentes

LINHA 4 — WhatsApp e Clientes (2 cards):
  💬 WhatsApp: [n] mensagens não lidas | última recebida há [X] horas
  👥 Clientes: [total_ativos] ativos | [inadimplentes] inadimplentes | [suspensos] suspensos

ALERTAS CRÍTICOS (banner no topo — aparecem quando necessário):
  🚨 VERMELHO: "X clientes atingem 45 dias de atraso amanhã — ação necessária"
  🟠 LARANJA: "DAS de [n] clientes vence em 5 dias e ainda não foi gerado"
  🟡 AMARELO: "Janela de revisão de regime híbrido abre em [X] dias"
  🔵 AZUL: "X mensagens WhatsApp aguardando resposta há mais de 2h"

LISTA DE ATIVIDADE RECENTE (coluna lateral ou rodapé):
  Feed cronológico das últimas 20 ações:
  - "✓ DAS da Padaria São José enviado via WhatsApp — há 2h"
  - "✓ NFS-e #00123 emitida para Consultório Lima — há 3h"  
  - "⚠️ João Silva MEI — 30 dias de atraso"
  - "✓ Pagamento confirmado — Transportadora Rápida — R$450"

QUICK ACTIONS (botões de ação rápida no topo):
  [Gerar DAS em Lote] [Emitir NFS-e em Lote] [Gerar Cobranças] [Nova Mensagem]

REFRESH:
  Dados atualizam a cada 5 minutos automaticamente.
  Botão manual de refresh no canto superior direito.
  Timestamp "Atualizado às HH:MM"

NÃO CONECTE AO SUPABASE AINDA.
Aguarde aprovação visual antes de avançar.
```

---

## PROMPT 8 — CONEXÃO SUPABASE (apenas após aprovação visual de M1-M7)

```
ATENÇÃO: Só execute este prompt após aprovação visual de todos os módulos M1-M7.

Agora vamos conectar o projeto ao Supabase.

PROJETO SUPABASE:
URL: [INSERIR URL DO PROJETO]
Anon Key: [INSERIR ANON KEY]
NÃO usar service_role_key no frontend em nenhuma hipótese.

MIGRATIONS — aplique estas tabelas na ordem:

1. empresa_cliente (com RLS habilitado — usuários só veem suas próprias empresas no futuro)
[ver schema completo no arquivo APOYA_ESCOPO_V2.md]

2. obrigacao (RLS habilitado)
3. nfse (RLS habilitado)
4. cobranca (RLS habilitado)
5. mensagem_whatsapp (RLS habilitado)
6. contrato (RLS habilitado)
7. audit_log (RLS habilitado — admin vê tudo)
8. calendario_fiscal (RLS desabilitado — tabela de configuração pública para leitura)
9. simulacao_regime (RLS habilitado)

REGRAS DE SEGURANÇA OBRIGATÓRIAS:
- RLS em TODAS as tabelas que contêm dados de clientes
- Policy padrão: usuário autenticado pode ler/escrever (por enquanto sem isolamento por usuário — haverá apenas 1 escritório)
- audit_log: insert por qualquer autenticado, select apenas admin
- calendario_fiscal: select para qualquer autenticado, insert/update/delete apenas admin

EDGE FUNCTIONS — crie os arquivos em supabase/functions/:
Para CADA Edge Function:
1. Verificação JWT obrigatória (template de segurança que eu forneci)
2. CORS headers corretos
3. Resposta mockada (não implementar integração real ainda)
4. Chamada para audit_log ao final de cada operação

SUBSTITUIÇÃO DE MOCKS:
Substitua todos os useState/localStorage pelos hooks do Supabase.
Use @supabase/supabase-js no frontend.
Use realtime subscriptions para atualizações ao vivo (dashboard e WhatsApp).

NÃO ATIVE DEPLOY AUTOMÁTICO — o deploy será feito manualmente no Cloudflare Pages.
```

---

## CHECKLIST FINAL PARA WILSON — antes de apresentar para Daniel

### Segurança
- [ ] RLS habilitado em todas as tabelas (verificar no Supabase Dashboard → Authentication → Policies)
- [ ] SERVICE_ROLE_KEY não aparece em nenhum arquivo do frontend
- [ ] Todas as Edge Functions retornam 401 se chamadas sem JWT
- [ ] Login funciona (magic link + email/senha)
- [ ] Logout limpa a sessão corretamente

### Funcional (testar com dados reais)
- [ ] Cadastrar 1 cliente real com busca de CNPJ
- [ ] Visualizar calendário do mês atual com obrigações geradas
- [ ] DAS em lote: tela carrega com lista de clientes
- [ ] NFS-e em lote: tela carrega com lista de clientes
- [ ] Dashboard: cards com dados corretos
- [ ] WhatsApp: histórico de mensagens carregando
- [ ] Mobile: testar em 375px de largura

### Performance
- [ ] Página inicial carrega em menos de 3 segundos
- [ ] Lista de 75 clientes carrega sem travar
- [ ] Busca de clientes responde em menos de 500ms

### UX
- [ ] Cor laranja #F97316 em todos os elementos primários
- [ ] Textos em português brasileiro
- [ ] Datas em DD/MM/YYYY
- [ ] Moeda em R$ com vírgula decimal
- [ ] Sidebar colapsável em mobile

---

*PRD preparado por ARQUITETO — baseado em análise profunda dos erros do Lovable + escopo técnico V3.*
*Versão 1.0 — pronto para uso no Lovable.*
