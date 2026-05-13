module.exports = {
  name: 'getFluxoCaixaMensal',
  description: 'Busca receitas totais, despesas totais e poupança do mês actual. Chamar APENAS quando o utilizador pede EXPLICITAMENTE dados de gastos mensais.',
  handler: async (_, context) => {
    const Insights = require('../../../insights/controllers/insightsController');
    return Insights.getFluxoCaixaMensal?.(context.usuarioId);
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
