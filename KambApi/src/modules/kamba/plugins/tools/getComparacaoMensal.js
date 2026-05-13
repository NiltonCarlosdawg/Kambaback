module.exports = {
  name: 'getComparacaoMensal',
  description: 'Compara gastos do mês actual com o mês anterior. Chamar APENAS quando o utilizador pede EXPLICITAMENTE comparação.',
  handler: async (_, context) => {
    const Insights = require('../../../insights/controllers/insightsController');
    return Insights.getComparacaoMensal?.(context.usuarioId);
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
