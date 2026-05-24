const noticiaService = require('../../../noticias/services/noticiasService');

/**
 * Tool para buscar notícias recentes de economia em Angola
 */
module.exports = {
  name: 'getRecentNews',
  description: 'Busca as notícias económicas e financeiras mais recentes de Angola. Útil para responder sobre inflação, BNA, taxas de câmbio e mambo do mercado.',
  handler: async ({ categoria = 'business' }) => {
    try {
      const resultado = await noticiaService.buscarNoticias(categoria);
      
      if (!resultado.artigos || resultado.artigos.length === 0) {
        return { mensagem: 'Não encontrei notícias recentes sobre este tema, kamba.' };
      }

      // Formatar para a IA ler melhor
      const sumario = resultado.artigos.slice(0, 5).map(a => 
        `- ${a.titulo} (${a.fonte})\n  "${a.descricao}"\n  Link: ${a.url}`
      ).join('\n\n');

      return {
        contexto: `Últimas notícias em Angola (${categoria}):`,
        noticias: sumario,
        total: resultado.total,
        offline: resultado.offline || false
      };

    } catch (err) {
      console.error('[TOOL:getRecentNews] Erro:', err.message);
      return { erro: 'Não consegui aceder às notícias agora.' };
    }
  },
  parameters: {
    type: 'object',
    properties: {
      categoria: {
        type: 'string',
        description: 'Categoria das notícias (business, general, technology)',
        enum: ['business', 'general', 'technology', 'science', 'health', 'sports']
      }
    }
  },
  category: 'financial'
};
