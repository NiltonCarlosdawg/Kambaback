const axios = require('axios');
const redisClient = require('../../kamba/services/core/redisClient');
const aiClient = require('../../kamba/services/ai/openaiClient');
const prisma = require('../../../lib/prisma');

const CACHE_TTL = 3600; // 1 hora
const RESUMO_CACHE_TTL = 7200; // 2 horas para o resumo
const REDIS_KEY_PREFIX = 'noticias:v2:economia:';

const memoryCache = new Map();

const getFromCache = async (key) => {
  if (redisClient.isDisponivel()) {
    const cached = await redisClient.get(key);
    if (cached) return cached;
  }
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key);
    if (Date.now() < entry.expiresAt) return entry.data;
    memoryCache.delete(key);
  }
  return null;
};

const setCache = async (key, data, ttl) => {
  memoryCache.set(key, { data, expiresAt: Date.now() + ttl * 1000 });
  if (redisClient.isDisponivel()) {
    await redisClient.set(key, data, ttl).catch(() => {});
  }
};

/**
 * Mapeamento de categorias econômicas para queries de busca
 */
const CATEGORIA_QUERIES = {
  angola: {
    gnews: 'economia Angola OR finanças Angola OR kwanza OR BNA OR banco nacional angola',
    newsapi: 'Angola economy OR Angola finance OR Angolan kwanza OR central bank angola',
    lang: 'pt'
  },
  global: {
    gnews: 'economia global OR mercados financeiros OR inflação OR FED OR BCE OR recessão',
    newsapi: 'global economy OR financial markets OR inflation OR Federal Reserve OR ECB OR recession',
    lang: 'en'
  },
  mercados: {
    gnews: 'bolsa de valores OR petróleo preço OR ouro preço OR commodities OR dólar euro',
    newsapi: 'stock market OR oil prices OR gold prices OR commodities OR forex OR dollar euro',
    lang: 'en'
  }
};

/**
 * Busca notícias econômicas focadas em Angola e mercados globais
 * @param {string} categoria - angola, global, mercados
 * @returns {Promise<Object>} Dados das notícias
 */
const buscarNoticias = async (categoria = 'angola') => {
  console.log(`[NOTICIAS] Buscando notícias econômicas: ${categoria}`);
  const cacheKey = `${REDIS_KEY_PREFIX}${categoria}`;
  
  // 1. Tentar Cache (Redis + memória)
  const cached = await getFromCache(cacheKey);
  if (cached) {
    console.log(`[NOTICIAS] Cache hit para: ${categoria}`);
    return { ...cached, fromCache: true };
  }

  // 2. Buscar de múltiplas fontes em paralelo
  const queries = CATEGORIA_QUERIES[categoria] || CATEGORIA_QUERIES.angola;
  
  const resultados = await Promise.allSettled([
    _fetchFromGNews(queries.gnews, queries.lang),
    _fetchFromNewsAPI(queries.newsapi)
  ]);

  let todosArtigos = [];
  resultados.forEach((res, idx) => {
    const fonte = idx === 0 ? 'gnews' : 'newsapi';
    if (res.status === 'fulfilled' && res.value && res.value.length > 0) {
      console.log(`[NOTICIAS] ${fonte}: ${res.value.length} artigos sobre ${categoria}`);
      todosArtigos = todosArtigos.concat(res.value);
    } else {
      console.warn(`[NOTICIAS] ${fonte}: ${res.status === 'fulfilled' ? '0 artigos' : 'ERRO - ' + res.reason?.message}`);
    }
  });

  // 3. Se não houver notícias, usar fallback e cachear para evitar bater nas APIs
  if (todosArtigos.length === 0) {
    console.warn(`[NOTICIAS] Nenhuma fonte retornou dados para: ${categoria}. Ativando fallback.`);
    const fallback = getFallback(categoria);
    await setCache(cacheKey, fallback, CACHE_TTL);
    return fallback;
  }

  // 4. Limpar e ordenar
  const artigosLimpos = _deduplicateArticles(todosArtigos)
    .sort((a, b) => new Date(b.publicadoEm) - new Date(a.publicadoEm))
    .slice(0, 15); // Limitar a 15 notícias para performance

  const resultado = {
    total: artigosLimpos.length,
    categoria,
    atualizadoEm: new Date().toISOString(),
    artigos: artigosLimpos,
    fontes: resultados.map((r, i) => ({ 
      id: i === 0 ? 'gnews' : 'newsapi', 
      status: r.status 
    }))
  };

  // 5. Guardar em Cache (Redis + memória)
  await setCache(cacheKey, resultado, CACHE_TTL);

  return resultado;
};

/**
 * Busca notícias no GNews com query específica
 */
const _fetchFromGNews = async (query, lang = 'pt') => {
  const API_KEY = process.env.GNEWS_API_KEY || 'demo';
  const encodedQuery = encodeURIComponent(query);
  const url = `https://gnews.io/api/v4/search?q=${encodedQuery}&lang=${lang}&max=10&apikey=${API_KEY}`;
  
  try {
    const resp = await axios.get(url, { timeout: 8000 });
    return (resp.data.articles || []).map(a => ({
      titulo: a.title,
      descricao: a.description,
      fonte: a.source?.name || 'GNews',
      url: a.url,
      imagem: a.image,
      publicadoEm: a.publishedAt,
      provider: 'gnews'
    }));
  } catch (err) {
    if (err.response) {
      console.error(`[NOTICIAS] Erro GNews ${err.response.status}: ${err.response.statusText}`);
    } else if (err.request) {
      console.error(`[NOTICIAS] Erro GNews: sem resposta (timeout/rede)`);
    } else {
      console.error(`[NOTICIAS] Erro GNews: ${err.message}`);
    }
    return [];
  }
};

/**
 * Busca notícias no NewsAPI com query específica
 */
const _fetchFromNewsAPI = async (query) => {
  const API_KEY = process.env.NEWSAPI_API_KEY;
  if (!API_KEY) return [];

  const encodedQuery = encodeURIComponent(query);
  // Buscar notícias dos últimos 3 dias para ter conteúdo fresco
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 3);
  const fromStr = fromDate.toISOString().split('T')[0];
  
  const url = `https://newsapi.org/v2/everything?q=${encodedQuery}&from=${fromStr}&sortBy=publishedAt&pageSize=10&apiKey=${API_KEY}`;
  
  try {
    const resp = await axios.get(url, { timeout: 8000 });
    return (resp.data.articles || []).map(a => ({
      titulo: a.title,
      descricao: a.description,
      fonte: a.source?.name || 'NewsAPI',
      url: a.url,
      imagem: a.urlToImage,
      publicadoEm: a.publishedAt,
      provider: 'newsapi'
    }));
  } catch (err) {
    if (err.response) {
      console.error(`[NOTICIAS] Erro NewsAPI ${err.response.status}: ${err.response.statusText}`);
    } else if (err.request) {
      console.error(`[NOTICIAS] Erro NewsAPI: sem resposta (timeout/rede)`);
    } else {
      console.error(`[NOTICIAS] Erro NewsAPI: ${err.message}`);
    }
    return [];
  }
};

/**
 * Remove notícias duplicadas baseando-se no título (normalizado)
 */
const _deduplicateArticles = (artigos) => {
  const vistos = new Set();
  return artigos.filter(a => {
    if (!a.titulo) return false;
    const slug = a.titulo
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
    
    if (vistos.has(slug)) return false;
    vistos.add(slug);
    return true;
  });
};

/**
 * Retorna dados de fallback com dicas econômicas reais
 */
const getFallback = (categoria) => {
  const fallbackPorCategoria = {
    angola: [
      {
        titulo: 'BNA mantém taxa de juro de referência em 19,5%',
        descricao: 'O Banco Nacional de Angola decidiu manter a taxa de juro de referência inalterada para conter a inflação e estabilizar o kwanza.',
        fonte: 'Economia Angola',
        url: 'https://www.bna.ao',
        publicadoEm: new Date().toISOString()
      },
      {
        titulo: 'Preço do petróleo impacta receitas fiscais de Angola',
        descricao: 'A volatilidade nos preços internacionais do crude continua a ser um factor crítico para as finanças públicas angolanas.',
        fonte: 'Análise Económica',
        url: 'https://www.minfin.gov.ao',
        publicadoEm: new Date().toISOString()
      }
    ],
    global: [
      {
        titulo: 'Fed sinaliza possível pausa nas taxas de juro',
        descricao: 'O Federal Reserve americano indicou que pode interromper o ciclo de subidas das taxas de juro dependendo dos dados de inflação.',
        fonte: 'Economia Global',
        url: 'https://www.federalreserve.gov',
        publicadoEm: new Date().toISOString()
      },
      {
        titulo: 'Inflação na Zona Euro continua acima do target do BCE',
        descricao: 'Os preços ao consumidor na Europa mantêm-se pressionados, complicando a tarefa do Banco Central Europeu.',
        fonte: 'Análise Global',
        url: 'https://www.ecb.europa.eu',
        publicadoEm: new Date().toISOString()
      }
    ],
    mercados: [
      {
        titulo: 'Mercados aguardam decisão sobre taxas de juro',
        descricao: 'Investidores monitorizam de perto os indicadores económicos que podem influenciar as bolsas mundiais esta semana.',
        fonte: 'Mercados Financeiros',
        url: '#',
        publicadoEm: new Date().toISOString()
      },
      {
        titulo: 'Ouro sobe com incerteza geopolítica',
        descricao: 'O metal precioso é procurado como activo de refúgio em tempos de tensão internacional e volatilidade cambial.',
        fonte: 'Commodities',
        url: '#',
        publicadoEm: new Date().toISOString()
      }
    ]
  };

  const artigos = fallbackPorCategoria[categoria] || fallbackPorCategoria.angola;

  return {
    total: artigos.length,
    categoria,
    atualizadoEm: new Date().toISOString(),
    offline: true,
    artigos
  };
};

const gerarResumoIA = async (categoria = 'angola') => {
  const cacheKey = `noticias:resumo:${categoria}`;
  
  const cached = await getFromCache(cacheKey);
  if (cached) {
    console.log(`[NOTICIAS] Resumo cacheado retornado para: ${categoria}`);
    return cached;
  }

  const newsData = await buscarNoticias(categoria);
  
  console.log(`[NOTICIAS] ${newsData.artigos?.length || 0} artigos para resumo. FromCache: ${newsData.fromCache || false}.`);
  
  if (!newsData.artigos || newsData.artigos.length === 0 || newsData.offline) {
    console.warn(`[NOTICIAS] Sem notícias reais disponíveis para resumo. Offline: ${newsData.offline || false}`);
    return { 
      resumo: 'As APIs de notícias estão temporariamente indisponíveis, kamba. Dá uma olhada nas notícias abaixo ou volta mais tarde!',
      offline: true,
      artigosUsados: 0,
      atualizadoEm: new Date().toISOString()
    };
  }

  const headlines = newsData.artigos.slice(0, 8).map(a => `- ${a.titulo} (${a.fonte})`).join('\n');
  
  // Prompt especializado por categoria
  const promptsPorCategoria = {
    angola: {
      system: 'Tu és o Kamba, analista financeiro angolano especializado. Resume as seguintes notícias sobre a economia de Angola em 3 a 4 tópicos claros. Usa um tom casual ("kamba", "mano", "yha") mas mantém rigor técnico. Foca no impacto prático: preços, kwanza, emprego, investimento, inflação. NÃO inventes notícias.',
      contexto: 'economia angolana'
    },
    global: {
      system: 'Tu és o Kamba, analista financeiro. Resume as notícias sobre economia global em 3 a 4 tópicos. Explica como eventos internacionais (FED, BCE, guerra, petróleo) podem afectar Angola e o bolso do cidadão comum. Tom casual ("kamba", "mano") mas preciso. NÃO inventes notícias.',
      contexto: 'economia global'
    },
    mercados: {
      system: 'Tu és o Kamba, analista de mercados. Resume as notícias sobre mercados financeiros, commodities e câmbio em 3 a 4 tópicos. Foca no impacto para quem investe ou quer proteger o dinheiro da inflação. Tom casual ("kamba", "mano") mas técnico. NÃO inventes notícias.',
      contexto: 'mercados financeiros'
    }
  };

  const promptConfig = promptsPorCategoria[categoria] || promptsPorCategoria.angola;
  
  const prompt = [
    { role: 'system', content: promptConfig.system },
    { role: 'user', content: `Notícias sobre ${promptConfig.contexto}:\n${headlines}\n\nResume para os nossos kambas:` }
  ];

  try {
    const response = await aiClient.completar(prompt);
    const resumo = response.choices[0].message.content;
    
    const resultado = {
      resumo,
      artigosUsados: newsData.artigos.length,
      fontes: newsData.fontes || [],
      atualizadoEm: new Date().toISOString()
    };

    await setCache(cacheKey, resultado, RESUMO_CACHE_TTL);

    return resultado;

  } catch (err) {
    console.error('[NOTICIAS] Erro ao gerar resumo IA:', err.message);
    return { 
      resumo: 'Eish, não consegui resumir o mambo agora. Dá uma olhada nas notícias abaixo!',
      artigosUsados: newsData.artigos.length,
      atualizadoEm: new Date().toISOString()
    };
  }
};

/**
 * Verifica o impacto das notícias económicas nas finanças do utilizador
 */
const verificarImpactoFinanceiro = async (usuarioId) => {
  try {
    const [newsData, gastos] = await Promise.all([
      buscarNoticias('angola'),
      prisma.gasto.groupBy({
        by: ['categoriaId'],
        where: { 
          usuarioId, 
          excluido: false, 
          tipo: 'DESPESA', 
          data: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } 
        },
        _sum: { valor: true }
      })
    ]);

    if (!newsData.artigos || newsData.artigos.length === 0) return null;
    if (gastos.length === 0) return null;

    const categorias = await prisma.categoria.findMany({
      where: { id: { in: gastos.map(g => g.categoriaId) } }
    });

    const gastosFormatados = gastos.map(g => {
      const cat = categorias.find(c => c.id === g.categoriaId);
      return `- ${cat?.nome || 'Geral'}: ${Number(g._sum.valor).toLocaleString('pt-AO')} AOA`;
    }).join('\n');

    const headlines = newsData.artigos.slice(0, 5).map(a => `- ${a.titulo}`).join('\n');

    const prompt = [
      { role: 'system', content: 'Tu és o Kamba, o teu bró financeiro. Analisa as notícias económicas de Angola e os gastos do utilizador. Se houver algo que afecte directamente as categorias onde ele mais gasta (ex: combustíveis vs transporte, comida/alimentação vs inflação, kwanza vs importados), gera um alerta curto, proactivo e útil em português de Angola. Se não houver correlação clara, diz APENAS "SEM_IMPACTO".' },
      { role: 'user', content: `NOTÍCIAS ECONÓMICAS DE ANGOLA:\n${headlines}\n\nGASTOS DO UTILIZADOR ESTE MÊS:\n${gastosFormatados}\n\nAnálise de impacto no bolso do kamba:` }
    ];

    const response = await aiClient.completar(prompt);
    const analise = response.choices[0].message.content;

    if (analise.includes('SEM_IMPACTO')) return null;

    return {
      alerta: analise,
      tipo: 'impacto_noticia',
      geradoEm: new Date().toISOString()
    };

  } catch (err) {
    console.error('[NOTICIAS] Erro ao verificar impacto:', err.message);
    return null;
  }
};

module.exports = {
  buscarNoticias,
  gerarResumoIA,
  verificarImpactoFinanceiro
};
