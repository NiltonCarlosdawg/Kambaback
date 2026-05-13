# Kamba AI - Plano de Evolução

## Visão Geral
Transformar o Kamba de um assistente funcional mas monolítico num sistema inteligente, escalável e modular que ajude efetivamente o cidadão angolano a gerir melhor as suas finanças e criar hábitos financeiros saudáveis.

---

## 📋 Fases do Plano

### 🔧 Fase 1: Desacoplagem Arquitectural (Foundation)
**Objectivo:** Separar o monolito de 1144 linhas em serviços dedicados e bem definidos.

**Problema:** Um ficheiro faz tudo (controller, cache, rate limiter, prompt builder, API client)

**Solução:**
```
services/kamba/
├── ai/
│   ├── groqClient.js          # Cliente API com retry, timeout, circuit breaker
│   ├── promptBuilder.js       # Builder de prompts com templates versionados
│   ├── intentClassifier.js    # Classificação de intenções (NLU local)
│   └── toolRegistry.js        # Registo dinâmico de ferramentas
├── memory/
│   ├── conversationService.js # Gestão de histórico, threads, sumarização
│   └── userPreferences.js     # Memória de preferências do utilizador
├── core/
│   ├── rateLimiter.js         # Rate limiting com Redis
│   ├── cacheService.js        # Cache de respostas com TTL
│   └── responseFormatter.js   # Formatação de respostas
└── plugins/
    ├── tools/
    │   ├── cotacaoMoedas.js
    │   ├── ideiasNegocio.js
    │   ├── fluxoCaixa.js
    │   └── ...
    └── prompts/
        ├── v1_system.md
        ├── v1_tools.md
        └── v1_fallbacks.md
```

**Entregáveis:**
- [ ] Criar estrutura de pastas
- [ ] Extrair groqClient.js com retry logic e timeout
- [ ] Extrair promptBuilder.js com templates versionados
- [ ] Extrair intentClassifier.js (regex + embeddings híbrido)
- [ ] Extrair toolRegistry.js (registo dinâmico)
- [ ] Extrair conversationService.js (histórico, threads)
- [ ] Extrair cacheService.js e rateLimiter.js
- [ ] Refactor kambaController.js para usar novos serviços
- [ ] Testar e validar refatoração

**Dependências:** Nenhuma
**Estimativa:** 3-4 dias

---

### 🧠 Fase 2: Memória Inteligente
**Objectivo:** Dar ao Kamba capacidade de lembrar contexto de longo prazo e aprender com o utilizador.

**Problema:** Apaga mensagens antigas; sem contexto de longo prazo; redação regex frágil

**Soluções:**

**2A. Sumarização Automática**
- Quando o histórico atinge 15 mensagens, resume as primeiras 10 em 2-3 frases
- Mantém as últimas 5 mensagens completas + sumário
- **Impacto:** Conversas mais longas e coerentes

**2B. Memória de Preferências (User Profile Memory)**
- Guarda aprendizados: "Prefere respostas curtas", "Tem negócio informal", "Preocupa-se com dólar"
- Injeta estas preferências no system prompt
- **Impacto:** Respostas personalizadas e proativas

**2C. Threads/Conversas Múltiplas**
- Permitir conversas paralelas (ex: "Orçamento Casa" vs "Investimentos")
- Cada thread com contexto isolado
- **Impacto:** Organização e foco

**2D. Memória Semântica (Futuro)**
- Usar pgvector para embeddings das conversas
- Busca semântica de contexto relevante
- **Impacto:** Recuperação inteligente de informação passada

**Entregáveis:**
- [ ] Implementar sumarização de conversas
- [ ] Criar tabela de preferências do utilizador
- [ ] Implementar threads de conversação
- [ ] Adaptar controller para usar nova memória

**Dependências:** Fase 1
**Estimativa:** 4-5 dias

---

### 🔌 Fase 3: Sistema de Plugins/Extensões
**Objectivo:** Permitir adicionar novas capacidades sem editar o controller principal.

**Problema:** Ferramentas hardcoded; adicionar nova = editar controller

**Solução:**
```javascript
toolRegistry.register({
  name: 'getCotacaoMoedas',
  description: '...',
  handler: async (params, context) => { ... },
  requiresAuth: true,
  cacheable: true,      // TTL automático
  category: 'financial' // Para organização
});
```

**Ferramentas Existentes:**
- getCotacaoMoedas ✅
- getIdeiasNegocio ✅
- getFluxoCaixaMensal
- getResumoObjetivos
- getFundoEmergenciaStatus
- getGastosPorCategoria
- getComparacaoMensal
- getCartoesStatus

**Novas Ferramentas Sugeridas:**
- getAnaliseGastos - Análise preditiva de gastos
- getAlertasFinanceiros - Alertas personalizados
- getComparativoMercado - Comparar preços de produtos
- getDicasPoupanca - Dicas contextuais baseadas no perfil
- getPlaneamentoMensal - Planeamento orçamental mensal
- getEducacaoFinanceira - Explicações educativas por tema

**Entregáveis:**
- [ ] Criar sistema de registo dinâmico
- [ ] Migrar ferramentas existentes para plugins
- [ ] Criar 2-3 novas ferramentas
- [ ] Documentar como adicionar novas ferramentas

**Dependências:** Fase 1
**Estimativa:** 3-4 dias

---

### 🎯 Fase 4: NLU/Classificador Inteligente
**Objectivo:** Compreender melhor as intenções do utilizador.

**Problema:** Regex-based intent detection é frágil

**Solução Híbrida (Recomendada):**

**Nível 1 - Regex (Rápido)**
- Padrões óbvios: "saldo", "gastos", "dólar"
- Resposta instantânea, sem chamada à API

**Nível 2 - Embeddings + Similaridade**
- Guardar 50-100 exemplos de intenções com embeddings
- Comparar mensagem com exemplos usando similaridade de cosseno
- Usar quando regex não corresponde

**Nível 3 - LLM (Preciso)**
- Chamar LLM para classificar intenções ambíguas
- Fallback quando confiança < 80%

**Capacidades Adicionais:**
- Detecção de entidades: valores monetários, datas, categorias
- Análise de sentimento: frustração, entusiasmo, urgência
- Detecção de idioma: pt-PT, pt-AO, en

**Entregáveis:**
- [ ] Implementar classificador híbrido
- [ ] Criar dataset de exemplos de intenções
- [ ] Implementar extração de entidades
- [ ] Implementar análise de sentimento

**Dependências:** Fase 1
**Estimativa:** 4-5 dias

---

### 📊 Fase 5: Analytics e Otimização
**Objectivo:** Ter visibilidade sobre performance e melhorar continuamente.

**Problema:** Zero visibilidade sobre performance do assistente

**Soluções:**

**Métricas:**
- Taxa de sucesso (respostas úteis vs falhas)
- Tempo de resposta (latência)
- Satisfação do utilizador (avaliações)
- Uso de ferramentas (quais são mais usadas)
- Padrões de conversa (horários, temas, duração)

**A/B Testing:**
- Testar versões diferentes de system prompts
- Comparar taxa de satisfação
- Escolher vencedor automaticamente

**Feedback Loop:**
- Usar avaliações (1-5 estrelas) para melhorar
- Identificar respostas más e re-treinar
- Dashboard de qualidade

**Dashboard:**
- Conversas por dia/semana/mês
- Erros mais comuns
- Ferramentas mais usadas
- Temas mais discutidos
- Satisfação ao longo do tempo

**Entregáveis:**
- [ ] Implementar logging estruturado de métricas
- [ ] Criar endpoint de feedback (/kamba/feedback)
- [ ] Implementar A/B testing de prompts
- [ ] Criar dashboard de analytics

**Dependências:** Fase 1, Fase 3
**Estimativa:** 3-4 dias

---

### 🚀 Fase 6: Proatividade Avançada
**Objectivo:** O Kamba antecipa necessidades e dá conselhos proactivos.

**Problema:** Análise diária simples; não aprende padrões

**Soluções:**

**Detecção de Padrões:**
- "Todos os dias 15 gastas em combustível" → Lembrete dia 14
- "Gastaste 40% do orçamento nos primeiros 5 dias" → Alerta
- "Costumas poupar no fim do mês mas não este mês" → Alerta

**Previsões:**
- "Com este ritmo, vais bater na parede dia 25"
- "Este mês vais gastar X em combustível (baseado no histórico)"
- "Tens poupança suficiente para emergência de 3 meses?"

**Sugestões Contextuais:**
- Após gasto grande: "Queres criar uma meta para recuperar?"
- Após receita: "Queres guardar 20% para o fundo de emergência?"
- Após não poupar: "Queres que te ajude a encontrar onde cortar?"

**Educação Financeira Proactiva:**
- Dica do dia sobre poupança
- Explicação de conceitos (inflação, juros compostos)
- Desafios mensais ("Poupa 10% este mês")

**Entregáveis:**
- [ ] Implementar detecção de padrões de gastos
- [ ] Criar sistema de previsões simples
- [ ] Implementar sugestões contextuais
- [ ] Criar programa de educação financeira

**Dependências:** Fase 2, Fase 5
**Estimativa:** 5-6 dias

---

## 🗓️ Calendário de Implementação

| Fase | Descrição | Duração | Dependências |
|------|-----------|---------|--------------|
| 1 | Desacoplagem Arquitectural | 3-4 dias | Nenhuma |
| 2 | Memória Inteligente | 4-5 dias | Fase 1 |
| 3 | Sistema de Plugins | 3-4 dias | Fase 1 |
| 4 | NLU Avançado | 4-5 dias | Fase 1 |
| 5 | Analytics | 3-4 dias | Fase 1, 3 |
| 6 | Proatividade Avançada | 5-6 dias | Fase 2, 5 |

**Total Estimado:** 22-28 dias (4-6 semanas)

---

## 🎯 Critérios de Sucesso

- [ ] Kamba responde de forma contextual e inteligente
- [ ] Sistema é modular e fácil de estender
- [ ] Memória funciona para conversas longas
- [ ] Novas ferramentas podem ser adicionadas sem editar o controller
- [ ] Analytics mostram melhoria contínua na qualidade das respostas
- [ ] Utilizadores reportam maior utilidade e personalização

---

## 📝 Notas

- **Multi-Provider:** Fica para o futuro (após Fase 6). Groq é suficiente por agora.
- **Ollama:** Considerar para fallback offline ou classificador local (Fase 4).
- **Redis:** Já configurado no projeto, usar para cache e rate limiting.
- **pgvector:** Já disponível no PostgreSQL, usar para memória semântica (Fase 2D).
- **Testes:** Criar testes automatizados durante cada fase para garantir qualidade.

---

*Documento criado em: Maio 2026*
*Última actualização: Maio 2026*
