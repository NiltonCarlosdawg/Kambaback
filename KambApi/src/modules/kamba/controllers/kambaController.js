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

// Partilhados por todos os caminhos (F-024): antes havia 3 cópias de
// NAO_CACHEAR e 2 de WIZARD_PATTERN (uma por controller) que podiam divergir.
const NAO_CACHEAR =
  /saldo|gasto|metas?|objetivo|dinheiro|kumbú|tabua|fluxo|emergência|dolar|dólar/i;

const WIZARD_PATTERN = /\[WIZARD:([a-z_]+):(\{.*?\})\]/s;

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
  if (!NAO_CACHEAR.test(msgLower)) {
    const respostaCache = await cacheService.verificar(usuarioId, msgLower);
    if (respostaCache) {
      return responder(respostaCache, { fromCache: true });
    }
  }

  return { handled: false };
};

// ==========================================
// NÚCLEO PARTILHADO (F-024)
// `conversarComKamba` (JSON) e `conversarComKambaStream` (SSE) eram a mesma
// função duplicada (~326 + ~305 linhas) e já tinham divergido de forma
// prejudicial: A/B testing só no JSON, tokens sempre 0 no stream e moderação
// DEPOIS de o conteúdo já ter sido enviado ao cliente. Agora existe UM
// pipeline que NUNCA escreve em `res` — devolve um resultado que cada
// adapter renderiza (JSON vs eventos SSE).
// ==========================================

/**
 * Pipeline completo: contexto → LLM (bloqueante ou em modo stream) → tool
 * calls → pós-processamento (lembretes/empatia/wizard) → moderação ANTES de
 * transmitir → memória → cache → analytics.
 *
 * @param {object} p
 * @param {string} p.usuarioId
 * @param {string} p.msg       mensagem já validada e com trim
 * @param {string} p.msgLower
 * @param {string} p.threadId
 * @param {number} p.inicio    timestamp de início (cálculo de latência)
 * @param {Function|null} [p.onChunk]    presente = modo stream; coleta mas
 *                                       NUNCA escreve em `res` (buffer)
 * @param {Function|null} [p.onToolCalls] recebe os nomes das tools executadas
 * @returns {Promise<{tipo: "offline"|"erro_api_key"|"wizard"|"ok", ...}>}
 */
const processarRespostaLLM = async ({
  usuarioId,
  msg,
  msgLower,
  threadId,
  inicio,
  onChunk = null,
  onToolCalls = null,
}) => {
  // 1. CONTEXTO
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

  // 2. CONTEXTO PENDENTE (loop detector) para o prompt
  const contextoPendente = await detectarContextoPendente(
    usuarioId,
    msgLower,
    memoriaDB,
  );
  const opcoesSessao = { sentimento, sentimentoIntensidade, contextoPendente };

  // 3. MENSAGENS + A/B TESTING (antes só existia no JSON — F-024)
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

  // 4. SEM CHAVE DE API → RESPOSTA OFFLINE (memória guardada nos dois adapters)
  if (!groqClient.isConfigured()) {
    const resp = getRespostaOffline(msgLower);
    await conversationService.salvarMemoria(usuarioId, "user", msg, "conversa_ia", threadId);
    await conversationService.salvarMemoria(usuarioId, "assistant", resp, "conversa_ia", threadId);
    return { tipo: "offline", resposta: resp };
  }

  // 5. CHAMADA AO LLM — stream coleta em buffer; JSON espera a resposta inteira
  const tools = classificacao.precisaTools ? toolRegistry.getToolDefinitions() : null;
  let data;
  try {
    if (onChunk) {
      data = await groqClient.chamarStream(messages, { tools, onChunk });
    } else if (classificacao.precisaTools) {
      data = await groqClient.chamarGroqComTools(messages, tools);
    } else {
      data = await groqClient.chamarGroq(messages, false);
    }
  } catch (err) {
    console.error("[KAMBA ERROR] API Error:", err.message);

    if (err.message?.includes("401") || err.message?.includes("Invalid API Key")) {
      const resp = getRespostaOffline(msgLower);
      await conversationService.salvarMemoria(usuarioId, "user", msg, "conversa_ia", threadId);
      await conversationService.salvarMemoria(usuarioId, "assistant", resp, "conversa_ia", threadId);
      return { tipo: "erro_api_key", resposta: resp };
    }

    throw err;
  }

  // 6. TOOL CALLS (2.ª passagem — idêntica nos dois modos)
  const primeiraMsg = data.choices?.[0]?.message;
  let finalContent = primeiraMsg?.content || "";
  let ferramentasUsadas = [];
  let tokensUsados = data.usage?.total_tokens || 0;

  if (primeiraMsg?.tool_calls?.length > 0) {
    const toolCalls = primeiraMsg.tool_calls.map((tc) => ({
      name: tc.function.name,
      params: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
      id: tc.id,
    }));

    if (onToolCalls) {
      onToolCalls(toolCalls.map((tc) => tc.name));
    }

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

    const segunda = onChunk
      ? await groqClient.chamarStream(messages, { onChunk })
      : await groqClient.chamarGroq(messages, false);

    finalContent = segunda.choices?.[0]?.message?.content || finalContent;
    tokensUsados += segunda.usage?.total_tokens || 0;
    ferramentasUsadas = toolCalls.map((tc) => ({
      nome: tc.name,
      sucesso: true,
    }));
  }

  if (!finalContent) {
    finalContent = getFallback("erro_generico");
  }

  // 7. PÓS-PROCESSAMENTO: lembretes proativos → empatia → bridge do wizard
  finalContent = await Proatividade.adicionarLembretesNaResposta(
    usuarioId,
    finalContent,
  );

  const prefixoEmpatia = getPrefixoEmpatia(sentimento, sentimentoIntensidade);
  if (prefixoEmpatia && !finalContent.startsWith(prefixoEmpatia)) {
    finalContent = `${prefixoEmpatia}\n\n${finalContent}`;
  }

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

          return {
            tipo: "wizard",
            fluxoTipo: tipoFluxo,
            content: finalContent,
            meta: {
              latencia: Date.now() - inicio,
              intencao: classificacao.intencao,
            },
          };
        }
      }
    } catch (err) {
      console.warn("[BRIDGE] Erro ao parsear dados do wizard:", err.message);
    }
  }

  // 8. MODERAÇÃO DE OUTPUT — ANTES de qualquer transmissão (F-024: no stream
  // antigo os chunks já tinham sido enviados ao cliente e só depois se
  // moderava; agora o conteúdo fica em buffer até estar aprovado)
  let bloqueado = false;
  const moderacaoOutput = await contentModerator.moderarOutput(finalContent);
  if (moderacaoOutput.bloqueado) {
    console.warn(
      `[MODERACAO] Output bloqueado (user ${usuarioId}): ${moderacaoOutput.categoria}`,
    );
    finalContent = contentModerator.getRespostaBloqueio(
      moderacaoOutput.categoria,
    );
    bloqueado = true;
  }

  // 9. MEMÓRIA (guarda a resposta final — inclui a substituta de bloqueio)
  await conversationService.salvarMemoria(usuarioId, "user", msg, "conversa_ia", threadId);
  await conversationService.salvarMemoria(usuarioId, "assistant", finalContent, "conversa_ia", threadId);

  // 10. CACHE
  if (!NAO_CACHEAR.test(msgLower)) {
    await cacheService.guardar(usuarioId, msgLower, finalContent);
  }

  // 11. ANALYTICS (tokens reais também no stream — F-024)
  const latencia = Date.now() - inicio;

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

  return {
    tipo: "ok",
    content: finalContent,
    bloqueado,
    categoria: moderacaoOutput.categoria,
    meta: {
      latencia,
      tokens: tokensUsados,
      intencao: classificacao.intencao,
      sentimento,
      confianca: classificacao.confianca,
      idioma,
    },
  };
};

// ==========================================
// CONTROLLER PRINCIPAL (adapter JSON)
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

    // 3. PIPELINE PARTILHADO (F-024) — só falta renderizar em JSON
    const resultado = await processarRespostaLLM({
      usuarioId,
      msg,
      msgLower,
      threadId,
      inicio,
    });

    switch (resultado.tipo) {
      case "offline":
        return kambaRes(res, resultado.resposta, { offline: true });
      case "erro_api_key":
        return kambaRes(res, resultado.resposta, {
          offline: true,
          error: "api_key_invalid",
        });
      case "wizard":
        return kambaRes(res, resultado.content, {
          fluxoAtivo: true,
          fluxoTipo: resultado.fluxoTipo,
          fluxoIniciado: true,
          latencia: `${resultado.meta.latencia}ms`,
          intencao: resultado.meta.intencao,
        });
      default:
        return kambaRes(res, resultado.content, {
          latencia: `${resultado.meta.latencia}ms`,
          tokens: resultado.meta.tokens,
          intencao: resultado.meta.intencao,
          sentimento: resultado.meta.sentimento,
          confianca: resultado.meta.confianca,
          idioma: resultado.meta.idioma,
        });
    }
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
// CONTROLLER DE STREAMING (SSE) (adapter SSE)
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
      return;
    }

    const msg = mensagem.trim();
    if (msg.length > 500) {
      escreverEventoSSE(res, "error", {
        message: "Mensagem muito longa. Máx. 500 caracteres.",
      });
      return;
    }

    const msgLower = msg.toLowerCase();

    // Rotas rápidas (já com adapter de stream)
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

    escreverEventoSSE(res, "stream_start");

    // F-024: o pipeline coleta os chunks em BUFFER e NÃO escreve em `res` —
    // o conteúdo só é transmitido depois de passar a moderação, do wizard e
    // do pós-processamento (antes, os chunks iam ao cliente e a moderação
    // acontecia já tarde demais).
    const resultado = await processarRespostaLLM({
      usuarioId,
      msg,
      msgLower,
      threadId,
      inicio,
      onChunk: () => {}, // modo stream: coleta feita dentro do handleStream
      onToolCalls: (nomes) => {
        if (!clientDisconnected) {
          escreverEventoSSE(res, "tool_calls", { tools: nomes });
        }
      },
    });

    if (clientDisconnected) return;

    if (resultado.tipo === "offline" || resultado.tipo === "erro_api_key") {
      escreverEventoSSE(res, "chunk", { content: resultado.resposta });
      escreverEventoSSE(res, "done", {
        offline: true,
        ...(resultado.tipo === "erro_api_key"
          ? { error: "api_key_invalid" }
          : {}),
      });
      return;
    }

    if (resultado.tipo === "wizard") {
      escreverEventoSSE(res, "chunk", { content: resultado.content });
      escreverEventoSSE(res, "done", {
        fluxoAtivo: true,
        fluxoTipo: resultado.fluxoTipo,
        fluxoIniciado: true,
        latencia: `${resultado.meta.latencia}ms`,
        intencao: resultado.meta.intencao,
      });
      return;
    }

    // tipo "ok" — transmite APENAS aqui, já com o conteúdo aprovado
    if (resultado.bloqueado) {
      escreverEventoSSE(res, "moderated", { mensagem: resultado.content });
    } else {
      escreverEventoSSE(res, "chunk", { content: resultado.content });
    }

    escreverEventoSSE(res, "done", {
      latencia: `${resultado.meta.latencia}ms`,
      tokens: resultado.meta.tokens,
      intencao: resultado.meta.intencao,
      sentimento: resultado.meta.sentimento,
      confianca: resultado.meta.confianca,
      idioma: resultado.meta.idioma,
      ...(resultado.bloqueado ? { moderado: true } : {}),
    });
  } catch (err) {
    console.error("[KAMBA STREAM ERROR]:", err.message);
    if (!clientDisconnected && res.headersSent) {
      escreverEventoSSE(res, "error", { message: getFallback("erro_generico") });
    }
  } finally {
    if (!clientDisconnected && !res.writableEnded) {
      res.end();
    }
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
