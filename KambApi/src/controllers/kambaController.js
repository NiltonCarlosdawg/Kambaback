const prisma = require('../lib/prisma');
const Insights = require('./insightsController');
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
    "Desculpa, kamba! Não consegui processar isso agora. ",
    "Bró, deu bug aqui. Tenta reformular a pergunta?",
    "Eish! Me perdi nessa. Podes dizer de outra forma?"
  ],
  nao_entendido: [
    "Não apanhei bem, mano. Queres saber sobre:\n•  Saldo\n•  Gastos\n•  Metas\n•  Fluxos guiados",
    "Mmm, não percebi. Experimenta:\n• 'Qual é o meu saldo?'\n• 'Criar meta'\n• 'Registar gasto'",
    "Confuso aqui, kamba. Digita 'ajuda' para ver o que posso fazer!",
    "Assim mesmo não consegues escrever bem?..."
  ],
  sem_dados: [
    "Ainda não tens dados suficientes, mano. Adiciona alguns gastos primeiro!",
    "Epa, tá vazio aqui! Regista movimentos na app para eu te ajudar melhor.",
    "Preciso de mais info, kamba. Vai na app e adiciona gastos ou metas."
  ],
  api_offline: [
    "O cérebro tá offline agora.  Tenta em alguns minutos, yha?",
    "Sistema sobrecarregado, kamba. Aguarda uns 2 minutos e volta.",
    "Servidor ocupado. Relaxa um pouco e tenta de novo! "
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
};

// Rate limiting
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
// MEMÓRIA PERSISTENTE - CORRIGIDO
// ==========================================

/**
 * Salva mensagem na memória do Kamba
 * CORREÇÕES:
 * - Adicionado campos obrigatórios: role, content, contexto
 * - Usa criadoEm ao invés de timestamp
 */
const salvarMemoria = async (usuarioId, role, content, contexto = '') => {
  try {
    await prisma.kambaMemoria.create({
      data: { 
        usuarioId, 
        role, 
        content, 
        contexto: contexto || content.substring(0, 200) // Contexto truncado se não fornecido
      }
    });

    // Mantém apenas últimas 20 mensagens
    const todas = await prisma.kambaMemoria.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' } // CORRIGIDO: usa criadoEm
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

/**
 * Carrega histórico de memória do usuário
 * CORREÇÃO: ordena por criadoEm ao invés de timestamp
 */
const carregarMemoria = async (usuarioId) => {
  try {
    const mensagens = await prisma.kambaMemoria.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'asc' }, // CORRIGIDO: era timestamp
      take: 15
    });
    return mensagens.map(m => ({ role: m.role, content: m.content }));
  } catch (err) {
    console.error('[MEMÓRIA] Erro:', err.message);
    return [];
  }
};

// ==========================================
// SYSTEM PROMPT
// ==========================================

const gerarSystemPrompt = (perfil, idade) => {
  return `Tu és o KAMBA, assistente virtual de gestão financeira focado na realidade de Angola.

### DADOS DO UTILIZADOR:
- Nome: ${perfil.nome}
- Localização: ${perfil.morada || 'Luanda'}
- Idade: ${idade} anos
- Renda: ${perfil.rendaMensalMedia?.toLocaleString('pt-AO')} AOA
- Perfil: ${perfil.perfilDeRisco || 'Moderado'}

### PERSONALIDADE:
- Angolano autêntico: usa "kamba", "mano", "bró", "yha", "mambo", "eish"
- Tom amigável, motivador e descontraído
- Contexto local: ENDE, Nosso Super, candongueiro, Kwanza
- Nunca uses inglês ou traduções literais
- Humor leve
- Atencioso e empático
- Proativo em ajudar
- Incentiva educação financeira
- Sugere funcionalidades da app
- Sabe quando o usuário está frustrado ou confuso
- Sabe quando parar ou quando o usuário precisa de ajuda humana

### REGRAS:
1. Respostas CURTAS: máx 3-4 frases
2. Se não tens dados, pede ao user registrar
3. Nunca promete ganhos garantidos
4. Sugere ações concretas
5. Usa emojis raramente
6. Se houver algum erro ao gerar resposta nunca termos que identificam as tools usadas
7. Sempre que possível, usa dados reais do usuário
8. Se não souberes a resposta, admite honestamente
9. Analise o usuário pela sua escrita antes de usar jargões técnicos, caso ele não demonstre familiaridade, use uma linguagem mais simples e acessível
10. Sempre que possível, relacione suas respostas com a realidade angolana, utilizando exemplos e contextos locais para tornar a conversa mais relevante e envolvente

## USO CORRETO DE ALGUNS TERMOS:
- "Kamba": amigo, colega
- "Bró": irmão, parceiro
- "Mambo": assunto, coisa
- "Yha": expressão de concordância
- "Eish": expressão de surpresa ou frustração
- "Candongueiro": transporte público informal
- "Kwanza": moeda angolana
- "Kumbú": dinheiro
- "Tabua": dinheiro
- "Bater na parede": gastar todo o dinheiro sem controle

### TOOLS DISPONÍVEIS:
- getFluxoCaixaMensal: receitas/despesas do mês
- getResumoObjetivos: progresso de metas
- getFundoEmergenciaStatus: status da reserva

### EXEMPLOS:
User: "Oi"
Kamba: "Komé..., ${perfil.nome}! 👊 Como posso ajudar?"

User: "Bati o kumbú na parede"
Kamba: "Eish, kamba! Bora rever teus gastos e criar um plano pra evitar isso de novo. Quer ajuda?"

User: "A tabua que tenho agora não chega"
Kamba: "Calma, mano! Vamos analisar teus gastos e ver onde podes cortar pra melhorar teu fluxo. Quer um resumo do mês?"

User: "Quanto gastei?"
Kamba: "Deixa ver... [usa tool] 45k AOA este mês, maior parte em alimentação. Tá ok!"

User: "Comprar carro?"
Kamba: "Com ${perfil.rendaMensalMedia} AOA, sugiro: 1) Fundo emergência (6 meses), 2) Entrada 30%. Criar meta?"`;
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
        `Calma aí, kamba! Muitas perguntas de uma vez. Aguarda ${rateCheck.tentarEm}s.`,
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

    // 4. DETECTAR INTENÇÃO DE FLUXO
    const intencaoFluxo = Wizard.detectarIntencaoFluxo(msgLower);
    if (intencaoFluxo) {
      const perguntaInicial = Wizard.iniciarFluxo(usuarioId, intencaoFluxo);
      await salvarMemoria(usuarioId, 'user', mensagem, 'inicio_fluxo');
      await salvarMemoria(usuarioId, 'assistant', perguntaInicial, 'inicio_fluxo');
      return kambaRes(res, perguntaInicial, { fluxoAtivo: true, fluxoTipo: intencaoFluxo });
    }

    // 5. COMANDOS ESPECIAIS
    if (msgLower === 'ajuda' || msgLower === 'help') {
      const ajuda = ` *Comandos do Kamba:*

 *Consultas:*
• "Qual o meu saldo?"
• "Último gasto"
• "Como vão meus objetivos?"

 *Fluxos Guiados:*
• "Criar meta"
• "Registar gasto"
• "Análise do mês"

 *Outros:*
• "Ajuda" - Esta mensagem
• "Cancelar" - Sair de fluxo ativo

Manda aí, kamba! `;
      
      await salvarMemoria(usuarioId, 'user', mensagem, 'ajuda');
      await salvarMemoria(usuarioId, 'assistant', ajuda, 'ajuda');
      return kambaRes(res, ajuda);
    }

    if (msgLower === 'fluxos' || msgLower.includes('o que fazes')) {
      const lista = Wizard.listarFluxos();
      await salvarMemoria(usuarioId, 'user', mensagem, 'listar_fluxos');
      await salvarMemoria(usuarioId, 'assistant', lista, 'listar_fluxos');
      return kambaRes(res, lista);
    }

    // 6. VERIFICAR CACHE
    const respostaCache = verificarCache(usuarioId, msgLower);
    if (respostaCache) {
      return kambaRes(res, respostaCache, { fromCache: true });
    }

    // 7. BUSCAR PERFIL
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

    // 8. REGRAS HEURÍSTICAS (respostas rápidas)
    if (msgLower.includes('oi') || msgLower.includes('olá') || msgLower.includes('hey')) {
      const resp = `Komé..., ${perfil.nome}! 👊 Como posso ajudar hoje?`;
      await salvarMemoria(usuarioId, 'user', mensagem, 'saudacao');
      await salvarMemoria(usuarioId, 'assistant', resp, 'saudacao');
      salvarCache(usuarioId, msgLower, resp);
      return kambaRes(res, resp);
    }

    if (msgLower.includes('saldo') || msgLower.includes('quanto tenho')) {
      const cartoes = await prisma.cartao.findMany({ 
        where: { usuarioId, ativo: true } 
      });
      
      if (cartoes.length === 0) {
        const resp = getFallback('sem_dados');
        await salvarMemoria(usuarioId, 'user', mensagem, 'consulta_saldo');
        await salvarMemoria(usuarioId, 'assistant', resp, 'consulta_saldo');
        return kambaRes(res, resp);
      }

      const total = cartoes.reduce((acc, c) => acc + Number(c.saldoAtual || 0), 0);
      const resp = `Tens *${total.toLocaleString('pt-AO')} AOA* no total, kamba! 💰`;
      
      await salvarMemoria(usuarioId, 'user', mensagem, 'consulta_saldo');
      await salvarMemoria(usuarioId, 'assistant', resp, 'consulta_saldo');
      salvarCache(usuarioId, msgLower, resp);
      return kambaRes(res, resp);
    }

    if (msgLower.includes('último gasto') || msgLower.includes('gastei')) {
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

      const resp = `Último gasto: *${Number(ultimo.valor).toLocaleString('pt-AO')} AOA* em *${ultimo.categoria?.nome || 'Geral'}* 📝`;
      await salvarMemoria(usuarioId, 'user', mensagem, 'consulta_ultimo_gasto');
      await salvarMemoria(usuarioId, 'assistant', resp, 'consulta_ultimo_gasto');
      salvarCache(usuarioId, msgLower, resp);
      return kambaRes(res, resp);
    }

    // 9. IA AVANÇADA
    if (!GROQ_API_KEY) {
      const resp = getFallback('api_offline');
      return kambaRes(res, resp);
    }

    // Carrega memória
    const memoriaDB = await carregarMemoria(usuarioId);
    
    let messages = [
      { role: "system", content: gerarSystemPrompt(perfil, idade) },
      ...memoriaDB,
      { role: "user", content: mensagem }
    ];

    // Chamada à IA
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${GROQ_API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        tools: availableTools,
        tool_choice: "auto",
        temperature: 0.6,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      console.error('[GROQ ERROR]:', response.status);
      const resp = getFallback('api_offline');
      return kambaRes(res, resp);
    }

    const data = await response.json();
    let finalContent;

    // Processa tool calls
    if (data.choices?.[0]?.message?.tool_calls) {
      const toolCall = data.choices[0].message.tool_calls[0];
      const functionName = toolCall.function.name;
      
      console.log(`[KAMBA] Tool chamada: ${functionName}`);

      const toolResult = typeof Insights[functionName] === 'function' 
        ? await Insights[functionName](usuarioId)
        : { erro: "Função não encontrada" };

      messages.push(data.choices[0].message);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult)
      });

      const secondResponse = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${GROQ_API_KEY}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          model: GROQ_MODEL, 
          messages: messages, 
          temperature: 0.5,
          max_tokens: 500
        })
      });

      const secondData = await secondResponse.json();
      finalContent = secondData.choices?.[0]?.message?.content;
    } else {
      finalContent = data.choices?.[0]?.message?.content;
    }

    if (!finalContent) {
      finalContent = getFallback('erro_generico');
    }

    // 10. ADICIONAR LEMBRETES PROATIVOS
    finalContent = await Proatividade.adicionarLembretesNaResposta(usuarioId, finalContent);

    // 11. SALVAR MEMÓRIA - CORRIGIDO com contexto
    await salvarMemoria(usuarioId, 'user', mensagem, 'conversa_ia');
    await salvarMemoria(usuarioId, 'assistant', finalContent, 'conversa_ia');
    salvarCache(usuarioId, msgLower, finalContent);

    // 12. LOG DE PERFORMANCE - CORRIGIDO
    const latencia = Date.now() - inicio;
    const tokensUsados = data.usage?.total_tokens || 0;
    console.log(`[KAMBA] User: ${usuarioId} | Latência: ${latencia}ms | Tokens: ${tokensUsados}`);

    // Salvar estatísticas - CORRIGIDO com campos do schema atualizado
    try {
      await prisma.kambaUsage.create({
        data: {
          usuarioId,
          tokens: tokensUsados,
          latencia: latencia,
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
    
    // Tenta salvar log de erro
    try {
      await prisma.kambaUsage.create({
        data: {
          usuarioId: req.user?.id,
          tokens: 0,
          latencia: Date.now() - inicio,
          modelo: GROQ_MODEL || 'unknown',
          sucesso: false,
          erro: err.message
        }
      });
    } catch (logErr) {
      console.error('[STATS] Erro ao logar falha:', logErr.message);
    }
    
    return kambaRes(res, getFallback('erro_generico'));
  }
};

// ==========================================
// TOOLS DISPONÍVEIS
// ==========================================

const availableTools = [
  {
    type: "function",
    function: {
      name: "getFluxoCaixaMensal",
      description: "Obtém receitas, despesas e poupança do mês atual",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getResumoObjetivos",
      description: "Obtém progresso de todos os objetivos financeiros",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getFundoEmergenciaStatus",
      description: "Verifica status do fundo de emergência",
      parameters: { type: "object", properties: {} }
    }
  }
];

// ==========================================
// ROTA DE FEEDBACK - CORRIGIDO
// ==========================================

const enviarFeedback = async (req, res, next) => {
  try {
    const { mensagemId, avaliacao, comentario } = req.body;
    const usuarioId = req.user.id;

    // CORRIGIDO: validação para Int ao invés de String enum
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
        comentario: comentario || null
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