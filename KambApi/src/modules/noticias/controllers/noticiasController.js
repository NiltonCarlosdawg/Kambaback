// src/controllers/noticiasController.js
const axios = require('axios');


const ultimas = async (req, res, next) => {
  const API_KEY = process.env.GNEWS_API_KEY || 'demo'; // "demo" funciona com limite
  const categoria = req.query.categoria || 'business'; // business, general, technology...
  const idioma = 'pt';

  try {
    const url = `https://gnews.io/api/v4/top-headlines?country=ao&category=${categoria}&lang=${idioma}&max=10&apikey=${API_KEY}`;

    const resposta = await axios.get(url, { timeout: 8000 });

    const artigos = (resposta.data.articles || []).map(a => ({
      titulo: a.title,
      descricao: a.description || 'Clique para ler mais',
      fonte: a.source.name,
      url: a.url,
      imagem: a.image || 'https://kambapro.ao/placeholder-noticia.jpg',
      publicadoEm: a.publishedAt
    }));

    res.json({
      success: true,
      total: resposta.data.totalArticles || artigos.length,
      categoria,
      atualizadoEm: new Date().toISOString(),
      artigos
    });

  } catch (err) {
    console.warn('GNews offline ou erro → ativando fallback angolano');

    // FALLBACK 100% ANGOLANO – nunca quebra!
    const fallback = [
      {
        titulo: 'KambaPro é o app financeiro nº1 em Angola em 2025!',
        descricao: 'Milhares de kwanzas já poupados com o nosso sistema automático.',
        fonte: 'Kamba News',
        url: 'https://kambapro.ao',
        imagem: 'https://kambapro.ao/logo.png',
        publicadoEm: new Date().toISOString()
      },
      {
        titulo: 'Aprende a poupar como um verdadeiro kamba',
        descricao: 'Dicas diárias do Kamba: poupança automática, objetivos e mais.',
        fonte: 'Kamba Tips',
        url: 'https://kambapro.ao/dicas',
        publicadoEm: new Date().toISOString()
      },
      {
        titulo: 'Novas funcionalidades chegando este mês!',
        descricao: 'Transferências, investimentos e muito mais.',
        fonte: 'KambaPro Updates',
        url: 'https://kambapro.ao/atualizacoes',
        publicadoEm: new Date().toISOString()
      },
      {
        titulo: 'O futuro do dinheiro digital em Angola',
        descricao: 'EMIS, Multicaixa e KambaPro lideram a revolução.',
        fonte: 'Economia AO',
        url: '#',
        publicadoEm: new Date().toISOString()
      },
      {
        titulo: 'Tu és o dono do teu futuro financeiro',
        descricao: 'Começa hoje com o KambaPro – grátis e 100% angolano.',
        fonte: 'Nilton Costa',
        url: 'https://kambapro.ao',
        publicadoEm: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      total: fallback.length,
      categoria,
      atualizadoEm: new Date().toISOString(),
      offline: true,
      mensagem: 'Sem conexão com a internet – mostrando notícias do Kamba!',
      artigos: fallback
    });
  }
};

module.exports = { ultimas };