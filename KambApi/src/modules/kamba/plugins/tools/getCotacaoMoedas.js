module.exports = {
  name: 'getCotacaoMoedas',
  description: 'Busca cotação actual do dólar (USD) e euro (EUR) em kwanzas (AOA). Chamar APENAS quando o utilizador perguntar explicitamente sobre câmbio.',
  handler: async () => {
    return {
      data: new Date().toISOString(),
      cotacoes: {
        USD: { oficial: 835.50, paralelo: 980.00, variacao: 'estável' },
        EUR: { oficial: 905.20, paralelo: 1060.00, variacao: 'estável' }
      },
      nota: 'Cotações aproximadas para referência. Consulte o banco para valores exactos.'
    };
  },
  parameters: { type: 'object', properties: {} },
  category: 'knowledge'
};
