const axios = require("axios");
const currencyService = require('../../services/core/currencyService');

const SEARCH_API_KEY = process.env.KAMBA_SEARCH_API_KEY;

const CACHE_TTL = 4 * 60 * 60;
const cacheMemoria = new Map();

const COTACOES_FIXAS = {
  USD: { oficial: 835.5, paralelo: 980.0, variacao: "estável" },
  EUR: { oficial: 905.2, paralelo: 1060.0, variacao: "estável" },
  _referenciaData: "2024-12",
};

const buscarCotacaoBNA = async () => {
  try {
    const response = await axios.get('https://www.bna.ao/Conteudos/Artigos/detalhe_artigo.aspx?idc=326&idsc=5710&idl=1', {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KambaBot/1.0)' }
    });

    const texto = response.data;
    const usdMatch = texto.match(/USD[^0-9]*([0-9]{3,4}[.,][0-9]{1,4})/i);
    const eurMatch = texto.match(/EUR[^0-9]*([0-9]{3,4}[.,][0-9]{1,4})/i);

    if (usdMatch || eurMatch) {
      return {
        USD: usdMatch ? { oficial: parseFloat(usdMatch[1].replace(',', '.')), fonte: 'BNA' } : null,
        EUR: eurMatch ? { oficial: parseFloat(eurMatch[1].replace(',', '.')), fonte: 'BNA' } : null,
        data: new Date().toISOString(),
        fonteNome: 'Banco Nacional de Angola (BNA)'
      };
    }
  } catch (err) {
    console.warn('[COTACAO] BNA scraping falhou:', err.message);
  }
  return null;
};

const buscarCotacaoTavily = async () => {
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
        query: "taxa câmbio dólar kwanza AOA hoje Angola BNA mercado paralelo",
        search_depth: "basic",
        max_results: 5,
        topic: "finance",
        include_domains: ['bna.ao', 'expansao.ao', 'novojornal.co.ao', 'angop.ao']
      },
      { timeout: 8000 },
    );

    const results = response.data?.results || [];
    if (results.length > 0) {
      const dados = { data: new Date().toISOString(), fonte: "tavily_angola" };

      const textoCompleto = results
        .map((r) => `${r.title} ${r.content}`)
        .join(" ")
        .toLowerCase();

      const usdOficialMatch = textoCompleto.match(/(?:oficial|bna)[^0-9]*([89]\d{2}(?:[.,]\d{1,2})?)/);
      const usdParaleloMatch = textoCompleto.match(/(?:paralelo|mercado negro|informal)[^0-9]*(\d{3,4}(?:[.,]\d{1,2})?)/);
      const eurMatch = textoCompleto.match(/(?:euro|eur)[^0-9]*(\d{3,4}(?:[.,]\d{1,2})?)/);

      if (usdOficialMatch || eurMatch) {
        if (usdOficialMatch) {
          dados.USD = {
            oficial: parseFloat(usdOficialMatch[1].replace(",", ".")),
            paralelo: usdParaleloMatch ? parseFloat(usdParaleloMatch[1].replace(",", ".")) : null,
            variacao: "ver mercado",
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
  // 1. Tentar BNA (fonte oficial angolana)
  const bna = await buscarCotacaoBNA();
  if (bna?.USD?.oficial) {
    await currencyService.actualizarTaxas(bna.USD.oficial, bna.EUR?.oficial).catch(() => {});
    return {
      data: bna.data,
      cotacoes: {
        USD: { ...bna.USD, paralelo: bna.USD.oficial * 1.15 },
        EUR: bna.EUR || { oficial: bna.USD.oficial * 1.08, fonte: 'estimativa' }
      },
      nota: 'Taxa oficial do BNA. Mercado paralelo pode variar 10-20% acima.',
      fonte: 'bna'
    };
  }

  // 2. Tentar Tavily com fontes angolanas
  const tavily = await buscarCotacaoTavily();
  if (tavily?.USD) {
    await currencyService.actualizarTaxas(tavily.USD.oficial, tavily.EUR?.oficial).catch(() => {});
    return {
      data: tavily.data,
      cotacoes: {
        USD: tavily.USD,
        EUR: tavily.EUR || COTACOES_FIXAS.EUR
      },
      nota: 'Cotações baseadas em fontes de imprensa angolana.',
      fonte: 'tavily_angola'
    };
  }

  // 3. Fallback com aviso
  const refDate = new Date("2024-12-01");
  const mesesPassados = Math.round(
    (Date.now() - refDate.getTime()) / (30 * 24 * 60 * 60 * 1000),
  );

  return {
    data: new Date().toISOString(),
    cotacoes: { USD: COTACOES_FIXAS.USD, EUR: COTACOES_FIXAS.EUR },
    nota: `⚠️ Valores de referência com ~${mesesPassados} meses. Consulte o BNA (bna.ao) para valores exactos.`,
    fonte: "fallback",
    desactualizado: true,
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
