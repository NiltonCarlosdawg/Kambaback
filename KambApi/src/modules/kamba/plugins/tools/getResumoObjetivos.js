module.exports = {
  name: 'getResumoObjetivos',
  description: 'Busca progresso das metas financeiras. Chamar APENAS quando o utilizador pede EXPLICITAMENTE para ver objetivos.',
  handler: async (_, context) => {
    const Insights = require('../../../insights/controllers/insightsController');
    return Insights.getResumoObjetivos?.(context.usuarioId);
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
