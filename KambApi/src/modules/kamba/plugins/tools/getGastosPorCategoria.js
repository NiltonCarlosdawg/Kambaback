module.exports = {
  name: 'getGastosPorCategoria',
  description: 'Busca distribuição de gastos por categoria. Chamar APENAS quando o utilizador pede EXPLICITAMENTE ver categorias.',
  handler: async (_, context) => {
    const Insights = require('../../../insights/controllers/insightsController');
    return Insights.getGastosPorCategoria?.(context.usuarioId);
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
