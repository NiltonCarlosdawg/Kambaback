// src/controllers/noticiasController.js
const axios = require('axios');
const NodeCache = require('node-cache');
const { successResponse } = require('../utils/responseFormatter');

// Cache de 1 hora
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

const NEWS_API_KEY = process.env.NEWS_API_KEY || 'demo';
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

// Fontes confiáveis angolanas + internacionais com foco em economia
const FONTES_ANGOLA = [
  'angonoticias.com',
  'jornaldeangola.ao',
  'novojornal.co.ao',
  'expansao.co.ao',
  'mercado.co.ao',
  'opais.ao'
];

/**
 * ==========================================
 * OBTÉM NOTÍCIAS ECONÓMICAS ANGOLA
 * ==========================================
 */
const obterNoticias = async (req, res, next) => {
  try {
    const cacheKey = 'noticias_angola_economia';
    const cached = cache.get(cacheKey);

    if (cached) {
      return successResponse(res, {
        mensagem: 'Notícias económicas carregadas (cache)',
        fonte: 'cache',
        atualizado: new Date(cached.timestamp).toLocaleString('pt-AO'),
        noticias: cached.noticias
      });
    }

    let noticias = [];

    // 1. Tenta GNews (melhor para Angola)
    try {
      const gnews = await axios.get('https://gnews.io/api/v4/search', {
        params: {
          q: 'economia OR kwanza OR petróleo OR BNA OR inflação OR investimento',
          lang: 'pt',
          country: 'ao',
          max: 15,
          token: GNEWS_API_KEY
        },
        timeout: 8000
      });

      noticias = gnews.data.articles?.map(a => ({
        titulo: a.title,
        descricao: a.description || '',
        fonte: a.source.name,
        url: a.url,
        imagem: a.image || null,
        publicadoEm: new Date(a.publishedAt).toLocaleString('pt-AO')
      })) || [];
    } catch (e) {
      console.log('GNews falhou, tentando NewsAPI...');
    }

    // 2. Se GNews falhar ou trouxer pouco, tenta NewsAPI
    if (noticias.length < 5) {
      try {
        const newsapi = await axios.get('https://newsapi.org/v2/everything', {
          params: {
            q: 'Angola economia OR kwanza OR BNA',
            language: 'pt',
            sortBy: 'publishedAt',
            pageSize: 15,
            domains: FONTES_ANGOLA.join(','),
            apiKey: NEWS_API_KEY
          },
          timeout: 8000
        });

        const extras = newsapi.data.articles?.map(a => ({
          titulo: a.title,
          descricao: a.description || '',
          fonte: a.source.name,
          url: a.url,
          imagem: a.urlToImage || null,
          publicadoEm: new Date(a.publishedAt).toLocaleString('pt-AO')
        })) || [];

        noticias = [...noticias, ...extras];
      } catch (e) {
        console.log('NewsAPI também falhou');
      }
    }

    // 3. Remove duplicados por título
    const unicas = noticias.filter((v, i, a) =>
      a.findIndex(t => t.titulo === v.titulo) === i
    ).slice(0, 12);

    // 4. Cache por 1 hora
    cache.set(cacheKey, {
      timestamp: Date.now(),
      noticias: unicas
    });

    return successResponse(res, {
      mensagem: 'Notícias económicas de Angola atualizadas!',
      total: unicas.length,
      atualizado: new Date().toLocaleString('pt-AO'),
      noticias: unicas
    });

  } catch (err) {
    // Se tudo falhar, retorna cache antigo (se existir)
    const fallback = cache.get(cacheKey);
    if (fallback) {
      return successResponse(res, {
        mensagem: 'Problema na internet, mas aqui tens as últimas notícias que guardei',
        fonte: 'cache antigo',
        noticias: fallback.noticias
      });
    }

    next(err);
  }
};

module.exports = { obterNoticias };