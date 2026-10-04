const prisma = require("../../../lib/prisma");
const Wizard = require("./kambaWizardController");
const Proatividade = require("../services/kambaProatividadeService");

const groqClient = require("../services/ai/openaiClient");
const promptBuilder = require("../services/ai/promptBuilder");
const intentClassifier = require("../services/ai/intentClassifier");
const toolRegistry = require("../services/ai/toolRegistry");
const conversationService = require("../services/memory/conversationService");
const cacheService = require("../services/core/cacheService");
const {
  kambaRes,
  getFallback,
  getRespostaOffline,
  getPrefixoEmpatia,
} = require("../services/core/responseFormatter");
const analytics = require("../services/core/analyticsService");
const contentModerator = require("../services/ai/contentModerator");
const {
  agregarContexto,
  formatarContextoFinanceiro,
} = require("../services/ai/contextAggregator");
const toolsPlugin = require("../plugins/tools");

// ==========================================
// INIT: Carregar ferramentas dos plugins
// ==========================================
toolsPlugin.init();

// ==========================================
// HELPERS
// ==========================================

// F-011: threadId tem de ser o MESMO na leitura e na escrita da memória —
// sem ele na leitura, o histórico caía sempre no "default" e o thread do
// cliente parecia perder mensagens.
const prepararContexto = async (usuarioId, msg, msgLower, threadId = "default") => {
  const perfil = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: {
      nome: true,
      morada: true,
      dataNascimento: true,
      rendaMensalMedia: true,
      perfilDeRisco: true,
    },
  });

  const idade = perfil?.dataNascimento
    ? new Date().getFullYear() - new Date(perfil.dataNascimento).getFullYear()
    : "não informada";

  const contextoFinanceiro = await agregarContexto(usuarioId);
  const contextoFormatado = formatarContextoFinanceiro(contextoFinanceiro);

  const memoriaDB = await conversationService.carregarMemoriaComContexto(
    usuarioId,
    msg,
    threadId,
  );
  const classificacao = intentClassifier.classificarIntencao(
    msgLower,
    memoriaDB,
  );
  const { sentimento, intensidade: sentimentoIntensidade } =
    intentClassifier.detectarSentimento(msgLower);
  const idioma = intentClassifier.detectarIdioma(msgLower);

  return {
    perfil,
    idade,
    contextoFormatado,
    memoriaDB,
    classificacao,
    sentimento,
    sentimentoIntensidade,
    idioma,
    contextoFinanceiro,
  };
};

const sanitizarMsg = (m) => {
  const content =
    m.content && typeof m.content === "string" ? m.content.trim() : "";
  return {
    role:
      m.role === "system" || m.role === "user" || m.role === "assistant"
        ? m.role
        : "user",
    content:
      content.length > 0
        ? content
        : m.role === "assistant"
          ? "[...]"
          : m.role === "system"
            ? "(sem contexto)"
            : "",
  };
};

const prepararMensagens = (
  classificacao,
  perfil,
  idade,
  contextoFormatado,
  memoriaDB,
  msg,
  contextoFinanceiro = null,
  opcoesSessao = {},
) => {
  const memoriaLimpa = memoriaDB.map(sanitizarMsg);
  const primeiroNaoSystem = memoriaLimpa.find((m) => m.role !== "system");
  if (primeiroNaoSystem && primeiroNaoSystem.role === "assistant") {
    memoriaLimpa.unshift({
      role: "user",
      content: "[continuação da conversa]",
    });
  }

  if (classificacao.precisaTools) {
    return [
      {
        role: "system",
        content: promptBuilder.gerarSystemPrompt(
          perfil,
          idade,
          contextoFormatado,
          contextoFinanceiro,
          opcoesSessao,
        ),
      },
      ...memoriaLimpa.slice(-10),
      { role: "user", content: msg },
    ];
  }

  const historicoMinimo = memoriaLimpa.slice(-4).map((m) => {
    if (m.role !== "assistant") return m;
    const temDados =
      /\d{3,}[\s.]?\d{3}.*aoa|multicaixa|conta bai|bfa|bic|fundo de emergência|ativos|negócio de revenda|\d+%.*renda|kwanza|saldo.*aoa/i.test(
        m.content,
      );
    return temDados ? { ...m, content: "[dados financeiros anteriores]" } : m;
  });

  return [
    { role: "system", content: promptBuilder.gerarPromptMinimal(perfil) },
    ...historicoMinimo,
    { role: "user", content: msg },
  ];
};

const escreverEventoSSE = (res, tipo, dados = {}) => {
  res.write(`data: ${JSON.stringify({ type: tipo, ...dados })}\n\n`);
};

/**
 * Detecta se a pergunta actual já foi respondida antes (loop detector)
 * Retorna string descritiva para o prompt ou 'nenhum'
 */
const detectarContextoPendente = async (usuarioId, msgLower, memoriaDB) => {
  try {
    const repetida = intentClassifier.detectarPerguntaRepetida(
      msgLower,
      memoriaDB,
    );

    if (repetida) {
      const ultimaResposta = [...memoriaDB]
        .reverse()
        .find((m) => m.role === "assistant" && m.content?.length > 20);

      if (ultimaResposta) {
        const preview = ultimaResposta.content
          .substring(0, 80)
          .replace(/\n/g, " ");
        return `pergunta_repetida — última resposta: "${preview}..."`;
      }
      return "pergunta_repetida";
    }
    return "nenhum";
  } catch {
    return "nenhum";
  }
};

/**
 * Verifica se é a primeira mensagem desta sessão (últimos 30 min sem actividade)
 * e retorna contexto relevante da sessão anterior se existir
 */
const getContextoSessaoAnterior = async (usuarioId, memoriaDB, threadId = "default") => {
  if (memoriaDB.length === 0) return null;

  const ultimaMensagem = memoriaDB[memoriaDB.length - 1];
  const tempoDecorrido =
    Date.now() - new Date(ultimaMensagem.criadoEm || 0).getTime();
  const SESSAO_TIMEOUT = 30 * 60 * 1000; // 30 minutos

  if (tempoDecorrido > SESSAO_TIMEOUT) {
    const {
      buscarContextoRelevante,
    } = require("../services/memory/semanticMemory");
    const contextosRelevantes = await buscarContextoRelevante(
      usuarioId,
      "resumo financeiro objectivos gastos",
      2,
      threadId, // F-011: a sessão anterior também é do MESMO thread
    );

    if (contextosRelevantes.length > 0) {
      return contextosRelevantes
        .map((c) => c.content?.substring(0, 100))
        .filter(Boolean)
        .join(" | ");
    }
  }
  return null;
};

// ==========================================
// ROTAS RÁPIDAS (partilhadas entre normal e stream)
// ==========================================

const processarRotasRapidas = async (
  usuarioId,
  msg,
  msgLower,
  mensagem,
  res,
  isStream,
  threadId = "default",
) => {
  const responder = (texto, extra = {}) => {
    if (isStream) {
      if (!res.writableEnded) {
        escreverEventoSSE(res, "chunk", { content: texto });
        escreverEventoSSE(res, "done", extra);
        res.end();
      }
    } else {
      kambaRes(res, texto, extra);
    }
    return { handled: true };
  };

  // 1. MODERAÇÃO DE INPUT
  const moderacao = await contentModerator.moderarInput(msg);
  if (moderacao.bloqueado) {
    const resp = contentModerator.getRespostaBloqueio(moderacao.categoria);
    await conversationService.salvarMemoria(
      usuarioId,
      "user",
      msg,
      "bloqueado",
      threadId,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "assistant",
      resp,
      "bloqueado",
      threadId,
    );
    return responder(resp, { moderado: true });
  }

  // 2. VERIFICAR FLUXO GUIADO ATIVO
  if (await Wizard.temFluxoAtivo(usuarioId)) {
    if (msgLower === "cancelar" || msgLower === "sair") {
      const resp = await Wizard.cancelarFluxo(usuarioId);
      await conversationService.salvarMemoria(
        usuarioId,
        "user",
        mensagem,
        "fluxo_cancelado",
        threadId,
      );
      await conversationService.salvarMemoria(
        usuarioId,
        "assistant",
        resp,
        "fluxo_cancelado",
        threadId,
      );
      return responder(resp, { fluxoCancelado: true });
    }
    const resultado = await Wizard.processarRespostaFluxo(usuarioId, msg);
    await conversationService.salvarMemoria(
      usuarioId,
      "user",
      mensagem,
      `fluxo_${resultado.fluxoTipo || "ativo"}`,
      threadId,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "assistant",
      resultado.mensagem,
      `fluxo_${resultado.fluxoTipo || "ativo"}`,
      threadId,
    );
    return responder(resultado.mensagem, {
      fluxoAtivo: resultado.continuar,
      fluxoConcluido: resultado.concluido,
    });
  }

  // 3. DETECTAR INTENÇÃO DE FLUXO GUIADO
  const intencaoFluxo = Wizard.detectarIntencaoFluxo(msgLower);
  if (intencaoFluxo) {
    const resultadoInicio = await Wizard.iniciarFluxo(
      usuarioId,
      intencaoFluxo.tipo,
      intencaoFluxo.dadosIniciais,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "user",
      mensagem,
      "inicio_fluxo",
      threadId,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "assistant",
      resultadoInicio.mensagem,
      "inicio_fluxo",
      threadId,
    );
    return responder(resultadoInicio.mensagem, {
      fluxoAtivo: !resultadoInicio.concluido,
      fluxoConcluido: resultadoInicio.concluido,
      fluxoTipo: intencaoFluxo.tipo,
    });
  }

  // 4. RECUPERAÇÃO PROATIVA DE FLUXO ABANDONADO
  const recuperacao = await Wizard.verificarRecuperacao(usuarioId);
  if (recuperacao) {
    if (/^(sim|bora|quero|pode ser|yha|ok|vambora)$/.test(msgLower)) {
      const estado = await Wizard.getEstado(usuarioId);
      const fluxo = Wizard.FLUXOS[estado.fluxo];
      const pergunta = fluxo.passos[estado.passoAtual].pergunta;
      await Wizard.setEstado(usuarioId, estado);
      const resp = `Boa, kamba! Vamos continuar com o registo de *${recuperacao.fluxoNome}*.\n\n${pergunta}`;
      return responder(resp, { fluxoAtivo: true });
    }
    if (/^(não|nao|nops|cancelar|esquece)$/.test(msgLower)) {
      await Wizard.cancelarFluxo(usuarioId);
    }
    // F-012: qualquer OUTRA mensagem não é interceptada — antes descartava-se
    // a pergunta do utilizador ("oi", "qual o meu saldo?") e ficava preso até
    // responder sim/não. Agora segue o fluxo normal; o fluxo antigo continua
    // pendente e pode ser retomado com "sim" ou descartado com "não".
  }

  // 5. SAUDAÇÕES
  const isSaudacao =
    /^(oi|ol[aá]|hey|hi|hello|bom dia|boa tarde|boa noite|kom[eé]|salve|maka|e a[ií]|eai|tudo (bem|bom|fixe|certo|ok)|como (vais|vai|est[aá]s)|boas|que tal|massa|fixe|top|legal)\??[!.]*$/.test(
      msgLower,
    );
  if (isSaudacao) {
    const nomeUser = await prisma.user
      .findUnique({ where: { id: usuarioId }, select: { nome: true } })
      .then((u) => u?.nome || "kamba")
      .catch(() => "kamba");
    const variantes = [
      `Komé, ${nomeUser}! 🙌 Em que posso ajudar hoje?`,
      `Boas, ${nomeUser}! Tudo bem por aí? O que precisas?`,
      `Boa, ${nomeUser}! Tô aqui. O que precisas?`,
    ];
    const resp = variantes[Math.floor(Math.random() * variantes.length)];
    await conversationService.salvarMemoria(
      usuarioId,
      "user",
      mensagem,
      "saudacao",
      threadId,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "assistant",
      resp,
      "saudacao",
      threadId,
    );
    return responder(resp, { intencao: "saudacao" });
  }

  // 6. REACÇÕES CASUAIS
  const isReacaoCasual =
    /^(ok(ay)?|sim|n[aã]o|certo|entendi|claro|show|valeu|obrigad[ao]|exato|exacto|correto|tudo (fixe|bem|bom|certo|top|ok)|massa|top|incrível|perfeito)\s*[!.?]*$/.test(
      msgLower,
    );
  if (isReacaoCasual) {
    const respostas = [
      "Boa! Se precisares de alguma coisa, é só dizer. 👍",
      "Fixe! Qualquer coisa estou aqui.",
      "Ok, kamba! Precisas de mais alguma coisa?",
    ];
    const resp = respostas[Math.floor(Math.random() * respostas.length)];
    await conversationService.salvarMemoria(
      usuarioId,
      "user",
      mensagem,
      "reacao_casual",
      threadId,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "assistant",
      resp,
      "reacao_casual",
      threadId,
    );
    return responder(resp, { intencao: "reacao_casual" });
  }

  // 7. AJUDA
  if (msgLower === "ajuda" || msgLower === "help") {
    const ajuda = `🤖 *Comandos do Kamba:*\n\n📊 *Consultas Rápidas:*\n• "Qual o meu saldo?"\n• "Quanto gastei este mês?"\n• "Como vão meus objetivos?"\n• "Preço do dólar?"\n\n🎯 *Fluxos Guiados:*\n• "Criar meta"\n• "Registar gasto"\n• "Registar cartão"\n\n💬 *Conversa livre:*\n• "Como poupar mais?"\n• "Tenho 100 mil, quero começar um negócio"\n• "Devo comprar dólar?"\n\nDigita *"cancelar"* para sair de qualquer fluxo`;
    await conversationService.salvarMemoria(
      usuarioId,
      "user",
      mensagem,
      "ajuda",
      threadId,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "assistant",
      ajuda,
      "ajuda",
      threadId,
    );
    return responder(ajuda, { intencao: "ajuda" });
  }

  // 8. VERIFICAR CACHE
  const NAO_CACHEAR =
    /saldo|gasto|metas?|objetivo|dinheiro|kumbú|tabua|fluxo|emergência|dolar|dólar/i;
  if (!NAO_CACHEAR.test(msgLower)) {
    const respostaCache = await cacheService.verificar(usuarioId, msgLower);
    if (respostaCache) {
      return responder(respostaCache, { fromCache: true });
    }
  }

  return { handled: false };
};

// ==========================================
// CONTROLLER PRINCIPAL
// ==========================================

const conversarComKamba = async (req, res, next) => {
  const inicio = Date.now();
  const { mensagem, threadId: threadIdReq } = req.body;
  const usuarioId = req.user.id;
  const threadId = threadIdReq || "default";

  try {
    // 1. VALIDAÇÃO
    if (
      !mensagem ||
      typeof mensagem !== "string" ||
      mensagem.trim().length === 0
    ) {
      return kambaRes(res, getFallback("nao_entendido"));
    }

    const msg = mensagem.trim();
    if (msg.length > 500) {
      return kambaRes(
        res,
        "Mensagem muito longa, kamba! Resume (máx. 500 caracteres). ✂️",
      );
    }

    const msgLower = msg.toLowerCase();

    // 2. ROTAS RÁPIDAS (moderação, wizard, saudações, cache, etc.)
    const resultadoRapido = await processarRotasRapidas(
      usuarioId,
      msg,
      msgLower,
      mensagem,
      res,
      false,
      threadId,
    );
    if (resultadoRapido.handled) return;

    // 3. PREPARAR CONTEXTO (única chamada — elimina duplicação)
    const {
      perfil,
      idade,
      contextoFormatado,
      memoriaDB,
      classificacao,
      sentimento,
      sentimentoIntensidade,
      idioma,
      contextoFinanceiro,
    } = await prepararContexto(usuarioId, msg, msgLower, threadId);

    console.log(
      `[KAMBA] Intenção: ${classificacao.intencao} | Tools: ${classificacao.precisaTools} | Confiança: ${classificacao.confianca} | Sentimento: ${sentimento} (${sentimentoIntensidade}) | Idioma: ${idioma}`,
    );

    // 3.1 DETECTAR CONTEXTO PENDENTE E SESSÃO
    const contextoPendente = await detectarContextoPendente(
      usuarioId,
      msgLower,
      memoriaDB,
    );
    const contextoSessao = await getContextoSessaoAnterior(
      usuarioId,
      memoriaDB,
      threadId,
    );

    const opcoesSessao = {
      sentimento,
      sentimentoIntensidade,
      contextoPendente,
    };

    // 4. PREPARAR MENSAGENS PARA O LLM
    const messages = prepararMensagens(
      classificacao,
      perfil,
      idade,
      contextoFormatado,
      memoriaDB,
      msg,
      contextoFinanceiro,
      opcoesSessao,
    );

    // 5. VERIFICAR A/B TESTING
    let promptVersaoActiva = null;
    try {
      const testeActivo = await analytics.getPromptVersao(usuarioId);
      if (testeActivo && classificacao.precisaTools) {
        const idxSystem = messages.findIndex((m) => m.role === "system");
        if (idxSystem !== -1 && testeActivo.promptContent) {
          messages[idxSystem] = {
            role: "system",
            content: testeActivo.promptContent,
          };
          promptVersaoActiva = testeActivo.versao;
        }
      }
    } catch (err) {
      console.warn("[AB_TEST] Erro ao obter versão de prompt:", err.message);
    }

    // 6. CHAMAR API
    if (!groqClient.isConfigured()) {
      const resp = getRespostaOffline(msgLower);
      return kambaRes(res, resp, { offline: true });
    }

    let data;
    try {
      if (classificacao.precisaTools) {
        data = await groqClient.chamarGroqComTools(
          messages,
          toolRegistry.getToolDefinitions(),
        );
      } else {
        data = await groqClient.chamarGroq(messages, false);
      }
    } catch (err) {
      console.error("[KAMBA ERROR] API Error:", err.message);

      if (
        err.message?.includes("401") ||
        err.message?.includes("Invalid API Key")
      ) {
        const resp = getRespostaOffline(msgLower);
        await conversationService.salvarMemoria(
          usuarioId,
          "user",
          msg,
          "conversa_ia",
          threadId,
        );
        await conversationService.salvarMemoria(
          usuarioId,
          "assistant",
          resp,
          "conversa_ia",
          threadId,
        );
        return kambaRes(res, resp, { offline: true, error: "api_key_invalid" });
      }

      throw err;
    }

    // 7. PROCESSAR RESPOSTA
    let finalContent;
    const primeiraMsg = data.choices?.[0]?.message;

    if (primeiraMsg?.tool_calls?.length > 0) {
      const toolCalls = primeiraMsg.tool_calls.map((tc) => ({
        name: tc.function.name,
        params: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
        id: tc.id,
      }));

      const resultados = await toolRegistry.executeMultiple(toolCalls, {
        usuarioId,
      });

      messages.push({
        role: "assistant",
        content: primeiraMsg.content || "",
        tool_calls: primeiraMsg.tool_calls,
      });
      resultados.forEach((result, idx) => {
        messages.push({
          role: "tool",
          tool_call_id: toolCalls[idx].id,
          content: JSON.stringify(result.data),
        });
      });

      const secondData = await groqClient.chamarGroq(messages, false);
      finalContent = secondData.choices?.[0]?.message?.content;
    } else {
      finalContent = primeiraMsg?.content;
    }

    if (!finalContent) {
      finalContent = getFallback("erro_generico");
    }

    // 8. ADICIONAR LEMBRETES PROATIVOS
    finalContent = await Proatividade.adicionarLembretesNaResposta(
      usuarioId,
      finalContent,
    );

    // 8.1 PREFIXO DE EMPATIA (se sentimento negativo/intenso)
    const prefixoEmpatia = getPrefixoEmpatia(sentimento, sentimentoIntensidade);
    if (prefixoEmpatia && !finalContent.startsWith(prefixoEmpatia)) {
      finalContent = `${prefixoEmpatia}\n\n${finalContent}`;
    }

    // 8.2 BRIDGE LLM → WIZARD
    const WIZARD_PATTERN = /\[WIZARD:([a-z_]+):(\{.*?\})\]/s;
    const wizardMatch = finalContent.match(WIZARD_PATTERN);

    if (wizardMatch) {
      const [fullMatch, tipoFluxo, dadosJson] = wizardMatch;
      finalContent = finalContent
        .replace(fullMatch, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      try {
        const dadosIniciais = JSON.parse(dadosJson);
        const fluxoExiste = Wizard.FLUXOS[tipoFluxo];

        if (fluxoExiste && !(await Wizard.temFluxoAtivo(usuarioId))) {
          const resultadoInicio = await Wizard.iniciarFluxo(
            usuarioId,
            tipoFluxo,
            dadosIniciais,
          );

          if (resultadoInicio && !resultadoInicio.concluido) {
            finalContent = `${finalContent}\n\n${resultadoInicio.mensagem}`;

            await conversationService.salvarMemoria(
              usuarioId,
              "user",
              msg,
              "conversa_ia",
              threadId,
            );
            await conversationService.salvarMemoria(
              usuarioId,
              "assistant",
              finalContent,
              `inicio_fluxo_${tipoFluxo}`,
              threadId,
            );

            return kambaRes(res, finalContent, {
              fluxoAtivo: true,
              fluxoTipo: tipoFluxo,
              fluxoIniciado: true,
              latencia: `${Date.now() - inicio}ms`,
              intencao: classificacao.intencao,
            });
          }
        }
      } catch (err) {
        console.warn("[BRIDGE] Erro ao parsear dados do wizard:", err.message);
      }
    }

    // 9. MODERAÇÃO DE OUTPUT
    const moderacaoOutput = await contentModerator.moderarOutput(finalContent);
    if (moderacaoOutput.bloqueado) {
      finalContent = contentModerator.getRespostaBloqueio(
        moderacaoOutput.categoria,
      );
    }

    // 10. SALVAR MEMÓRIA
    await conversationService.salvarMemoria(
      usuarioId,
      "user",
      msg,
      "conversa_ia",
      threadId,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "assistant",
      finalContent,
      "conversa_ia",
      threadId,
    );

    // 11. CACHE
    const NAO_CACHEAR =
      /saldo|gasto|metas?|objetivo|dinheiro|kumbú|tabua|fluxo|emergência|dolar|dólar/i;
    if (!NAO_CACHEAR.test(msgLower)) {
      await cacheService.guardar(usuarioId, msgLower, finalContent);
    }

    // 12. LOG DE PERFORMANCE
    const latencia = Date.now() - inicio;
    const tokensUsados = data.usage?.total_tokens || 0;
    const ferramentasUsadas =
      primeiraMsg?.tool_calls?.map((tc) => ({
        nome: tc.function.name,
        sucesso: true,
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
      ferramentas: ferramentasUsadas.length > 0 ? ferramentasUsadas : null,
      promptVersao: promptVersaoActiva,
    });

    return kambaRes(res, finalContent, {
      latencia: `${latencia}ms`,
      tokens: tokensUsados,
      intencao: classificacao.intencao,
      sentimento,
      confianca: classificacao.confianca,
      idioma,
    });
  } catch (err) {
    console.error("[KAMBA ERROR]:", err.message);

    analytics.registarUso({
      usuarioId: req.user?.id,
      tokens: 0,
      latencia: Date.now() - inicio,
      modelo: groqClient.GROQ_MODEL,
      sucesso: false,
      erro: err.message,
      intencao: null,
    });

    return kambaRes(res, getFallback("erro_generico"));
  }
};

// ==========================================
// ROTA DE FEEDBACK
// ==========================================

const enviarFeedback = async (req, res, next) => {
  try {
    const { mensagemId, avaliacao, comentario, promptVersao } = req.body;
    const usuarioId = req.user.id;

    const result = await analytics.registarFeedback(
      usuarioId,
      mensagemId,
      avaliacao,
      comentario,
    );
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    if (promptVersao) {
      analytics.registarRespostaTeste(promptVersao, parseInt(avaliacao));
    }

    return res.json({
      success: true,
      message: "Obrigado pelo feedback, kamba! 🙏",
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// CONTROLLER DE STREAMING (SSE)
// ==========================================

const conversarComKambaStream = async (req, res, next) => {
  const inicio = Date.now();
  const { mensagem, threadId: threadIdReq } = req.body;
  const usuarioId = req.user.id;
  const threadId = threadIdReq || "default";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let clientDisconnected = false;
  req.on("close", () => {
    clientDisconnected = true;
  });

  try {
    if (
      !mensagem ||
      typeof mensagem !== "string" ||
      mensagem.trim().length === 0
    ) {
      escreverEventoSSE(res, "error", { message: "Mensagem vazia" });
      return res.end();
    }

    const msg = mensagem.trim();
    if (msg.length > 500) {
      escreverEventoSSE(res, "error", {
        message: "Mensagem muito longa. Máx. 500 caracteres.",
      });
      return res.end();
    }

    const msgLower = msg.toLowerCase();

    // Rotas rápidas
    const resultadoRapido = await processarRotasRapidas(
      usuarioId,
      msg,
      msgLower,
      mensagem,
      res,
      true,
      threadId,
    );
    if (resultadoRapido.handled) return;

    // Preparar contexto
    const {
      perfil,
      idade,
      contextoFormatado,
      memoriaDB,
      classificacao,
      sentimento,
      sentimentoIntensidade,
      contextoFinanceiro,
    } = await prepararContexto(usuarioId, msg, msgLower, threadId);

    // Detectar contexto pendente e sessão
    const contextoPendenteStream = await detectarContextoPendente(
      usuarioId,
      msgLower,
      memoriaDB,
    );
    const opcoesSessaoStream = {
      sentimento,
      sentimentoIntensidade,
      contextoPendente: contextoPendenteStream,
    };

    if (!groqClient.isConfigured()) {
      const resp = getRespostaOffline(msgLower);
      await conversationService.salvarMemoria(
        usuarioId,
        "user",
        msg,
        "conversa_ia",
        threadId,
      );
      await conversationService.salvarMemoria(
        usuarioId,
        "assistant",
        resp,
        "conversa_ia",
        threadId,
      );
      escreverEventoSSE(res, "chunk", { content: resp });
      escreverEventoSSE(res, "done", { offline: true });
      return res.end();
    }

    const tools = classificacao.precisaTools
      ? toolRegistry.getToolDefinitions()
      : null;
    const messages = prepararMensagens(
      classificacao,
      perfil,
      idade,
      contextoFormatado,
      memoriaDB,
      msg,
      contextoFinanceiro,
      opcoesSessaoStream,
    );

    let finalContent = "";

    escreverEventoSSE(res, "stream_start");

    const streamData = await groqClient.chamarStream(messages, {
      tools,
      onChunk: (event) => {
        if (clientDisconnected) return;
        if (event.type === "chunk") {
          finalContent += event.content;
          escreverEventoSSE(res, "chunk", { content: event.content });
        } else if (event.type === "error") {
          escreverEventoSSE(res, "error", { message: event.error });
        }
      },
    });

    if (clientDisconnected) return res.end();

    let primeiraMsg = streamData.choices?.[0]?.message;

    if (primeiraMsg?.tool_calls?.length > 0) {
      escreverEventoSSE(res, "tool_calls", {
        tools: primeiraMsg.tool_calls.map((tc) => tc.function.name),
      });

      const toolCalls = primeiraMsg.tool_calls.map((tc) => ({
        name: tc.function.name,
        params: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
        id: tc.id,
      }));

      const resultados = await toolRegistry.executeMultiple(toolCalls, {
        usuarioId,
      });

      messages.push({
        role: "assistant",
        content: primeiraMsg.content || "",
        tool_calls: primeiraMsg.tool_calls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });

      resultados.forEach((result, idx) => {
        messages.push({
          role: "tool",
          tool_call_id: toolCalls[idx].id,
          content: JSON.stringify(result.data),
        });
      });

      const secondStream = await groqClient.chamarStream(messages, {
        onChunk: (event) => {
          if (clientDisconnected) return;
          if (event.type === "chunk") {
            finalContent += event.content;
            escreverEventoSSE(res, "chunk", { content: event.content });
          }
        },
      });

      finalContent =
        secondStream.choices?.[0]?.message?.content || finalContent;
    }

    if (!finalContent) finalContent = getFallback("erro_generico");

    finalContent = await Proatividade.adicionarLembretesNaResposta(
      usuarioId,
      finalContent,
    );

    // Prefixo de empatia no stream
    const prefixoEmpatiaStream = getPrefixoEmpatia(
      sentimento,
      sentimentoIntensidade,
    );
    if (
      prefixoEmpatiaStream &&
      !finalContent.startsWith(prefixoEmpatiaStream)
    ) {
      finalContent = `${prefixoEmpatiaStream}\n\n${finalContent}`;
    }

    // BRIDGE LLM → WIZARD no stream
    const WIZARD_PATTERN_STREAM = /\[WIZARD:([a-z_]+):(\{.*?\})\]/s;
    const wizardMatchStream = finalContent.match(WIZARD_PATTERN_STREAM);

    if (wizardMatchStream && !clientDisconnected) {
      const [fullMatch, tipoFluxo, dadosJson] = wizardMatchStream;
      finalContent = finalContent
        .replace(fullMatch, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      try {
        const dadosIniciais = JSON.parse(dadosJson);
        const fluxoExiste = Wizard.FLUXOS[tipoFluxo];

        if (fluxoExiste && !(await Wizard.temFluxoAtivo(usuarioId))) {
          const resultadoInicio = await Wizard.iniciarFluxo(
            usuarioId,
            tipoFluxo,
            dadosIniciais,
          );

          if (resultadoInicio && !resultadoInicio.concluido) {
            if (!clientDisconnected) {
              escreverEventoSSE(res, "chunk", {
                content: `\n\n${resultadoInicio.mensagem}`,
              });
              escreverEventoSSE(res, "done", {
                fluxoAtivo: true,
                fluxoTipo: tipoFluxo,
                fluxoIniciado: true,
              });
            }
            return res.end();
          }
        }
      } catch (err) {
        console.warn(
          "[BRIDGE] Erro ao parsear dados do wizard no stream:",
          err.message,
        );
      }
    }

    // MODERAÇÃO DE OUTPUT NO STREAM
    const moderacaoOutput = await contentModerator.moderarOutput(finalContent);
    if (moderacaoOutput.bloqueado) {
      console.warn(
        `[MODERACAO] Output bloqueado no streaming (user ${usuarioId}): ${moderacaoOutput.categoria}`,
      );
      if (!clientDisconnected) {
        escreverEventoSSE(res, "moderated", {
          mensagem: contentModerator.getRespostaBloqueio(
            moderacaoOutput.categoria,
          ),
        });
      }
      return res.end();
    }

    await conversationService.salvarMemoria(
      usuarioId,
      "user",
      msg,
      "conversa_ia",
      threadId,
    );
    await conversationService.salvarMemoria(
      usuarioId,
      "assistant",
      finalContent,
      "conversa_ia",
      threadId,
    );

    const NAO_CACHEAR =
      /saldo|gasto|metas?|objetivo|dinheiro|kumbú|tabua|fluxo|emergência|dolar|dólar/i;
    if (!NAO_CACHEAR.test(msgLower)) {
      await cacheService.guardar(usuarioId, msgLower, finalContent);
    }

    const latencia = Date.now() - inicio;
    analytics.registarUso({
      usuarioId,
      tokens: 0,
      latencia,
      modelo: groqClient.GROQ_MODEL,
      sucesso: true,
      intencao: classificacao.intencao,
      sentimento,
      confianca: classificacao.confianca,
    });

    escreverEventoSSE(res, "done", {
      latencia: `${latencia}ms`,
      intencao: classificacao.intencao,
    });
  } catch (err) {
    console.error("[KAMBA STREAM ERROR]:", err.message);
    if (!clientDisconnected && res.headersSent) {
      escreverEventoSSE(res, "error", {
        message: getFallback("erro_generico"),
      });
    }
  } finally {
    if (!clientDisconnected) res.end();
  }
};

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  conversarComKamba,
  conversarComKambaStream,
  enviarFeedback,
};
