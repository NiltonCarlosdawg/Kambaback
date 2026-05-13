# KambaPro — Backlog de Melhorias
> Análise completa do projecto (Backend + Frontend) · Gerado em Maio 2026

---

## Legenda de Prioridade

| Label | Significado |
|---|---|
| 🔴 **CRÍTICO** | Bug que quebra funcionalidade ou expõe dado sensível |
| 🟠 **ALTO** | Funcionalidade incorrecta ou degradação séria de UX |
| 🟡 **MÉDIO** | Melhoria importante mas não urgente |
| 🟢 **BAIXO** | Polimento, optimização ou nice-to-have |

---

## 🔴 BUGS CRÍTICOS — Backend

### B-001 · `prisma.config.js` usa sintaxe ESM mas projecto é CommonJS
**Ficheiro:** `KambApi/prisma.config.js`  
**Descrição:** O ficheiro usa `import … from` e `export default`, mas o `package.json` **não** tem `"type": "module"`. O Prisma 7 vai falhar ao ler o config.  
**Impacto:** Migrations e geração de cliente podem quebrar em ambientes limpos.  
**Fix:**
```js
// Substituir por CommonJS ou adicionar "type":"module" ao package.json
// Opção mais segura:
const { defineConfig } = require('@prisma/config');
require('dotenv').config();
module.exports = defineConfig({ … });
```

---

### B-002 · `softDelete.gasto()` tenta setar campo `ativo` inexistente
**Ficheiro:** `KambApi/src/lib/prismaSoftDelete.js`  
**Descrição:** `softDelete.gasto()` e `softDelete.cartao()` passam `ativo: false`, mas o model `Gasto` **não tem campo `ativo`** no schema — apenas `excluido`. Isso causa erro Prisma P2012 (campo desconhecido).  
**Fix:**
```js
gasto: (args) => prisma.gasto.update({
  where: args.where,
  data: { excluido: true } // remover ativo: false
}),
```

---

### B-003 · Dashboard route sobrescreve `module.exports`
**Ficheiro:** `KambApi/src/modules/users/routes/dashboard.js`  
**Descrição:** O ficheiro define rotas com `router.get(…)` e depois **no final** faz `module.exports = insightsRouter`, descartando completamente o router local. Nenhuma rota de `/api/dashboard` funciona — todas redirecionam silenciosamente para `/api/insights`.  
**Fix:** Remover a última linha ou usar apenas um dos dois exports.

---

### B-004 · `encryption.js` crasha na importação se `ENCRYPTION_KEY` não estiver definida
**Ficheiro:** `KambApi/src/utils/encryption.js`  
**Descrição:** O módulo lança `throw new Error(…)` no nível de módulo se `ENCRYPTION_KEY` for undefined. Isso mata o processo Node.js inteiro durante o `require()`, mesmo que `encryption.js` **não seja usado** nessa run.  
**Fix:** Mover a validação para dentro das funções `encrypt()` e `decrypt()` onde é realmente necessária, não no topo do módulo.

---

### B-005 · `KambaCronJobs` usa campo `timestamp` que não existe no model
**Ficheiro:** `KambApi/src/jobs/kambaCronJobs.js` (linha do relatório mensal)  
**Descrição:** O aggregate de `KambaUsage` filtra por `timestamp: { gte, lte }` mas o schema define o campo como `criadoEm`. Isso gera erro silencioso ou P2012 na execução do cron.  
**Fix:** Substituir `timestamp` por `criadoEm` em todos os filtros.

---

### B-006 · `KambaFeedback` não tem campo `criadoEm` mas é consultado como se tivesse
**Ficheiro:** `KambApi/src/modules/kamba/routes/kamba.js` (rota `/stats`)  
**Descrição:** O model `KambaFeedback` no schema não define `criadoEm`, mas a rota de stats faz `groupBy` com filtro `criadoEm: { gte: … }`. Isso resulta em erro Prisma P2012.  
**Fix:** Adicionar `criadoEm DateTime @default(now())` ao model, ou remover o filtro temporal.

---

### B-007 · Endpoint `/kamba/historico` não existe no backend
**Ficheiro:** `KambApi/src/modules/kamba/routes/kamba.js`  
**Frontend:** `KambApi/src/components/KambaChat.tsx`  
**Descrição:** O `KambaChat.tsx` faz `api.get('/kamba/historico')` para carregar histórico de mensagens no mount, mas esse endpoint **não está registado** nas rotas do Kamba. A chamada falha em 404 e o erro é silenciado — mas deixa o chat sempre vazio no reload.  
**Fix:** Adicionar `router.get('/historico', …)` que devolve as últimas mensagens de `KambaMemoria` para o utilizador autenticado.

---

### B-008 · Validação de query string em `gastos.js` é completamente ignorada
**Ficheiro:** `KambApi/src/modules/gastos/routes/gastos.js`  
**Descrição:** A rota `GET /gastos` usa `listarGastosQuerySchema` que chama `validar(schema, 'query')`, mas a função `validar()` em `middleware/validator.js` **só aceita um argumento** e valida sempre `req.body`. Parâmetros de query inválidos passam sem validação.  
**Fix:**
```js
const validar = (schema, target = 'body') => {
  return (req, res, next) => {
    const source = target === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(source, { … });
    if (error) return next(new AppError(…));
    if (target === 'query') req.query = value;
    else req.body = value;
    next();
  };
};
```

---

### B-009 · CORS rejeita `origin: null` (requests directos/Postman bloqueados em dev)
**Ficheiro:** `KambApi/server.js`  
**Descrição:** O callback CORS devolve `callback(new Error('CORS: Origin não fornecido'), false)` quando `origin` é `undefined` (requests server-to-server, Postman sem header Origin, etc.). Em desenvolvimento, isso impede testes directos.  
**Fix:** Permitir `!origin` em desenvolvimento:
```js
if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true);
```

---

## 🔴 BUGS CRÍTICOS — Frontend

### F-001 · `useSocket.ts` usa variável de ambiente errada
**Ficheiro:** `frontend/hooks/useSocket.ts` e `frontend/utils/socketClient.js`  
**Descrição:** Ambos os ficheiros referenciam `process.env.REACT_APP_API_URL` (convenção Create React App), mas o projecto usa **Vite**. Em Vite, variáveis de ambiente devem ter prefixo `VITE_` e ser acedidas via `import.meta.env.VITE_*`. O socket.io nunca consegue determinar a URL correcta e falha silenciosamente.  
**Fix:**
```ts
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

---

### F-002 · `RuixenStatsChart` exportado como default sem props — crash garantido
**Ficheiro:** `frontend/components/ui/ruixen-stats.tsx`  
**Descrição:** `export default function RuixenStats()` chama `<RuixenStatsChart />` sem passar as props obrigatórias (`data`, `heroValue`, `heroLabel`, `sideStats`). A página `demo.tsx` importa este default — vai lançar TypeError no render.  
**Fix:** Ou passar props mock no demo, ou remover o default export e usar apenas o named export `RuixenStatsChart`.

---

### F-003 · `KambaChat` — histórico do backend usa endpoint inexistente (ver B-007)
**Impacto:** Chat carrega sempre em branco no primeiro acesso (só o `WELCOME_MSG`). O histórico do `sessionStorage` compensa parcialmente, mas ao limpar a sessão perde-se tudo.

---

### F-004 · Sem Error Boundaries — crash num componente derruba a app inteira
**Ficheiro:** `frontend/App.tsx`  
**Descrição:** Não há nenhum `<ErrorBoundary>` em qualquer ponto da árvore. Um erro de render em `Dashboard`, `Goals` ou `KambaChat` mostra ecrã branco sem feedback ao utilizador.  
**Fix:** Envolver cada página num ErrorBoundary com fallback UI amigável.

---

### F-005 · `Transactions.tsx` — filtro de categorias por tipo pode resultar em lista vazia
**Ficheiro:** `frontend/components/Transactions.tsx`  
**Descrição:** `categoriasFiltradas` filtra por `c.tipo` com valores `'ESSENCIAL' | 'FLEXIVEL' | 'POUPANCA'` para DESPESA, e `'RENDIMENTO'` para RECEITA. Mas o campo `tipo` no type `Categoria` está tipado como `'despesa' | 'receita'` (minúsculas). Se a API devolver valores em maiúsculas (o que acontece com os enums Prisma), a comparação falha e o dropdown de categorias fica vazio.  
**Fix:** Normalizar a comparação: `c.tipo.toUpperCase()` ou alinhar os types.

---

## 🟠 PROBLEMAS DE ALTA PRIORIDADE — Backend

### B-010 · Rate limiting do Kamba em memória — não escala
**Ficheiro:** `KambApi/src/modules/kamba/controllers/kambaController.js`  
**Descrição:** `rateLimitMap` é um `Map` em memória. Com múltiplos workers/processos (PM2 cluster, containers), cada processo tem o seu próprio Map. Um utilizador pode fazer N×maxRequests por janela de tempo sem ser bloqueado.  
**Fix:** Migrar para Redis usando `ioredis` (já é dependência) com `EXPIRE` automático.

---

### B-011 · Ausência de `.env.example` no repositório
**Descrição:** O `envValidator.js` documenta as variáveis necessárias, mas não há ficheiro `.env.example` commitado. Novos developers ficam sem referência sobre o que configurar.  
**Fix:** Criar `.env.example` com todas as variáveis (sem valores reais) e adicioná-lo ao git.

---

### B-012 · Sem testes apesar de Jest estar configurado
**Ficheiro:** `KambApi/package.json` (scripts: test)  
**Descrição:** Jest está instalado com Supertest, mas não há nenhum ficheiro `*.test.js` em todo o projecto. Rotas críticas (auth, gastos, Kamba) operam sem qualquer cobertura de testes.  
**Fix:** Criar pelo menos testes de integração para: `POST /auth/register`, `POST /auth/login`, `POST /gastos`, e o flow de refresh token.

---

### B-013 · Graceful shutdown pode deixar transacções a meio
**Ficheiro:** `KambApi/server.js`  
**Descrição:** O shutdown fecha WebSocket e HTTP server, mas não aguarda que transacções Prisma em curso terminem. Com `prisma.$disconnect()` imediato, queries longas (como aggregates do dashboard) podem corromper dados.  
**Fix:** Usar `prisma.$use()` para rastrear queries activas, ou adicionar um delay de drenagem antes de desligar.

---

### B-014 · `KambaMemoria` armazena `contexto` como campo obrigatório sem default
**Ficheiro:** Schema + `kambaController.js`  
**Descrição:** O campo `contexto` em `KambaMemoria` é `NOT NULL` no schema, mas na função `salvarMemoria()` é passado como `contexto: contexto || content.substring(0, 200)`. Se `content` for vazio (edge case), o contexto é uma string vazia — o que pode ser confuso para o modelo de IA nas queries subsequentes.

---

### B-015 · Sem paginação nas queries de memória do Kamba
**Ficheiro:** `KambApi/src/modules/kamba/controllers/kambaController.js`  
**Descrição:** `carregarMemoria()` usa `take: 15` mas `salvarMemoria()` mantém apenas as últimas 20. Em alta frequência de uso, há duas queries extras por mensagem (findMany para contar + deleteMany). Pode ser optimizado com uma única query usando `orderBy + skip`.

---

### B-016 · `notificacaoService.js` — confusão entre dois modelos de notificação
**Ficheiro:** `KambApi/src/modules/users/services/notificacaoService.js`  
**Descrição:** O serviço cria notificações em `NotificacaoPush` (para WebSocket) mas o schema tem também `Notificacao` (tabela `notificacoes`, para notificações de sistema). A rota `GET /notificacoes` usa `NotificacaoPush`, mas `notificarAtualizacaoSaldo` cria em `NotificacaoPush` E tenta emitir via `io.emitirAtualizacaoSaldo`. A mistura cria inconsistência — algumas notificações aparecem no drawer, outras não.  
**Fix:** Unificar num único model ou documentar claramente a separação de responsabilidades.

---

### B-017 · Seed falha se categorias padrão com mesmo nome já existirem
**Ficheiro:** `KambApi/prisma/seed.js`  
**Descrição:** O seed faz `deleteMany({ where: { padrao: true } })` antes de criar. Se houver gastos ligados a categorias padrão (FK `categoriaId`), o delete falha com violação de foreign key — e o seed termina com erro sem criar as categorias.  
**Fix:** Usar `upsert` em vez de delete+create, ou desactivar (`ativa: false`) em vez de apagar.

---

## 🟠 PROBLEMAS DE ALTA PRIORIDADE — Frontend

### F-006 · `api.ts` redireciona para `/login` (rota inexistente na SPA)
**Ficheiro:** `frontend/services/api.ts`  
**Descrição:** Em caso de falha no refresh token, o código faz `window.location.href = '/login'`. Mas a SPA não tem roteamento baseado em URL — usa estado interno (`isAuthenticated`). O utilizador vai para uma página em branco (404 no Vite dev server).  
**Fix:** Limpar localStorage e emitir um evento custom ou chamar um callback para resetar o estado de autenticação em `App.tsx`.

---

### F-007 · Sem feedback de erro em formulários de cartão/gasto quando o servidor falha
**Ficheiros:** `Wallet.tsx`, `Transactions.tsx`  
**Descrição:** Quando a API retorna erro 400/409 (ex: número de cartão duplicado, saldo insuficiente), o erro é mostrado numa `div` estática no topo do modal que pode não ser visível se o utilizador tiver feito scroll. Em mobile, passa despercebido com frequência.  
**Fix:** Usar toast notifications ou scroll automático para o elemento de erro.

---

### F-008 · `Goals.tsx` — depósito manual não valida cartão selecionado
**Ficheiro:** `frontend/components/Goals.tsx`  
**Descrição:** O `handleQuickDeposit` envia `cartaoId: ''` (string vazia) porque o modal de depósito rápido não tem campo para seleccionar cartão. O backend vai rejeitar com 404 "Cartão inválido", mas o utilizador recebe uma mensagem genérica de erro sem saber o que corrigir.  
**Fix:** Adicionar selector de cartão ao modal de depósito rápido, ou pré-seleccionar o cartão com mais saldo disponível.

---

### F-009 · `ThemeContext` não persiste automaticamente — alterações perdem-se ao navegar
**Ficheiro:** `frontend/contexts/ThemeContext.tsx`  
**Descrição:** `updatePrefs()` aplica mudanças ao CSS imediatamente mas **não salva em localStorage**. Só `savePrefs()` persiste. Se o utilizador fechar o tab sem clicar "Guardar" em `Personalizacao.tsx`, as mudanças aplicadas (que viu em tempo real) desaparecem. Confunde a distinção entre "apliquei" e "guardei".  
**Sugestão:** Auto-salvar com debounce (1s), ou pelo menos mostrar um indicador "Alterações pendentes" na barra de navegação.

---

### F-010 · `KambaChat` — textarea não reseta altura após submit
**Ficheiro:** `frontend/components/KambaChat.tsx`  
**Descrição:** A auto-resize da textarea funciona ao escrever, mas ao submeter via Enter, o `input` é limpo mas a `textarea.style.height` permanece com o valor anterior. Na próxima mensagem, o campo começa expandido.  
**Fix:**
```ts
setInput('');
if (textareaRef.current) textareaRef.current.style.height = 'auto'; // já existe mas só para o override
```
O reset existe mas não está a funcionar porque é feito antes do re-render. Usar `useEffect` dependente de `input === ''`.

---

### F-011 · Dashboard refetch a cada 30s mesmo quando tab está inativo — desperdício
**Ficheiro:** `frontend/components/Dashboard.tsx`  
**Descrição:** O `setInterval` de 30s usa `document.visibilityState === 'visible'` correctamente, mas o próprio `clearInterval` depende de `chartPeriodo` como dependência do `useEffect`. Cada mudança de período cria um novo interval sem limpar o anterior correctamente (closure stale).  
**Fix:** Usar `useRef` para guardar o intervalId e limpar sempre no cleanup.

---

### F-012 · `Perfil.tsx` — alteração de senha faz PATCH sem campo `senhaAtual`
**Ficheiro:** `frontend/components/Perfil.tsx`  
**Descrição:** O form envia `{ senhaAtual, novaSenha }` via `PATCH /auth/perfil`, mas o `atualizarPerfil` no backend **não tem lógica para alterar senha** — apenas actualiza campos como `nome`, `telefone`, etc. A requisição vai ter sucesso (200 OK) sem alterar a senha, dando falsa sensação de segurança ao utilizador.  
**Fix:** Criar um endpoint dedicado `POST /auth/alterar-senha` que verifica `senhaAtual` com bcrypt antes de actualizar.

---

## 🟡 MELHORIAS MÉDIAS — Backend

### B-018 · Logs de produção sem estrutura (console.log simples)
**Descrição:** Todo o logging usa `console.log/error/warn`. Em produção, não há níveis de log, não há timestamps estruturados, e não há integração com serviços de observabilidade (ex: Datadog, Sentry, Logtail).  
**Fix:** Substituir por `pino` ou `winston` com output JSON em produção.

---

### B-019 · Ausência de documentação de API (OpenAPI/Swagger)
**Descrição:** Não há nenhum ficheiro de documentação das rotas. Com +10 módulos e dezenas de endpoints, developers e testers não têm referência.  
**Fix:** Adicionar `swagger-ui-express` + `swagger-jsdoc` com anotações JSDoc nas rotas principais.

---

### B-020 · `node-cron` sem gestão de sobreposição de jobs
**Ficheiro:** `KambApi/src/jobs/kambaCronJobs.js`  
**Descrição:** Se `executarAnaliseDiaria()` demorar mais do que o intervalo do cron (ex: muitos utilizadores), uma nova execução começa antes da anterior terminar. Isso pode duplicar lembretes e sobrecarregar a BD.  
**Fix:** Usar `scheduled: false` + lock em Redis ou simplesmente guardar um flag `isRunning` em memória.

---

### B-021 · Falta de índice no campo `refreshToken` do model `User`
**Ficheiro:** Schema `prisma/schema.prisma`  
**Descrição:** O endpoint `POST /auth/refresh` faz lookup por `refreshToken` (`prisma.user.findUnique({ where: { id: decoded.id } })`), o que está correcto. Mas a rota de logout faz update por `id` apenas. Porém, se alguma query futura fizer lookup directo por `refreshToken`, haverá full table scan. O campo existe no schema mas sem `@index`.

---

### B-022 · Timeout de 15s no fetch ao Groq sem retry exponencial adequado
**Ficheiro:** `kambaController.js`  
**Descrição:** O `chamarGroq()` tem retry de 2 tentativas com delay fixo (500ms/1s). Para rate limits (429) da Groq, o ideal seria respeitar o header `Retry-After` da resposta.

---

### B-023 · Campos Decimal do Prisma convertidos manualmente em cada controller
**Descrição:** Em múltiplos controllers, há `Number(obj.valorAtual)`, `Number(c.saldoAtual)`, etc. Isso é repetitivo e propenso a esquecimento. Em futuro, um campo Decimal retornado sem conversão vai serializar como objecto `Decimal` e quebrar JSON.  
**Fix:** Centralizar a serialização num middleware de resposta ou usar `serializeDecimal()` helper.

---

### B-024 · Ausência de health check para dependências externas no `/health`
**Ficheiro:** `KambApi/server.js`  
**Descrição:** O endpoint `/health` verifica PostgreSQL e WebSocket, mas não verifica: Redis (disponibilidade do rate limiter), Groq API (se a IA está acessível), GNews API. Um deploy com Redis morto passa no health check.

---

## 🟡 MELHORIAS MÉDIAS — Frontend

### F-013 · Sem i18n real apesar da preferência de idioma existir
**Ficheiro:** `frontend/contexts/ThemeContext.tsx` (preferência `idioma`)  
**Descrição:** A preferência `idioma` é guardada mas **nunca usada** — toda a UI está hardcoded em português angolano. A infra para i18n existe (contexto, opções de idioma), mas falta a implementação.  
**Fix:** Integrar `react-i18next` com ficheiros de tradução para pt-AO, pt-PT e en.

---

### F-014 · `Relatorio.tsx` busca dados de `/dashboard/historico` e `/dashboard/top-categorias` — deveria ser `/insights/`
**Ficheiro:** `frontend/components/Relatorio.tsx`  
**Descrição:** As rotas corretas no backend são `/api/insights/historico` e `/api/insights/top-categorias`, mas por causa do bug B-003 (dashboard re-exporta insightsRouter), isso funciona acidentalmente. Se o B-003 for corrigido sem ajustar o frontend, o Relatório quebra.  
**Fix:** Usar `/insights/historico` e `/insights/top-categorias` directamente.

---

### F-015 · Sem skeleton loaders — flash de conteúdo vazio em carregamentos
**Descrição:** A maioria dos componentes mostra um spinner centralizado durante o loading. Isso causa CLS (Cumulative Layout Shift) e uma experiência de loading inferior ao que o design-system admite.  
**Fix:** Implementar skeleton screens para `Dashboard`, `Transactions`, `Goals` e `Wallet` usando elementos com `animate-pulse`.

---

### F-016 · `Layout.tsx` faz fetch de stats em cada navegação para páginas em `STATS_PAGES`
**Ficheiro:** `frontend/components/Layout.tsx`  
**Descrição:** O `useEffect` com dependência `[activePage]` chama `fetchStats()` sempre que muda para dashboard/transactions/cards. Se o utilizador navegar entre essas páginas rapidamente, dispara múltiplos requests simultâneos.  
**Fix:** Adicionar debounce ou usar React Query/SWR com stale-while-revalidate e deduplicação.

---

### F-017 · Sem modo offline / fallback de dados
**Descrição:** Quando a API está indisponível, todos os componentes mostram um erro genérico. Não há cache de dados da sessão anterior. O PWA seria o caminho ideal.  
**Fix (curto prazo):** Guardar último dashboard snapshot em `localStorage` e mostrar como dados stale com aviso.

---

### F-018 · Formulários sem `autocomplete` semântico
**Ficheiros:** `Login.tsx`, `Register.tsx`, `Perfil.tsx`  
**Descrição:** Os inputs de email/password não têm atributos `autocomplete="email"`, `autocomplete="current-password"`, etc. Gestores de passwords e browsers não conseguem preencher automaticamente.

---

### F-019 · Sem validação de data mínima no formulário de objetivos
**Ficheiro:** `frontend/components/Goals.tsx`  
**Descrição:** O campo `dataPrevista` aceita datas no passado. O backend também não valida isso (o controller apenas faz `new Date(dataPrevista)` sem verificar se é futura). Um objetivo com data no passado aparece imediatamente como "atrasado" sem aviso.

---

### F-020 · `vite.config.ts` expõe `GEMINI_API_KEY` desnecessariamente
**Ficheiro:** `frontend/vite.config.ts`  
**Descrição:** O config define `process.env.GEMINI_API_KEY` como constante global no bundle, mas o projecto não usa Gemini em lado algum (usa Groq no backend). Isso inclui a chave no bundle de produção se estiver definida no `.env` local.  
**Fix:** Remover as entradas `process.env.API_KEY` e `process.env.GEMINI_API_KEY` do `define`.

---

## 🟡 MELHORIAS DE UI/UX

### UX-001 · KambaChat — mensagens longas sem botão "ver mais"
**Descrição:** Respostas longas do Kamba (análises, relatórios) aparecem em bloco único sem truncagem. Em mobile, isso leva a scrolls extensos dentro do chat.  
**Fix:** Truncar mensagens com mais de 300 chars e mostrar "Ver resposta completa" expansível.

---

### UX-002 · Dashboard — KPI cards sem tendência em relação ao mês anterior
**Ficheiro:** `frontend/components/Dashboard.tsx`  
**Descrição:** Os cards de KPI têm um campo `trend` mas ele só mostra a `taxaPoupanca` atual como percentagem positiva/negativa. Não há comparação real com o período anterior.  
**Fix:** Incluir comparação mês-a-mês na resposta do `/insights/resumo` e visualizá-la nos cards.

---

### UX-003 · Formulário de nova transação — sem confirmação antes de fechar modal
**Ficheiro:** `frontend/components/Transactions.tsx`  
**Descrição:** Se o utilizador preencheu parte do formulário e clica no backdrop ou "Cancelar", o modal fecha sem aviso e os dados perdem-se.  
**Fix:** `onClose` verificar se o formulário foi modificado e mostrar `confirm()` ou um dialog de confirmação.

---

### UX-004 · Wallet — cards de cartão sem acção de "ver transacções" deste cartão
**Ficheiro:** `frontend/components/Wallet.tsx`  
**Descrição:** Cada cartão mostra saldo e distribuição, mas não tem link directo para filtrar transacções desse cartão na página Transactions.  
**Fix:** Adicionar botão "Ver movimentos" que navega para `/transactions?cartaoId=<id>`.

---

### UX-005 · Notificações sem agrupamento por tipo/data
**Ficheiro:** `frontend/components/NotificacoesDrawer.tsx`  
**Descrição:** Todas as notificações aparecem em lista plana por ordem cronológica. Com muitas notificações, fica difícil encontrar as relevantes.  
**Fix:** Agrupar por "Hoje", "Ontem", "Esta semana" e por tipo (Alertas, Objetivos, Sistema).

---

### UX-006 · `Relatorio.tsx` sem export de dados (CSV/PDF)
**Descrição:** O relatório mostra gráficos e tabelas ricos mas não permite download. Utilizadores de negócio precisam frequentemente de exportar dados para Excel ou partilhar PDFs.  
**Fix:** Adicionar botão "Exportar CSV" usando `papaparse` (já é dependência do ecossistema) e "Exportar PDF" usando `jsPDF`.

---

### UX-007 · Sem feedback haptico/visual ao completar objectivo (100%)
**Descrição:** Quando um objetivo atinge 100%, não há nenhuma celebração visual. O card simplesmente move-se para "Concluídos".  
**Fix:** Adicionar confetti animation (ex: `canvas-confetti`) e uma notificação proeminente ao detectar progresso = 100%.

---

### UX-008 · Formulário de registo sem indicador de força da senha
**Ficheiro:** `frontend/components/Register.tsx`  
**Descrição:** O componente `PasswordStrength` existe em `Perfil.tsx` mas não foi reutilizado em `Register.tsx`. O utilizador não tem feedback visual sobre a qualidade da senha durante o registo.

---

### UX-009 · Mobile — sidebar não fecha ao navegar para nova página via link externo
**Ficheiro:** `frontend/components/Layout.tsx`  
**Descrição:** `handleNavigate` fecha o menu mobile, mas se o utilizador clicar no botão de voltar do browser, o estado `mobileMenuOpen` fica `true` sem fechar.  
**Fix:** Adicionar listener para `popstate` que fecha o menu.

---

### UX-010 · Sem indicador de "última sincronização" nas páginas de dados
**Descrição:** O utilizador não sabe quando os dados foram actualizados pela última vez. Em mercados com conectividade instável (Luanda), isso é especialmente importante.  
**Fix:** Mostrar "Actualizado às HH:MM" com botão de refresh manual em todas as páginas com dados financeiros.

---

## 🟢 MELHORIAS DE BAIXA PRIORIDADE

### B-025 · Remover dependências não utilizadas
**Backend:** `mongodb@4.1` está listado como dependência mas o projecto usa PostgreSQL exclusivamente.  
**Frontend:** `@radix-ui/react-slot` e `class-variance-authority` só são usados pelo `button.tsx` que não está integrado na UI principal.

---

### B-026 · `node-cache` como dependência não usada
**Ficheiro:** `KambApi/package.json`  
**Descrição:** `node-cache` está listado mas o projecto usa um sistema de cache próprio em `src/utils/cache.js` (Map + Redis). `node-cache` nunca é importado.

---

### F-021 · `button.tsx` importa de `@/lib/utils` — path inconsistente
**Ficheiro:** `frontend/components/ui/button.tsx`  
**Descrição:** O `button.tsx` usa shadcn/ui e importa de `@/lib/utils`, que resolve para `frontend/lib/utils.ts`. Funciona com o alias do `tsconfig.json`, mas outros componentes usam caminhos relativos. Inconsistência que confunde novos contributors.

---

### F-022 · Falta `aria-label` em botões icon-only
**Ficheiros:** `Layout.tsx`, `NotificacoesDrawer.tsx`, `KambaChat.tsx`  
**Descrição:** Botões como o sino de notificações, o X de fechar modal e o ícone de microfone não têm `aria-label`. Leitores de ecrã lêem "botão" sem contexto.

---

### F-023 · Sem `meta` tags de SEO / Open Graph
**Ficheiro:** `frontend/index.html`  
**Descrição:** O `<title>` é genérico ("Kwanza Pro - Gestão Financeira") e não há tags `og:*`, `twitter:card`, ou `description`. Partilha em redes sociais não gera preview.

---

### F-024 · Animações de Framer Motion sem respeito por `prefers-reduced-motion`
**Ficheiros:** Múltiplos componentes com `motion.*`  
**Descrição:** A preferência `animacoes` do utilizador desactiva animações via CSS variable, mas as animações de Framer Motion (`initial/animate/whileHover`) ignoram isso e continuam activas.  
**Fix:** Usar o hook `useReducedMotion()` do Framer Motion como guard:
```ts
const reduceMotion = useReducedMotion();
const variants = reduceMotion ? {} : myVariants;
```

---

### B-027 · Histórico de migrações tem rename de tabelas repetido e excessivo
**Ficheiros:** `prisma/migrations/`  
**Descrição:** O histórico mostra `usuarios` → `User` → `Usuario` → `usuarios` → `User` em migrações consecutivas. Cada rename dropa e recria a tabela, perdendo dados em ambientes de staging. Em produção isso seria catastrófico. O histórico de migrações está "sujo" e dificulta auditoria.  
**Recomendação:** Documentar internamente a política de naming e evitar renames de tabelas em produção.

---

## 📋 RESUMO EXECUTIVO

| Categoria | Crítico 🔴 | Alto 🟠 | Médio 🟡 | Baixo 🟢 |
|---|---|---|---|---|
| **Backend** | 9 | 8 | 7 | 3 |
| **Frontend** | 5 | 7 | 8 | 4 |
| **UI/UX** | — | — | 10 | — |
| **TOTAL** | **14** | **15** | **25** | **7** |

---

## 🗺️ ROADMAP SUGERIDO

### Sprint 1 — Correcção de Bugs Críticos (1-2 semanas)
1. B-001 — Corrigir `prisma.config.js`
2. B-002 — Corrigir `softDelete.gasto()`
3. B-003 — Corrigir double-export em `dashboard.js`
4. B-004 — Mover validação de `ENCRYPTION_KEY` para dentro das funções
5. B-005 + B-006 — Corrigir campos errados nas queries Kamba
6. B-007 — Criar endpoint `GET /kamba/historico`
7. B-008 — Corrigir `validar()` para suportar `target: 'query'`
8. F-001 — Corrigir variável de ambiente do socket
9. F-002 — Corrigir default export de `RuixenStats`
10. F-004 — Adicionar Error Boundaries

### Sprint 2 — Estabilização e Segurança (2-3 semanas)
- B-009, B-012, F-006, F-007, F-012, F-020
- Adicionar `.env.example`
- Primeiros testes de integração (auth + gastos)

### Sprint 3 — Qualidade e UX (3-4 semanas)
- Skeleton loaders (F-015)
- i18n básico (F-013)
- Melhorias de formulários (F-018, F-019, UX-003)
- Export de relatórios (UX-006)
- Logging estruturado (B-018)
- Documentação da API (B-019)

### Sprint 4 — Performance e Polimento
- React Query/SWR (F-016)
- PWA básico (F-017)
- Acessibilidade (F-022, F-024)
- Remover dependências não usadas (B-025, B-026)

---

*Backlog gerado por análise estática completa do código-fonte. Última actualização: Maio 2026.*
