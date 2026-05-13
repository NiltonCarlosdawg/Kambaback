module.exports = {
  name: 'getCartoesStatus',
  description: 'Busca saldo e estado de cartões e contas. Chamar APENAS quando o utilizador pergunta EXPLICITAMENTE o saldo.',
  handler: async (_, context) => {
    const Insights = require('../../../insights/controllers/insightsController');
    return Insights.getCartoesStatus?.(context.usuarioId);
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
