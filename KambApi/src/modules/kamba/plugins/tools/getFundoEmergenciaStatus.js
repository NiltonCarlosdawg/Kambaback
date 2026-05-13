module.exports = {
  name: 'getFundoEmergenciaStatus',
  description: 'Busca estado do fundo de emergência. Chamar APENAS quando o utilizador pergunta EXPLICITAMENTE sobre reservas.',
  handler: async (_, context) => {
    const Insights = require('../../../insights/controllers/insightsController');
    return Insights.getFundoEmergenciaStatus?.(context.usuarioId);
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
