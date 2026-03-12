// src/controllers/kambaController.js
const prisma = require('../../../lib/prisma');
const Insights = require('../../insights/controllers/insightsController');
const Wizard = require('./kambaWizardController');
const Proatividade = require('../services/kambaProatividadeService');

const GROQ_API_KEY = process.env.KAMBA_AI_API_KEY;
const GROQ_BASE_URL = process.env.KAMBA_AI_BASE_URL;
const GROQ_MODEL = process.env.KAMBA_AI_MODEL || 'gpt-oss-120b';

// ==========================================
// HELPERS E UTILITÁRIOS
// ==========================================

const kambaRes = (res, texto, extra = {}) => {
  return res.json({
    success: true,
    kamba: true,
    mensagem: texto,
    timestamp: new Date().toISOString(),
    ...extra
  });
};

// Fallbacks humanizados
const fallbackRespostas = {
  erro_generico: [
    "Desculpa, kamba! Não consegui processar isso agora. 😅",
    "Bró, deu bug aqui. Tenta reformular a pergunta?",
    "Eish! Me perdi nessa. Podes dizer de outra forma?"
  ],
  nao_entendido: [
    "Não apanhei bem, mano. Queres saber sobre:\n• 💰 Saldo\n• 📊 Gastos\n• 🎯 Metas\n• 🤖 Fluxos guiados",
    "Mmm, não percebi. Experimenta:\n• 'Qual é o meu saldo?'\n• 'Criar meta'\n• 'Registar gasto'",
    "Confuso aqui, kamba. Digita 'ajuda' para ver o que posso fazer!",
    "Não entendi bem, kamba. Tenta ser mais direto, yha?"
  ],
  sem_dados: [
    "Ainda não tens dados suficientes, mano. Adiciona alguns gastos primeiro!",
    "Epa, tá vazio aqui! Regista movimentos na app para eu te ajudar melhor.",
    "Preciso de mais info, kamba. Vai na app e adiciona gastos ou metas."
  ],
  api_offline: [
    "O cérebro tá offline agora. 🔌 Tenta em alguns minutos, yha?",
    "Sistema sobrecarregado, kamba. Aguarda uns 2 minutos e volta.",
    "Servidor ocupado. Relaxa um pouco e tenta de novo! 🙏"
  ]
};

const getFallback = (tipo) => {
  const lista = fallbackRespostas[tipo] || fallbackRespostas.erro_generico;
  return lista[Math.floor(Math.random() * lista.length)];
};

// Cache de respostas
const cacheRespostas = new Map();
const CACHE_DURACAO = 5 * 60 * 1000; // 5 minutos

const verificarCache = (usuarioId, mensagem) => {
  const chave = `${usuarioId}:${mensagem.toLowerCase().trim()}`;
  const cached = cacheRespostas.get(chave);
  if (cached && Date.now() - cached.timestamp < CACHE_DURACAO) {
    return cached.resposta;
  }
  return null;
};

const salvarCache = (usuarioId, mensagem, resposta) => {
  const chave = `${usuarioId}:${mensagem.toLowerCase().trim()}`;
  cacheRespostas.set(chave, { resposta, timestamp: Date.now() });

  // Limpeza periódica do cache para evitar vazamento de memória
  if (cacheRespostas.size > 500) {
    const agora = Date.now();
    for (const [k, v] of cacheRespostas.entries()) {
      if (agora - v.timestamp > CACHE_DURACAO) cacheRespostas.delete(k);
    }
  }
};

// Rate limiting em memória (migrar para Redis em produção - ver doc de melhorias)
const rateLimitMap = new Map();
const MAX_REQUESTS = 15;
const RATE_WINDOW = 60 * 1000;

const verificarRateLimit = (usuarioId) => {
  const agora = Date.now();
  const userLimit = rateLimitMap.get(usuarioId) || { count: 0, resetAt: agora + RATE_WINDOW };

  if (agora > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = agora + RATE_WINDOW;
  }

  if (userLimit.count >= MAX_REQUESTS) {
    return { bloqueado: true, tentarEm: Math.ceil((userLimit.resetAt - agora) / 1000) };
  }

  userLimit.count++;
  rateLimitMap.set(usuarioId, userLimit);
  return { bloqueado: false };
};

// ==========================================
// MEMÓRIA PERSISTENTE
// ==========================================

const salvarMemoria = async (usuarioId, role, content, contexto = '') => {
  try {
    await prisma.kambaMemoria.create({
      data: {
        usuarioId,
        role,
        content,
        contexto: contexto || content.substring(0, 200)
      }
    });

    // Mantém apenas últimas 20 mensagens
    const todas = await prisma.kambaMemoria.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' }
    });

    if (todas.length > 20) {
      const idsParaDeletar = todas.slice(20).map(m => m.id);
      await prisma.kambaMemoria.deleteMany({
        where: { id: { in: idsParaDeletar } }
      });
    }
  } catch (err) {
    console.error('[MEMÓRIA] Erro:', err.message);
  }
};

const carregarMemoria = async (usuarioId) => {
  try {
    const mensagens = await prisma.kambaMemoria.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'asc' },
      take: 15
    });
    return mensagens.map(m => ({ role: m.role, content: m.content }));
  } catch (err) {
    console.error('[MEMÓRIA] Erro:', err.message);
    return [];
  }
};

// ==========================================
// DETECÇÃO DE INTENÇÃO LOCAL (pré-IA)
// ==========================================

/**
 * Detecta intent da mensagem sem chamar a IA.
 * Retorna string de intent ou null se precisa de IA.
 * Isso reduz custos e latência para queries simples.
 */
const detectarIntentLocal = (msgLower) => {
  // Saudações
  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|komé|kome|salve|e aí)\b/.test(msgLower)) {
    return 'saudacao';
  }

  // Saldo
  if (/saldo|quanto tenho|meu dinheiro|kumbú|tabua|quanto está|tenho de saldo/.test(msgLower)) {
    return 'consulta_saldo';
  }

  // Último gasto
  if (/último gasto|ultimo gasto|o que gastei|o que comprei|meu gasto|quanto gastei/.test(msgLower)) {
    return 'consulta_ultimo_gasto';
  }

  // Ajuda
  if (/^(ajuda|help|o que (podes|fazes|consegues)|comandos|menu)$/.test(msgLower)) {
    return 'ajuda';
  }

  // Fluxos disponíveis
  if (/^(fluxos|listar fluxos|o que fazes)$/.test(msgLower)) {
    return 'listar_fluxos';
  }

  return null; // Requer IA
};

// ==========================================
// SYSTEM PROMPT - MELHORADO
// ==========================================

const gerarSystemPrompt = (perfil, idade, contextoFinanceiro = '') => {
  const hoje = new Date().toLocaleDateString('pt-AO', { weekday: 'long', day: 'numeric', month: 'long' });

  return `Tu és o KAMBA, assistente virtual de gestão financeira pessoal da aplicação KambaPro, focado na realidade de Angola.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DADOS DO UTILIZADOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Nome: ${perfil.nome || 'Utilizador'}
- Localização: ${perfil.morada || 'Luanda'}
- Idade: ${idade} anos
- Renda mensal: ${perfil.rendaMensalMedia ? perfil.rendaMensalMedia.toLocaleString('pt-AO') + ' AOA' : 'não informada'}
- Perfil de risco: ${perfil.perfilDeRisco || 'Moderado'}
- Data de hoje: ${hoje}

${contextoFinanceiro ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CONTEXTO FINANCEIRO ATUAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${contextoFinanceiro}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 QUEM ÉS TU
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
És o assistente financeiro pessoal do ${perfil.nome || 'utilizador'}.
- Conheces bem a realidade económica de Angola: inflação, dolarização informal, mercado paralelo, dificuldades com o sistema bancário, custo de vida em Luanda vs. províncias.
- Sabes que muitos angolanos gerem finanças informais (negocios proprios, zungueiras, mercado), não apenas salários formais.
- Entendes referências locais: ENDE (electricidade), EPAL (água), Nosso Super, Shoprite, Kero, candongueiro, táxi-moto (kupapata), Multicaixa, Express, BAI, BFA, BIC, Banco Sol.
- Conheces expressões angolanas e usas-as naturalmente, sem exagero.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 PERSONALIDADE E TOM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Tom: amigável, direto, motivador, autêntico. NÃO és robótico.
- Usas expressões angolanas de forma natural: "kamba", "mano", "bró", "yha", "mambo", "eish", "kuá", "malungo".
- Humor leve e apropriado. Nunca sarcástico ou condescendente.
- Empático quando o utilizador está frustrado ou com dificuldades.
- Celebras as conquistas, por menores que sejam.
- Nunca traduzes literalmente expressões inglesas ou portuguesas formais.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗣️ GLOSSÁRIO ANGOLANO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "Kamba" / "Malungo": amigo, colega (usa para tratar o utilizador)
- "Bró": irmão, parceiro (tom mais informal)
- "Mambo": assunto, situação
- "Yha" / "Kuá": expressão de concordância / entendimento
- "Eish": surpresa, frustração, espanto
- "Candongueiro": transporte público informal (minibus)
- "Kupapata": táxi-moto
- "Kwanza" / "AOA": moeda oficial angolana
- "Kumbú" / "Tabua": dinheiro (gíria)
- "Bater na parede": ficar sem dinheiro, gastar tudo
- "Zungueira": vendedora ambulante
- "Musseque": bairro periférico (sem conotação pejorativa)
- "Kixi": exclamação de espanto
- "Dawa": problema, situação difícil

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📏 REGRAS DE RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **Brevidade**: Máx. 3-4 frases por resposta. Vai direto ao ponto.
2. **Dados reais**: Sempre usa os dados do utilizador quando disponíveis. Nunca inventes valores.
3. **Honestidade**: Se não souberes ou não tiveres dados, admite. Nunca blefes.
4. **Segurança financeira**: Nunca prometes ganhos garantidos ou rendimentos certos.
5. **Ações concretas**: Sempre termina com sugestão prática ou próximo passo.
6. **Emojis**: Usa com moderação (max 2 por resposta). Só quando adicionam valor.
7. **Tools**: Quando usas uma ferramenta, nunca menciones o nome técnico dela. Apenas apresenta o resultado de forma natural.
8. **Linguagem adaptável**: Avalia pelo estilo de escrita do utilizador. Se ele escreve formal, responde formal. Se casual, responde casual.
9. **Contexto angolano**: Relaciona sempre que possível com a realidade local.
10. **Privacidade**: Nunca partilhes dados de um utilizador com outro.
11. **Sem jargão de IA**: Nunca digas "como modelo de linguagem" ou "não tenho acesso a". Fala como consultor humano.
12. **REGRA CRÍTICA — Pedido explícito**: NUNCA uses uma ferramenta baseado em inferência, contexto ou suposição. Só usa quando o utilizador pediu dados NESTA mensagem de forma directa e inequívoca. Se o utilizador disse "sim" ou "claro" em resposta a algo que NÃO foi uma proposta tua de mostrar dados financeiros, NÃO uses ferramentas — responde normalmente em texto.
13. **REGRA CRÍTICA — Perguntar antes**: Quando o utilizador faz uma pergunta geral que PODERIA beneficiar de dados (ex: "como poupar?"), responde com conselho geral E termina com "Quer que eu veja os teus dados reais?" — NUNCA buscas dados sem esta confirmação explícita.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 REGRAS DE USO DE FERRAMENTAS (CRÍTICO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tens acesso a ferramentas para consultar dados financeiros reais do utilizador.

⛔ NUNCA uses uma ferramenta se:
- O utilizador não pediu dados financeiros explicitamente
- A mensagem é uma saudação, pergunta geral, conversa casual ou opinião
- Já respondeste com dados nesta mesma mensagem
- A pergunta pode ser respondida sem dados (conselhos gerais, educação financeira)

✅ USA a ferramenta APENAS quando o utilizador pede EXPLICITAMENTE:
- "Qual o meu saldo?" → getCartoesStatus
- "Quanto gastei?" / "Gastos do mês?" → getFluxoCaixaMensal
- "Como vão os meus objetivos?" → getResumoObjetivos
- "Fundo de emergência?" → getFundoEmergenciaStatus
- "Gastos por categoria?" → getGastosPorCategoria
- "Comparar com mês passado?" → getComparacaoMensal

Ferramentas disponíveis (usar APENAS quando pedido):
- getFluxoCaixaMensal: receitas, despesas e poupança do mês
- getResumoObjetivos: progresso de metas financeiras
- getFundoEmergenciaStatus: estado do fundo de emergência
- getGastosPorCategoria: gastos por categoria com percentagens
- getComparacaoMensal: comparação com mês anterior
- getCartoesStatus: estado de cartões e contas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 FLUXOS GUIADOS (wizard)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para estas ações, o sistema usa fluxos guiados passo a passo:
- Criar meta financeira → "criar meta" ou "nova meta"
- Registar gasto → "registar gasto" ou "gastei"
- Análise do mês → "análise" ou "como vou este mês"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 EXEMPLOS DE RESPOSTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⛔ EXEMPLOS DE QUANDO NÃO USAR FERRAMENTAS:

User: "Oi"
Kamba: "Komé, kamba! 👊 Em que posso ajudar hoje?"
[SEM tool — é só uma saudação]

User: "não perguntei nada sobre o fundo"
Kamba: "Tens razão, kamba. Desculpa a confusão! O que queres saber?"
[SEM tool — user está a corrigir o assistente, não pediu dados]

User: "Como poupar mais?"
Kamba: "Boa pergunta! Começa por registar todos os gastos, mesmo os pequenos. Quer que eu te mostre os teus gastos actuais para vermos onde podes cortar?"
[SEM tool — conselho geral. Só usa tool SE o user disser "sim"]

User: "Bati o kumbú na parede"
Kamba: "Eish, mambo! Acontece, kamba. Queres ver onde gastaste mais este mês para perceber o que correu mal?"
[SEM tool — aguarda confirmação do user antes de buscar dados]

User: "porquê?"
Kamba: [Responde com base na mensagem ANTERIOR da conversa, explicando a razão do que foi dito]
[SEM tool — é uma pergunta de follow-up sobre a resposta anterior, não um pedido de dados]

User: "como assim?"
Kamba: [Reformula e explica melhor o que disse anteriormente]
[SEM tool — pedido de clarificação]

✅ EXEMPLOS DE QUANDO USAR FERRAMENTAS:

User: "Qual o meu saldo?"
Kamba: [usa getCartoesStatus] "Tens X AOA disponíveis. Precisas de mais alguma coisa?"

User: "Quanto gastei este mês?"
Kamba: [usa getFluxoCaixaMensal] "Gastaste X AOA até agora, maior parte em [top categoria]."

User: "quais objetivos estou mais perto de concluir?"
Kamba: [usa getResumoObjetivos] "O objetivo mais próximo é [nome] com X% concluído. Faltam Y AOA."

User: "Como vão os meus objetivos?"
Kamba: [usa getResumoObjetivos] "Tens X metas activas. A mais próxima é [nome] com Y% concluída."

User: "Quero ver os gastos por categoria"
Kamba: [usa getGastosPorCategoria] "Este mês gastaste mais em [categoria 1] (X AOA)..."`;
};

// ==========================================
// TOOLS DISPONÍVEIS - AMPLIADAS
// ==========================================

const availableTools = [
  {
    type: "function",
    function: {
      name: "getFluxoCaixaMensal",
      description: "Busca receitas totais, despesas totais e poupança do mês actual. Chamar APENAS quando o utilizador pede EXPLICITAMENTE dados de gastos mensais, fluxo de caixa ou quanto gastou/recebeu este mês. NÃO chamar para saudações, conversas gerais ou quando o utilizador não pediu dados financeiros.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getResumoObjetivos",
      description: "Busca progresso das metas financeiras. Chamar APENAS quando o utilizador pede EXPLICITAMENTE para ver objetivos, metas ou sonhos financeiros. NÃO chamar proactivamente.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getFundoEmergenciaStatus",
      description: "Busca estado do fundo de emergência. Chamar APENAS quando o utilizador pergunta EXPLICITAMENTE sobre reservas, fundo de emergência ou segurança financeira. NÃO chamar proactivamente.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getGastosPorCategoria",
      description: "Busca distribuição de gastos por categoria. Chamar APENAS quando o utilizador pede EXPLICITAMENTE ver categorias de gastos, onde gasta mais, ou análise de hábitos de consumo. NÃO chamar proactivamente.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getComparacaoMensal",
      description: "Compara gastos do mês actual com o mês anterior. Chamar APENAS quando o utilizador pede EXPLICITAMENTE comparação com mês passado ou tendências mensais. NÃO chamar proactivamente.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getCartoesStatus",
      description: "Busca saldo e estado de cartões e contas. Chamar APENAS quando o utilizador pergunta EXPLICITAMENTE o saldo, quanto tem disponível, ou sobre as suas contas. NÃO chamar proactivamente.",
      parameters: { type: "object", properties: {} }
    }
  }
];

// ==========================================
// EXECUÇÃO DE TOOLS
// ==========================================

/**
 * Executa tool call da IA com suporte a múltiplas ferramentas.
 * Fallback seguro se função não existir.
 */
const executarTool = async (toolCall, usuarioId) => {
  const functionName = toolCall.function.name;

  console.log(`[KAMBA] Tool chamada: ${functionName}`);

  // Mapeamento de tools locais (Insights) e possíveis extensões futuras
  const toolHandlers = {
    getFluxoCaixaMensal: () => Insights.getFluxoCaixaMensal?.(usuarioId),
    getResumoObjetivos: () => Insights.getResumoObjetivos?.(usuarioId),
    getFundoEmergenciaStatus: () => Insights.getFundoEmergenciaStatus?.(usuarioId),
    getGastosPorCategoria: () => Insights.getGastosPorCategoria?.(usuarioId),
    getComparacaoMensal: () => Insights.getComparacaoMensal?.(usuarioId),
    getCartoesStatus: () => Insights.getCartoesStatus?.(usuarioId),
  };

  const handler = toolHandlers[functionName];

  if (!handler) {
    console.warn(`[KAMBA] Tool não encontrada: ${functionName}`);
    return { erro: `Ferramenta '${functionName}' não disponível`, disponivel: false };
  }

  try {
    const resultado = await handler();
    return resultado || { erro: 'Sem dados disponíveis', disponivel: true };
  } catch (err) {
    console.error(`[KAMBA] Erro na tool ${functionName}:`, err.message);
    return { erro: `Erro ao executar ferramenta: ${err.message}`, disponivel: true };
  }
};

/**
 * Processa múltiplas tool calls em paralelo (mais eficiente)
 */
const processarToolCalls = async (toolCalls, usuarioId, messages, firstResponseMessage) => {
  // Adiciona a mensagem do assistant com os tool_calls ao histórico
  messages.push(firstResponseMessage);

  // Executa todas as tools em paralelo
  const resultados = await Promise.allSettled(
    toolCalls.map(tc => executarTool(tc, usuarioId))
  );

  // Adiciona resultados de cada tool ao histórico
  toolCalls.forEach((tc, idx) => {
    const resultado = resultados[idx].status === 'fulfilled'
      ? resultados[idx].value
      : { erro: resultados[idx].reason?.message || 'Erro desconhecido' };

    messages.push({
      role: "tool",
      tool_call_id: tc.id,
      content: JSON.stringify(resultado)
    });
  });

  return messages;
};

// ==========================================
// CLASSIFICADOR DE INTENT — decide se a IA precisa de tools
// ==========================================

/**
 * Determina se a chamada à IA deve incluir ferramentas financeiras.
 *
 * Estratégia em 3 camadas:
 * 1. Blacklist imediata: mensagens que NUNCA precisam de tools
 * 2. Whitelist explícita: keywords que SEMPRE indicam pedido de dados
 * 3. Contexto: "sim"/"claro" só ativa tools se a última resposta do assistente
 *    terminou com uma pergunta sobre dados financeiros específicos
 *
 * Princípio: em caso de dúvida → NÃO passar tools.
 */
const precisaDeTools = (msgLower, historicoRecente = []) => {

  // ── 1. BLACKLIST — nunca precisam de tools ─────────────────────────────────
  const NUNCA_TOOLS = [
    /^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|komé|kome|salve|e aí|tudo bem)\b/,
    /^(obrigad[ao]|valeu|fixe|ok|certo|entend[oi]|perceb[oi]|sim\s*(?:,.*)?$|não\s*(?:,.*)?$)/,
    /^(ajuda|help|cancelar|sair|fluxos)$/,
    /^(bom|boa|fixe|massa|parabéns|top|incrível|amazing)\b/,
    /(como (poupar|economizar)|dica|conselho|o que (achas|recomendas)|vale a pena|devo (comprar|vender|investir))/,
    /(notícia|economia|angola|petróleo|dólar|inflação|mercado|crise|exporta)/,
    /(o que é|explica|como funciona|diferença entre|o que significa)/,
  ];

  if (NUNCA_TOOLS.some(re => re.test(msgLower))) return false;

  // ── 2. WHITELIST EXPLÍCITA — pedido directo de dados ───────────────────────
  const PEDE_DADOS = [
    // Saldo e contas
    /\b(qual|quanto|ver|mostrar|analisar|análise)\b.*(saldo|gasto|despesa|receita|objetivo|meta|fundo|cartão|conta)/,
    /\b(saldo|gastos do mês|despesas do mês|fluxo de caixa)\b/,
    /\b(meus gastos|meus objetivos|minhas metas|meu saldo|minha conta)\b/,
    /\b(fundo de emergência|fundo emergencia)\b/,
    /\b(gastos por categoria|comparar com o mês|mês passado)\b/,
    /^(quanto (tenho|gastei|recebi|poupei))/,
    // Objetivos — múltiplas formas de perguntar
    /\b(objetivos?|metas?)\b.*(perto|próximo|mais perto|mais próximo|conclu|progresso|atingi|falt)/,
    /\b(quais|qual).*(objetivos?|metas?)\b/,
    /\b(como (vão|está|estão)).*(objetivos?|metas?|gastos?|saldo|contas?)\b/,
    /\b(progresso|percentagem|percentual|quanto falta).*(meta|objetivo)\b/,
    /\b(meta|objetivo).*(progresso|percentagem|percentual|quanto falta|mais perto|próxim)\b/,
    // Análise geral
    /\b(análise|analisar|resumo|como (vou|estou|ando)).*(mês|financ|dinheiro|kumbú)\b/,
    /\b(como (vou|estou|ando)) (financeiramente|este mês|neste mês|no mês)\b/,
  ];

  if (PEDE_DADOS.some(re => re.test(msgLower))) return true;

  // ── 3. CONTEXTO: "sim"/"claro"/"bora" após pergunta do assistente ───────────
  // Só ativa tools se a última mensagem do assistente perguntou
  // EXPLICITAMENTE se o user quer ver DADOS (saldo, gastos, objetivos, etc.)
  const RESPOSTAS_AFIRMATIVAS = /^(sim|claro|bora|pode|quero|vai|yha|exacto|isso|ok sim|s$)/;

  if (RESPOSTAS_AFIRMATIVAS.test(msgLower)) {
    // Busca a última mensagem do assistente no histórico
    const ultimaRespAssistente = [...historicoRecente]
      .reverse()
      .find(m => m.role === 'assistant')
      ?.content?.toLowerCase() || '';

    // A última resposta do assistente propôs buscar dados específicos?
    const PROPOSTA_DADOS = [
      /quer(es)? (que eu )?(mostrar|ver|verificar|analisar|buscar)/,
      /posso (mostrar|ver|verificar|analisar|buscar)/,
      /quer(es)? ver (o (teu|tua)|os teus|as tuas)/,
      /mostro(-te)? (o saldo|os gastos|os objetivos|o fundo|as contas)/,
      /ver (o teu saldo|os teus gastos|os teus objetivos)/,
    ];

    return PROPOSTA_DADOS.some(re => re.test(ultimaRespAssistente));
  }

  // Padrão: sem tools
  return false;
};



const chamarGroq = async (messages, comTools = true, tentativa = 1) => {
  const MAX_TENTATIVAS = 2;

  const body = {
    model: GROQ_MODEL,
    messages,
    // Conversacional: resposta curta forçada. Com dados: permite mais tokens.
    max_tokens: comTools ? 600 : 180,
    temperature: comTools ? 0.5 : 0.4,
  };

  if (comTools) {
    body.tools = availableTools;
    body.tool_choice = "auto";
  }

  try {
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000) // timeout de 15s
    });

    if (response.status === 429 && tentativa < MAX_TENTATIVAS) {
      // Rate limit da Groq: aguarda 1s e tenta novamente
      await new Promise(r => setTimeout(r, 1000));
      return chamarGroq(messages, comTools, tentativa + 1);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Groq HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    return await response.json();
  } catch (err) {
    if (tentativa < MAX_TENTATIVAS && err.name !== 'AbortError') {
      await new Promise(r => setTimeout(r, 500));
      return chamarGroq(messages, comTools, tentativa + 1);
    }
    throw err;
  }
};

// ==========================================
// CONTROLLER PRINCIPAL
// ==========================================

const conversarComKamba = async (req, res, next) => {
  const inicio = Date.now();

  try {
    const { mensagem } = req.body;
    const usuarioId = req.user.id;

    // 1. RATE LIMITING
    const rateCheck = verificarRateLimit(usuarioId);
    if (rateCheck.bloqueado) {
      return kambaRes(res,
        `Calma aí, kamba! Muitas perguntas de uma vez. Aguarda ${rateCheck.tentarEm}s. 😅`,
        { rateLimited: true, tentarEm: rateCheck.tentarEm }
      );
    }

    // 2. VALIDAÇÃO
    if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length === 0) {
      return kambaRes(res, getFallback('nao_entendido'));
    }

    const msg = mensagem.trim();
    if (msg.length > 500) {
      return kambaRes(res, 'Mensagem muito longa, kamba! Resume (máx. 500 caracteres).');
    }

    const msgLower = msg.toLowerCase();

    // 3. VERIFICAR FLUXO GUIADO ATIVO
    if (Wizard.temFluxoAtivo(usuarioId)) {
      if (msgLower === 'cancelar' || msgLower === 'sair') {
        const resp = Wizard.cancelarFluxo(usuarioId);
        await salvarMemoria(usuarioId, 'user', mensagem, 'fluxo_cancelado');
        await salvarMemoria(usuarioId, 'assistant', resp, 'fluxo_cancelado');
        return kambaRes(res, resp);
      }

      const resultado = await Wizard.processarRespostaFluxo(usuarioId, msg);
      await salvarMemoria(usuarioId, 'user', mensagem, `fluxo_${resultado.fluxoTipo || 'ativo'}`);
      await salvarMemoria(usuarioId, 'assistant', resultado.mensagem, `fluxo_${resultado.fluxoTipo || 'ativo'}`);

      return kambaRes(res, resultado.mensagem, {
        fluxoAtivo: resultado.continuar,
        fluxoConcluido: resultado.concluido
      });
    }

    // 4. DETECTAR INTENÇÃO DE FLUXO GUIADO
    const intencaoFluxo = Wizard.detectarIntencaoFluxo(msgLower);
    if (intencaoFluxo) {
      const perguntaInicial = Wizard.iniciarFluxo(usuarioId, intencaoFluxo);
      await salvarMemoria(usuarioId, 'user', mensagem, 'inicio_fluxo');
      await salvarMemoria(usuarioId, 'assistant', perguntaInicial, 'inicio_fluxo');
      return kambaRes(res, perguntaInicial, { fluxoAtivo: true, fluxoTipo: intencaoFluxo });
    }

    // 5. SAUDAÇÕES E CONVERSA CASUAL — tratadas ANTES de qualquer acesso a memória ou IA
    const isSaudacao = /^(oi|ol[aá]|hey|hi|hello|bom dia|boa tarde|boa noite|boa madrugada|kom[eé]|salve|ndenge|maka|e a[ií]|eai|e ae|tudo (bem|bom|fixe|certo|ok|[oó]timo|direito|tranquilo|liso|na boa)|como (vais|vai|est[aá]s|esta|[eé]s|e)|e (tu|voc[eê])|boas|boa|oi kamba|ol[aá] kamba|que (tal|bu[eé]|bombo)|massa|fixe|top|legal)\??[!.]*$/.test(msgLower);

    // Expressões de reacção/confirmação que sozinhas não pedem dados
    // ATENÇÃO: NÃO incluir "porquê", "como assim", "explica" — são perguntas de follow-up
    // que precisam de contexto e devem ir para a IA
    const isReacaoCasual = /^(ok(ay)?|sim|n[aã]o|certo|entendi|entendido|percebido|percebo|claro|show|combinado|valeu|obrigad[ao]|xêtu|brigado|exato|exacto|correto|correcto|tudo (fixe|bem|bom|certo|top|ok|liso|na boa|[oó]timo)|t[aá] (fixe|bem|bom|certo|ok|liso)|que (bom|[oó]ptimo)|massa|top|incrível|[oó]timo|otimo|perfeito|que bom|muito (bom|bem|boa)|fixe demais|top demais)\s*[!.?]*$/.test(msgLower);

    // Perguntas de follow-up — NUNCA são casual, vão sempre para a IA com histórico
    const isFollowUp = /^(porqu[eê]\?*|como assim\?*|explica\?*|e depois\?*|e agora\?*|o que (devo|posso|faço)\?*|mas (porqu[eê]|como)\?*)$/.test(msgLower);

    if (isSaudacao && !isFollowUp) {
      const nomeUser = await prisma.user.findUnique({
        where: { id: usuarioId },
        select: { nome: true }
      }).then(u => u?.nome || 'kamba').catch(() => 'kamba');

      const variantes = [
        `Komé, ${nomeUser}! 👊 Em que posso ajudar hoje?`,
        `Boas, ${nomeUser}! Tudo bem por aí? O que precisas?`,
        `Ei, ${nomeUser}! Como posso ajudar-te hoje?`,
        `Olá, ${nomeUser}! Por aqui para te ajudar. O que queres saber?`,
        `Boa, ${nomeUser}! Tô aqui. O que precisas?`,
      ];
      const resp = variantes[Math.floor(Math.random() * variantes.length)];
      await salvarMemoria(usuarioId, 'user', mensagem, 'saudacao');
      await salvarMemoria(usuarioId, 'assistant', resp, 'saudacao');
      return kambaRes(res, resp);
    }

    if (isReacaoCasual && !isFollowUp) {
      const respostas = [
        'Boa! Se precisares de alguma coisa, é só dizer. 👊',
        'Fixe! Qualquer coisa estou aqui.',
        'Ok, kamba! Precisas de mais alguma coisa?',
        'Certo! Estou aqui se precisares.',
      ];
      const resp = respostas[Math.floor(Math.random() * respostas.length)];
      await salvarMemoria(usuarioId, 'user', mensagem, 'reacao_casual');
      await salvarMemoria(usuarioId, 'assistant', resp, 'reacao_casual');
      return kambaRes(res, resp);
    }

    if (msgLower === 'ajuda' || msgLower === 'help') {
      const ajuda = `🤖 *Comandos do Kamba:*

💰 *Consultas Rápidas:*
• "Qual o meu saldo?"
• "Último gasto"
• "Como vão meus objetivos?"
• "Análise do mês"

🔄 *Fluxos Guiados:*
• "Criar meta"
• "Registar gasto"

🗣️ *Conversa livre:*
Podes perguntar qualquer coisa sobre finanças! Exemplo: "Devo comprar dólar?" ou "Como poupar mais?"

• Digita *"cancelar"* para sair de qualquer fluxo

Manda aí, kamba! 👊`;

      await salvarMemoria(usuarioId, 'user', mensagem, 'ajuda');
      await salvarMemoria(usuarioId, 'assistant', ajuda, 'ajuda');
      return kambaRes(res, ajuda);
    }

    if (msgLower === 'fluxos' || /o que (podes|fazes|consegues) fazer/.test(msgLower)) {
      const lista = Wizard.listarFluxos();
      await salvarMemoria(usuarioId, 'user', mensagem, 'listar_fluxos');
      await salvarMemoria(usuarioId, 'assistant', lista, 'listar_fluxos');
      return kambaRes(res, lista);
    }

    // 6. VERIFICAR CACHE (apenas para mensagens sem dados dinâmicos)
    // Não cacheamos queries financeiras pois os dados mudam
    const NÃO_CACHEAR = /saldo|gasto|metas?|objetivo|dinheiro|kumbú|tabua|fluxo|emergência/i;
    if (!NÃO_CACHEAR.test(msgLower)) {
      const respostaCache = verificarCache(usuarioId, msgLower);
      if (respostaCache) {
        return kambaRes(res, respostaCache, { fromCache: true });
      }
    }

    // 7. BUSCAR PERFIL DO UTILIZADOR
    const perfil = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: {
        nome: true, morada: true, dataNascimento: true,
        rendaMensalMedia: true, perfilDeRisco: true
      }
    });

    const idade = perfil?.dataNascimento
      ? new Date().getFullYear() - new Date(perfil.dataNascimento).getFullYear()
      : 'não informada';

    // 8. RESPOSTAS HEURÍSTICAS RÁPIDAS (sem IA)
    const intentLocal = detectarIntentLocal(msgLower);

    // Nota: saudações já foram tratadas no step 5 — aqui só chegam consultas de dados

    if (intentLocal === 'consulta_saldo') {
      const cartoes = await prisma.cartao.findMany({
        where: { usuarioId, ativo: true, excluido: false }
      });

      if (cartoes.length === 0) {
        const resp = getFallback('sem_dados');
        await salvarMemoria(usuarioId, 'user', mensagem, 'consulta_saldo');
        await salvarMemoria(usuarioId, 'assistant', resp, 'consulta_saldo');
        return kambaRes(res, resp);
      }

      const total = cartoes.reduce((acc, c) => acc + Number(c.saldoAtual || 0), 0);
      const detalhe = cartoes.length > 1
        ? ` (distribuído por ${cartoes.length} contas)`
        : ` na conta ${cartoes[0].nome}`;
      const resp = `Tens *${total.toLocaleString('pt-AO')} AOA*${detalhe}, kamba! 💰`;

      await salvarMemoria(usuarioId, 'user', mensagem, 'consulta_saldo');
      await salvarMemoria(usuarioId, 'assistant', resp, 'consulta_saldo');
      return kambaRes(res, resp);
    }

    if (intentLocal === 'consulta_ultimo_gasto') {
      const ultimo = await prisma.gasto.findFirst({
        where: { usuarioId, excluido: false },
        orderBy: { data: 'desc' },
        include: { categoria: true }
      });

      if (!ultimo) {
        const resp = getFallback('sem_dados');
        await salvarMemoria(usuarioId, 'user', mensagem, 'consulta_ultimo_gasto');
        await salvarMemoria(usuarioId, 'assistant', resp, 'consulta_ultimo_gasto');
        return kambaRes(res, resp);
      }

      const dataGasto = new Date(ultimo.data).toLocaleDateString('pt-AO');
      const resp = `Último gasto: *${Number(ultimo.valor).toLocaleString('pt-AO')} AOA* em *${ultimo.categoria?.nome || 'Geral'}* (${dataGasto}) 📝`;
      await salvarMemoria(usuarioId, 'user', mensagem, 'consulta_ultimo_gasto');
      await salvarMemoria(usuarioId, 'assistant', resp, 'consulta_ultimo_gasto');
      return kambaRes(res, resp);
    }

    // 9. IA AVANÇADA
    if (!GROQ_API_KEY) {
      const resp = getFallback('api_offline');
      return kambaRes(res, resp);
    }

    // Carrega histórico de memória
    const memoriaDB = await carregarMemoria(usuarioId);

    // Determina se a query pede dados financeiros
    const devePedirTools = precisaDeTools(msgLower, memoriaDB);
    console.log(`[KAMBA] Tools: ${devePedirTools ? 'SIM' : 'NÃO'} | msg: "${msgLower.substring(0, 50)}"`);

    let messages;

    if (devePedirTools) {
      // Query financeira: contexto completo + tools disponíveis
      messages = [
        { role: "system", content: gerarSystemPrompt(perfil, idade) },
        ...memoriaDB,
        { role: "user", content: msg }
      ];
    } else {
      // Query conversacional: contexto MÍNIMO, sem histórico financeiro.
      // Regra: o model não deve "ver" saldos/transacções que não foram pedidos agora.
      // Passa só últimas 4 mensagens, com dados financeiros redacted.
      const historicoMinimo = memoriaDB
        .slice(-4)
        .map(m => {
          if (m.role !== 'assistant') return m;
          const temDados = /\d{3,}[\s.]?\d{3}.*aoa|multicaixa|conta bai|bfa|bic|fundo de emergência|ativos|negócio de revenda|\d+%.*renda|kwanza|saldo.*aoa/i.test(m.content);
          return temDados ? { ...m, content: '[dados financeiros anteriores]' } : m;
        });

      messages = [
        {
          role: "system",
          content: `És o Kamba, assistente financeiro angolano da KambaPro.
Nome do utilizador: ${perfil?.nome || 'kamba'}.
Tom: casual, amigável, angolano.
REGRA OBRIGATÓRIA: Responde APENAS à mensagem do utilizador. NÃO menciones dados financeiros, saldos, gastos, investimentos ou números. Se for conversa social, responde socialmente. MÁXIMO 2 frases curtas.`
        },
        ...historicoMinimo,
        { role: "user", content: msg }
      ];
    }

    const data = await chamarGroq(messages, devePedirTools);

    let finalContent;
    const primeiraMsg = data.choices?.[0]?.message;

    // Processa tool calls (suporte a múltiplas)
    if (primeiraMsg?.tool_calls?.length > 0) {
      messages = await processarToolCalls(primeiraMsg.tool_calls, usuarioId, messages, primeiraMsg);

      // Segunda chamada para gerar resposta final com dados das tools
      const secondData = await chamarGroq(messages, false);
      finalContent = secondData.choices?.[0]?.message?.content;
    } else {
      finalContent = primeiraMsg?.content;
    }

    if (!finalContent) {
      finalContent = getFallback('erro_generico');
    }

    // 10. ADICIONAR LEMBRETES PROATIVOS
    finalContent = await Proatividade.adicionarLembretesNaResposta(usuarioId, finalContent);

    // 11. SALVAR MEMÓRIA
    await salvarMemoria(usuarioId, 'user', msg, 'conversa_ia');
    await salvarMemoria(usuarioId, 'assistant', finalContent, 'conversa_ia');

    // Cache apenas para respostas não financeiras
    if (!NÃO_CACHEAR.test(msgLower)) {
      salvarCache(usuarioId, msgLower, finalContent);
    }

    // 12. LOG DE PERFORMANCE E ESTATÍSTICAS
    const latencia = Date.now() - inicio;
    const tokensUsados = data.usage?.total_tokens || 0;
    console.log(`[KAMBA] User: ${usuarioId} | Latência: ${latencia}ms | Tokens: ${tokensUsados} | Tools: ${primeiraMsg?.tool_calls?.length || 0}`);

    try {
      await prisma.kambaUsage.create({
        data: {
          usuarioId,
          tokens: tokensUsados,
          latencia,
          modelo: GROQ_MODEL,
          sucesso: true
        }
      });
    } catch (err) {
      console.error('[STATS] Erro ao salvar estatísticas:', err.message);
    }

    return kambaRes(res, finalContent, { latencia: `${latencia}ms` });

  } catch (err) {
    console.error('[KAMBA ERROR]:', err.message);

    try {
      await prisma.kambaUsage.create({
        data: {
          usuarioId: req.user?.id,
          tokens: 0,
          latencia: Date.now() - inicio,
          modelo: GROQ_MODEL || 'unknown',
          sucesso: false,
          erro: err.message?.substring(0, 500)
        }
      });
    } catch (logErr) {
      console.error('[STATS] Erro ao logar falha:', logErr.message);
    }

    return kambaRes(res, getFallback('erro_generico'));
  }
};

// ==========================================
// ROTA DE FEEDBACK
// ==========================================

const enviarFeedback = async (req, res, next) => {
  try {
    const { mensagemId, avaliacao, comentario } = req.body;
    const usuarioId = req.user.id;

    const avaliacaoInt = parseInt(avaliacao);
    if (isNaN(avaliacaoInt) || avaliacaoInt < 1 || avaliacaoInt > 5) {
      return res.status(400).json({
        success: false,
        message: 'Avaliação inválida. Use número de 1 a 5'
      });
    }

    await prisma.kambaFeedback.create({
      data: {
        usuarioId,
        mensagemId: mensagemId || null,
        avaliacao: avaliacaoInt,
        comentario: comentario?.substring(0, 1000) || null
      }
    });

    return res.json({
      success: true,
      message: 'Obrigado pelo feedback, kamba! 🙏'
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  conversarComKamba,
  enviarFeedback
};