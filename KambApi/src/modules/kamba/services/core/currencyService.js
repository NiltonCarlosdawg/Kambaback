const redisClient = require('./redisClient');

const TAXAS_FALLBACK = {
  USD_AOA: 850,
  EUR_AOA: 920,
};

const CACHE_KEY = 'currency:taxas:actuais';
const CACHE_TTL = 4 * 60 * 60;

const getTaxas = async () => {
  if (redisClient.isDisponivel()) {
    try {
      const cached = await redisClient.get(CACHE_KEY);
      if (cached) return cached;
    } catch { }
  }
  return TAXAS_FALLBACK;
};

const actualizarTaxas = async (usdAoa, eurAoa) => {
  const taxas = {
    USD_AOA: usdAoa || TAXAS_FALLBACK.USD_AOA,
    EUR_AOA: eurAoa || TAXAS_FALLBACK.EUR_AOA,
    actualizadoEm: new Date().toISOString()
  };
  if (redisClient.isDisponivel()) {
    await redisClient.set(CACHE_KEY, taxas, CACHE_TTL).catch(() => {});
  }
  return taxas;
};

const converterParaAOA = async (valor, moedaOrigem) => {
  if (moedaOrigem === 'AOA') return { valorAOA: valor, taxa: 1 };

  const taxas = await getTaxas();
  const chave = `${moedaOrigem}_AOA`;
  const taxa = taxas[chave] || TAXAS_FALLBACK[chave] || 1;

  return {
    valorAOA: Math.round(valor * taxa),
    taxa,
    moedaOriginal: moedaOrigem,
    valorOriginal: valor
  };
};

const formatarValor = (valor, moeda = 'AOA') => {
  if (moeda === 'USD') return `$${Number(valor).toFixed(2)}`;
  if (moeda === 'EUR') return `€${Number(valor).toFixed(2)}`;
  return `${Number(valor).toLocaleString('pt-AO')} AOA`;
};

module.exports = {
  getTaxas,
  actualizarTaxas,
  converterParaAOA,
  formatarValor,
  TAXAS_FALLBACK
};
