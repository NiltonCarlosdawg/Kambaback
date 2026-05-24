const axios = require("axios");

const SEARCH_API_KEY = process.env.KAMBA_SEARCH_API_KEY;

const CACHE_TTL = 4 * 60 * 60;
const cacheMemoria = new Map();

const COTACOES_FIXAS = {
  USD: { oficial: 835.5, paralelo: 980.0, variacao: "estável" },
  EUR: { oficial: 905.2, paralelo: 1060.0, variacao: "estável" },
};

const buscarCotacaoOnline = async () => {
  if (!SEARCH_API_KEY) return null;

  const cacheKey = "cotacoes_online";
  const cacheado = cacheMemoria.get(cacheKey);
  if (cacheado && Date.now() - cacheado.timestamp < CACHE_TTL) {
    return cacheado.dados;
  }

  try {
    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: SEARCH_API_KEY,
        query: "cotação dólar euro kwanza Angola hoje",
        search_depth: "basic",
        max_results: 3,
        topic: "general",
      },
      { timeout: 8000 },
    );

    const results = response.data?.results || [];
    if (results.length > 0) {
      const dados = { data: new Date().toISOString(), fonte: "online" };

      const textoCompleto = results
        .map((r) => `${r.title} ${r.content}`)
        .join(" ")
        .toLowerCase();

      const usdMatch = textoCompleto.match(
        /(?:d[oó]lar|usd)[^0-9]*(\d{3,4}(?:[.,]\d{1,2})?)/,
      );
      const eurMatch = textoCompleto.match(
        /(?:euro|eur)[^0-9]*(\d{3,4}(?:[.,]\d{1,2})?)/,
      );

      if (usdMatch || eurMatch) {
        if (usdMatch) {
          dados.USD = {
            oficial: parseFloat(usdMatch[1].replace(",", ".")),
            paralelo: null,
            variacao: "consulte o banco",
          };
        }
        if (eurMatch) {
          dados.EUR = {
            oficial: parseFloat(eurMatch[1].replace(",", ".")),
            paralelo: null,
            variacao: "consulte o banco",
          };
        }

        cacheMemoria.set(cacheKey, { dados, timestamp: Date.now() });
        return dados;
      }
    }
  } catch (err) {
    console.warn("[COTACAO] Erro ao buscar online:", err.message);
  }

  return null;
};

const handler = async () => {
  const online = await buscarCotacaoOnline();

  if (online) {
    return {
      data: online.data,
      cotacoes: {
        USD: online.USD || COTACOES_FIXAS.USD,
        EUR: online.EUR || COTACOES_FIXAS.EUR,
      },
      nota: "Cotações aproximadas com base em pesquisa online. Consulte o banco para valores exactos.",
      fonte: "tavily",
    };
  }

  return {
    data: new Date().toISOString(),
    cotacoes: COTACOES_FIXAS,
    nota: "Cotações de referência (offline). Consulte o banco para valores exactos.",
    fonte: "fallback",
  };
};

module.exports = {
  name: "getCotacaoMoedas",
  description:
    "Busca cotação actual do dólar (USD) e euro (EUR) em kwanzas (AOA). Chamar APENAS quando o utilizador perguntar explicitamente sobre câmbio.",
  handler,
  parameters: { type: "object", properties: {} },
  category: "knowledge",
};
