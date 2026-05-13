const prisma = require('../../../lib/prisma');
const Wizard = require('./kambaWizardController');
const Proatividade = require('../services/kambaProatividadeService');

const groqClient = require('../services/ai/groqClient');
const promptBuilder = require('../services/ai/promptBuilder');
const intentClassifier = require('../services/ai/intentClassifier');
const toolRegistry = require('../services/ai/toolRegistry');
const conversationService = require('../services/memory/conversationService');
const cacheService = require('../services/core/cacheService');
const { kambaRes, getFallback, getRespostaOffline } = require('../services/core/responseFormatter');
const analytics = require('../services/core/analyticsService');
const { agregarContexto, formatarContextoFinanceiro } = require('../services/ai/contextAggregator');
const toolsPlugin = require('../plugins/tools');

// ==========================================
// INIT: Carregar ferramentas dos plugins
// ==========================================
toolsPlugin.init();

// ==========================================
// CONTROLLER PRINCIPAL
// ==========================================

const conversarComKamba = async (req, res, next) => {
  const inicio = Date.now();
  const { mensagem } = req.body;
  const usuarioId = req.user.id;

  try {
    // 1. VALIDAÇÃO
    if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length === 0) {
      return kambaRes(res, getFallback('nao_entendido'));
    }

    const msg = mensagem.trim();
    if (msg.length > 500) {
      return kambaRes(res, 'Mensagem muito longa, kamba! Resume (máx. 500 caracteres). ✂️');
    }

    const msgLower = msg.toLowerCase();

    // 3. VERIFICAR FLUXO GUIADO ATIVO
    if (Wizard.temFluxoAtivo(usuarioId)) {
      if (msgLower === 'cancelar' || msgLower === 'sair') {
        const resp = Wizard.cancelarFluxo(usuarioId);
        await conversationService.salvarMemoria(usuarioId, 'user', mensagem, 'fluxo_cancelado');
        await conversationService.salvarMemoria(usuarioId, 'assistant', resp, 'fluxo_cancelado');
        return kambaRes(res, resp);
      }

      const resultado = await Wizard.processarRespostaFluxo(usuarioId, msg);
      await conversationService.salvarMemoria(usuarioId, 'user', mensagem, `fluxo_${resultado.fluxoTipo || 'ativo'}`);
      await conversationService.salvarMemoria(usuarioId, 'assistant', resultado.mensagem, `fluxo_${resultado.fluxoTipo || 'ativo'}`);

      return kambaRes(res, resultado.mensagem, {
        fluxoAtivo: resultado.continuar,
        fluxoConcluido: resultado.concluido
      });
    }

    // 4. DETECTAR INTENÇÃO DE FLUXO GUIADO
    const intencaoFluxo = Wizard.detectarIntencaoFluxo(msgLower);
    if (intencaoFluxo) {
      const perguntaInicial = Wizard.iniciarFluxo(usuarioId, intencaoFluxo);
      await conversationService.salvarMemoria(usuarioId, 'user', mensagem, 'inicio_fluxo');
      await conversationService.salvarMemoria(usuarioId, 'assistant', perguntaInicial, 'inicio_fluxo');
      return kambaRes(res, perguntaInicial, { fluxoAtivo: true, fluxoTipo: intencaoFluxo });
    }

    // 5. SAUDAÇÕES E CONVERSA CASUAL
    const isSaudacao = /^(oi|ol[aá]|hey|hi|hello|bom dia|boa tarde|boa noite|kom[eé]|salve|maka|e a[ií]|eai|tudo (bem|bom|fixe|certo|ok)|como (vais|vai|est[aá]s)|boas|que tal|massa|fixe|top|legal)\??[!.]*$/.test(msgLower);
    
    const isReacaoCasual = /^(ok(ay)?|sim|n[aã]o|certo|entendi|claro|show|valeu|obrigad[ao]|exato|exacto|correto|tudo (fixe|bem|bom|certo|top|ok)|massa|top|incrível|perfeito)\s*[!.?]*$/.test(msgLower);

    if (isSaudacao) {
      const nomeUser = await prisma.user.findUnique({
        where: { id: usuarioId },
        select: { nome: true }
      }).then(u => u?.nome || 'kamba').catch(() => 'kamba');

      const variantes = [
        `Komé, ${nomeUser}! 🙌 Em que posso ajudar hoje?`,
        `Boas, ${nomeUser}! Tudo bem por aí? O que precisas?`,
        `Boa, ${nomeUser}! Tô aqui. O que precisas?`,
      ];
      const resp = variantes[Math.floor(Math.random() * variantes.length)];
      await conversationService.salvarMemoria(usuarioId, 'user', mensagem, 'saudacao');
      await conversationService.salvarMemoria(usuarioId, 'assistant', resp, 'saudacao');
      return kambaRes(res, resp);
    }

    if (isReacaoCasual) {
      const respostas = [
        'Boa! Se precisares de alguma coisa, é só dizer. 👍',
        'Fixe! Qualquer coisa estou aqui.',
        'Ok, kamba! Precisas de mais alguma coisa?',
      ];
      const resp = respostas[Math.floor(Math.random() * respostas.length)];
      await conversationService.salvarMemoria(usuarioId, 'user', mensagem, 'reacao_casual');
      await conversationService.salvarMemoria(usuarioId, 'assistant', resp, 'reacao_casual');
      return kambaRes(res, resp);
    }

    if (msgLower === 'ajuda' || msgLower === 'help') {
      const ajuda = `🤖 *Comandos do Kamba:*

📊 *Consultas Rápidas:*
• "Qual o meu saldo?"
• "Quanto gastei este mês?"
• "Como vão meus objetivos?"
• "Preço do dólar?"

🎯 *Fluxos Guiados:*
• "Criar meta"
• "Registar gasto"

💬 *Conversa livre:*
• "Como poupar mais?"
• "Tenho 100 mil, quero começar um negócio"
• "Devo comprar dólar?"

Digita *"cancelar"* para sair de qualquer fluxo`;

      await conversationService.salvarMemoria(usuarioId, 'user', mensagem, 'ajuda');
      await conversationService.salvarMemoria(usuarioId, 'assistant', ajuda, 'ajuda');
      return kambaRes(res, ajuda);
    }

    // 6. VERIFICAR CACHE
    const NAO_CACHEAR = /saldo|gasto|metas?|objetivo|dinheiro|kumbú|tabua|fluxo|emergência|dolar|dólar/i;
    if (!NAO_CACHEAR.test(msgLower)) {
      const respostaCache = cacheService.verificar(usuarioId, msgLower);
      if (respostaCache) {
        return kambaRes(res, respostaCache, { fromCache: true });
      }
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

    // 8. AGREGAR CONTEXTO FINANCEIRO REAL (omnisciência)
    const contextoFinanceiro = await agregarContexto(usuarioId);
    const contextoFormatado = formatarContextoFinanceiro(contextoFinanceiro);

    // 9. CLASSIFICAR INTENÇÃO (com contexto semântico)
    const memoriaDB = await conversationService.carregarMemoriaComContexto(usuarioId, msg);
    const classificacao = intentClassifier.classificarIntencao(msgLower, memoriaDB);
    const { sentimento, intensidade: sentimentoIntensidade } = intentClassifier.detectarSentimento(msgLower);
    const idioma = intentClassifier.detectarIdioma(msgLower);

    console.log(`[KAMBA] Intenção: ${classificacao.intencao} | Tools: ${classificacao.precisaTools} | Confiança: ${classificacao.confianca} | Sentimento: ${sentimento} (${sentimentoIntensidade}) | Idioma: ${idioma}`);

    // 9. PREPARAR MENSAGENS PARA O LLM
    let messages;
    const threadId = 'default'; // Futuro: suportar múltiplas threads

    // Sanitizar: APENAS role + content (remove id, contexto, etc.)
    const sanitizarMsg = m => {
      const content = (m.content && typeof m.content === 'string')
        ? m.content.trim()
        : '';
      return {
        role: m.role === 'system' || m.role === 'user' || m.role === 'assistant' ? m.role : 'user',
        content: content.length > 0 ? content :
          m.role === 'assistant' ? '[...]' :
          m.role === 'system' ? '(sem contexto)' :
          ''
      };
    };
    const memoriaLimpa = memoriaDB.map(sanitizarMsg);

    // Garantir que a primeira mensagem após system é user (exigência da API Groq)
    const primeiroNaoSystem = memoriaLimpa.find(m => m.role !== 'system');
    if (primeiroNaoSystem && primeiroNaoSystem.role === 'assistant') {
      memoriaLimpa.unshift({ role: 'user', content: '[continuação da conversa]' });
    }

    if (classificacao.precisaTools) {
      // Query financeira: contexto completo + tools
      messages = [
        { role: 'system', content: promptBuilder.gerarSystemPrompt(perfil, idade, contextoFormatado) },
        ...memoriaLimpa.slice(-10),
        { role: 'user', content: msg }
      ];
    } else {
      // Query conversacional: contexto mínimo
      const historicoMinimo = memoriaLimpa
        .slice(-4)
        .map(m => {
          if (m.role !== 'assistant') return m;
          const temDados = /\d{3,}[\s.]?\d{3}.*aoa|multicaixa|conta bai|bfa|bic|fundo de emergência|ativos|negócio de revenda|\d+%.*renda|kwanza|saldo.*aoa/i.test(m.content);
          return temDados ? { ...m, content: '[dados financeiros anteriores]' } : m;
        });

      messages = [
        { role: 'system', content: promptBuilder.gerarPromptMinimal(perfil) },
        ...historicoMinimo,
        { role: 'user', content: msg }
      ];
    }

    // 10. CHAMAR API
    if (!groqClient.isConfigured()) {
      const resp = getRespostaOffline(msgLower);
      return kambaRes(res, resp, { offline: true });
    }

    let data;
    try {
      if (classificacao.precisaTools) {
        data = await groqClient.chamarGroqComTools(messages, toolRegistry.getToolDefinitions());
      } else {
        data = await groqClient.chamarGroq(messages, false);
      }
    } catch (err) {
      console.error('[KAMBA ERROR] API Error:', err.message);
      
      // Fallback offline para erros específicos
      if (err.message?.includes('401') || err.message?.includes('Invalid API Key')) {
        const resp = getRespostaOffline(msgLower);
        await conversationService.salvarMemoria(usuarioId, 'user', msg, 'conversa_ia');
        await conversationService.salvarMemoria(usuarioId, 'assistant', resp, 'conversa_ia');
        return kambaRes(res, resp, { offline: true, error: 'api_key_invalid' });
      }
      
      throw err;
    }

    // 11. PROCESSAR RESPOSTA
    let finalContent;
    const primeiraMsg = data.choices?.[0]?.message;

    // Processar tool calls
    if (primeiraMsg?.tool_calls?.length > 0) {
      const toolCalls = primeiraMsg.tool_calls.map(tc => ({
        name: tc.function.name,
        params: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
        id: tc.id
      }));

      // Executar ferramentas
      const resultados = await toolRegistry.executeMultiple(toolCalls, { usuarioId });

      // Adicionar resposta do assistente (sanitizada: content nunca null)
      messages.push({
        role: 'assistant',
        content: primeiraMsg.content || '',
        tool_calls: primeiraMsg.tool_calls
      });
      resultados.forEach((result, idx) => {
        messages.push({
          role: 'tool',
          tool_call_id: toolCalls[idx].id,
          content: JSON.stringify(result.data)
        });
      });

      // Segunda chamada para gerar resposta final
      const secondData = await groqClient.chamarGroq(messages, false);
      finalContent = secondData.choices?.[0]?.message?.content;
    } else {
      finalContent = primeiraMsg?.content;
    }

    if (!finalContent) {
      finalContent = getFallback('erro_generico');
    }

    // 12. ADICIONAR LEMBRETES PROATIVOS
    finalContent = await Proatividade.adicionarLembretesNaResposta(usuarioId, finalContent);

    // 13. SALVAR MEMÓRIA
    await conversationService.salvarMemoria(usuarioId, 'user', msg, 'conversa_ia', threadId);
    await conversationService.salvarMemoria(usuarioId, 'assistant', finalContent, 'conversa_ia', threadId);

    // 14. CACHE (apenas para respostas não financeiras)
    if (!NAO_CACHEAR.test(msgLower)) {
      cacheService.guardar(usuarioId, msgLower, finalContent);
    }

    // 15. LOG DE PERFORMANCE (fire-and-forget)
    const latencia = Date.now() - inicio;
    const tokensUsados = data.usage?.total_tokens || 0;
    const ferramentasUsadas = primeiraMsg?.tool_calls?.map(tc => ({
      nome: tc.function.name,
      sucesso: true
    })) || [];

    analytics.registarUso({
      usuarioId,
      tokens: tokensUsados,
      latencia,
      modelo: groqClient.GROQ_MODEL,
      sucesso: true,
      intencao: classificacao.intencao,
      sentimento,
      confianca: classificacao.confianca,
      ferramentas: ferramentasUsadas.length > 0 ? ferramentasUsadas : null
    });

    return kambaRes(res, finalContent, { 
      latencia: `${latencia}ms`,
      tokens: tokensUsados,
      intencao: classificacao.intencao,
      sentimento,
      confianca: classificacao.confianca,
      idioma
    });

  } catch (err) {
    console.error('[KAMBA ERROR]:', err.message);

    analytics.registarUso({
      usuarioId: req.user?.id,
      tokens: 0,
      latencia: Date.now() - inicio,
      modelo: groqClient.GROQ_MODEL,
      sucesso: false,
      erro: err.message,
      intencao: null
    });

    return kambaRes(res, getFallback('erro_generico'));
  }
};

// ==========================================
// ROTA DE FEEDBACK
// ==========================================

const enviarFeedback = async (req, res, next) => {
  try {
    const { mensagemId, avaliacao, comentario, promptVersao } = req.body;
    const usuarioId = req.user.id;

    const result = await analytics.registarFeedback(usuarioId, mensagemId, avaliacao, comentario);
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    // Registar no A/B testing se veio de um teste de prompt
    if (promptVersao) {
      analytics.registarRespostaTeste(promptVersao, parseInt(avaliacao));
    }

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
