// services/ai/summarizationService.js
// Serviço de sumarização de conversas usando LLM

const groqClient = require("./openaiClient");
const logger = require("../../../../utils/logger");

/**
 * Sumariza um conjunto de mensagens usando o LLM
 * @param {Array} mensagens - Array de mensagens {role, content}
 * @returns {Promise<string>} Sumário da conversa
 */
const summarizarConversa = async (mensagens) => {
  if (!mensagens || mensagens.length === 0) {
    return "";
  }

  // Filtrar apenas mensagens relevantes (ignorar system e sumários antigos)
  const mensagensRelevantes = mensagens.filter(
    (m) => m.role !== "system" && !m.content?.startsWith("[Sumário:"),
  );

  if (mensagensRelevantes.length === 0) {
    return "";
  }

  // Formatar mensagens para o prompt
  const textoConversa = mensagensRelevantes
    .map((m) => `${m.role === "user" ? "Utilizador" : "Kamba"}: ${m.content}`)
    .join("\n\n");

  const promptSumarizacao = `Sumarize a seguinte conversa entre um utilizador e o seu assistente financeiro (Kamba) em 2-3 frases curtas em português de Angola.

Mantém apenas:
- Tópicos financeiros discutidos
- Decisões ou planos mencionados
- Preferências do utilizador reveladas
- Dados importantes (valores, datas, metas)

NÃO incluas:
- Saudações ou despedidas
- Conversa casual irrelevante
- Repetições

Conversa:
${textoConversa}

Sumário (em português angolano, tom casual):`;

  try {
    const messages = [
      {
        role: "system",
        content:
          "És um assistente especializado em sumarizar conversas financeiras. Responde apenas com o sumário, sem introduções.",
      },
      { role: "user", content: promptSumarizacao },
    ];

    const response = await groqClient.chamarGroq(messages, false);
    const sumario = response.choices?.[0]?.message?.content?.trim();

    if (sumario) {
      logger.info(
        `[SUMARIZAÇÃO] Conversa sumarizada: ${sumario.substring(0, 100)}...`,
      );
      return sumario;
    }

    return "[Conversa sumarizada - tópicos financeiros discutidos]";
  } catch (err) {
    logger.error({ err }, "[SUMARIZAÇÃO] Erro ao sumarizar conversa");
    // Fallback: sumário manual baseado nos tópicos
    return gerarSumarioFallback(mensagensRelevantes);
  }
};

/**
 * Gera um sumário simples quando o LLM falha
 * @param {Array} mensagens - Mensagens
 * @returns {string} Sumário básico
 */
const gerarSumarioFallback = (mensagens) => {
  const temas = new Set();

  mensagens.forEach((m) => {
    const content = m.content?.toLowerCase() || "";
    if (content.includes("saldo")) temas.add("saldo consultado");
    if (content.includes("gasto") || content.includes("despesa"))
      temas.add("gastos discutidos");
    if (content.includes("objetivo") || content.includes("meta"))
      temas.add("metas financeiras");
    if (content.includes("poupar") || content.includes("economizar"))
      temas.add("poupança");
    if (content.includes("investir")) temas.add("investimentos");
    if (content.includes("dólar") || content.includes("dolar"))
      temas.add("câmbio");
    if (content.includes("negócio") || content.includes("negocio"))
      temas.add("negócios");
    if (content.includes("fundo") || content.includes("emergência"))
      temas.add("fundo de emergência");
  });

  if (temas.size === 0) {
    return "[Conversa sobre temas gerais]";
  }

  return `[Sumário: ${Array.from(temas).join(", ")}]`;
};

module.exports = {
  summarizarConversa,
  gerarSumarioFallback,
};
