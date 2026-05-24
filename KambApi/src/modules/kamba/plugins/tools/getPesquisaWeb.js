const axios = require("axios");

const SEARCH_API_KEY = process.env.KAMBA_SEARCH_API_KEY;
const SEARCH_API_URL =
  process.env.KAMBA_SEARCH_API_URL || "https://api.tavily.com";
const CACHE_TTL = {
  general: 24 * 60 * 60,
  news: 1 * 60 * 60,
};

const redisClient = require("../../services/core/redisClient");

const CACHE_PREFIX = "search:";

const formatarResultados = (resultados, tipo) => {
  if (!resultados || resultados.length === 0) {
    return {
      encontrado: false,
      mensagem: "Não encontrei resultados para essa pesquisa.",
    };
  }

  const resultadosFormatados = resultados.slice(0, 5).map((r) => ({
    titulo: r.title || r.titulo || "Sem título",
    conteudo: r.content || r.snippet || r.descricao || "",
    url: r.url || r.link || "",
    score: r.score || 0,
  }));

  return {
    encontrado: true,
    total: resultados.length,
    resultados: resultadosFormatados,
    tipo,
  };
};

const pesquisarTavily = async (query, tipo) => {
  if (!SEARCH_API_KEY) {
    return null;
  }

  try {
    const response = await axios.post(
      `${SEARCH_API_URL}/search`,
      {
        api_key: SEARCH_API_KEY,
        query,
        search_depth: tipo === "news" ? "basic" : "advanced",
        include_answer: true,
        max_results: 5,
        topic: tipo === "news" ? "news" : "general",
      },
      { timeout: 10000 },
    );

    const data = response.data;

    const resultados = (data.results || []).map((r) => ({
      title: r.title,
      content: r.content,
      url: r.url,
      score: r.score,
    }));

    return {
      answer: data.answer || null,
      resultados,
      urlConsulta: `https://tavily.com/search?q=${encodeURIComponent(query)}`,
    };
  } catch (err) {
    console.warn("[SEARCH] Tavily error:", err.message);
    return null;
  }
};

const handler = async (params, context) => {
  const query = params?.query?.trim();
  const tipo = params?.tipo || "general";

  if (!query || query.length < 3) {
    return {
      encontrado: false,
      mensagem:
        "Preciso de mais detalhes para pesquisar. Tenta com palavras-chave específicas.",
      ajuda:
        'Inclui termos como "cotação dólar Angola", "inflação 2025", "notícias economia Luanda"',
    };
  }

  const cacheKey = `${CACHE_PREFIX}${tipo}:${query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")}`;

  if (redisClient.isDisponivel()) {
    try {
      const cacheado = await redisClient.get(cacheKey);
      if (cacheado) {
        return { ...cacheado, cache: true };
      }
    } catch {
      /* fallback */
    }
  }

  const resultado = await pesquisarTavily(query, tipo);

  if (resultado && resultado.resultados.length > 0) {
    const formatted = formatarResultados(resultado.resultados, tipo);
    if (resultado.answer) {
      formatted.resumo = resultado.answer;
    }
    formatted.urlConsulta = resultado.urlConsulta;

    if (redisClient.isDisponivel()) {
      const ttl = CACHE_TTL[tipo] || CACHE_TTL.general;
      await redisClient.set(cacheKey, formatted, ttl).catch(() => {});
    }

    return formatted;
  }

  return {
    encontrado: false,
    mensagem: `Não encontrei resultados para "${query}". Tenta reformular a pesquisa.`,
    dica: "Tenta usar termos mais específicos ou diferentes.",
  };
};

module.exports = {
  name: "getPesquisaWeb",
  description:
    "Pesquisa na internet informações atualizadas sobre qualquer tema. Usa quando precisares de dados recentes: cotações, notícias, inflação, economia angolana, preços, etc. Retorna resultados resumidos e links.",
  handler,
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          'Termo de pesquisa (ex: "cotação dólar kwanza hoje", "inflação Angola 2025", "notícias economia Luanda")',
      },
      tipo: {
        type: "string",
        enum: ["general", "news", "finance"],
        description:
          'Tipo de pesquisa: "general" para informações gerais, "news" para notícias recentes, "finance" para dados financeiros',
      },
    },
    required: ["query"],
  },
  category: "knowledge",
  cacheable: true,
  cacheTTL: 60 * 60 * 1000,
};
