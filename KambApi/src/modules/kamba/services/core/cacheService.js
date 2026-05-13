// services/core/cacheService.js
// Cache de respostas com TTL

const NodeCache = require('node-cache');

const cache = new NodeCache({ 
  stdTTL: 5 * 60, // 5 minutos
  checkperiod: 60, // Verifica a cada 60s
  useClones: false
});

/**
 * Gera uma chave de cache baseada no utilizador e mensagem
 * @param {string} usuarioId - ID do utilizador
 * @param {string} mensagem - Mensagem
 * @returns {string} Chave de cache
 */
const gerarChave = (usuarioId, mensagem) => {
  return `${usuarioId}:${mensagem.toLowerCase().trim()}`;
};

/**
 * Verifica se existe uma resposta cacheada
 * @param {string} usuarioId - ID do utilizador
 * @param {string} mensagem - Mensagem
 * @returns {string|null} Resposta cacheada ou null
 */
const verificar = (usuarioId, mensagem) => {
  const chave = gerarChave(usuarioId, mensagem);
  return cache.get(chave) || null;
};

/**
 * Guarda uma resposta no cache
 * @param {string} usuarioId - ID do utilizador
 * @param {string} mensagem - Mensagem
 * @param {string} resposta - Resposta a guardar
 * @param {number} ttl - Tempo de vida em segundos (opcional)
 */
const guardar = (usuarioId, mensagem, resposta, ttl = null) => {
  const chave = gerarChave(usuarioId, mensagem);
  cache.set(chave, resposta, ttl);
};

/**
 * Limpa o cache de um utilizador
 * @param {string} usuarioId - ID do utilizador
 */
const limpar = (usuarioId) => {
  const keys = cache.keys();
  const userKeys = keys.filter(k => k.startsWith(`${usuarioId}:`));
  cache.del(userKeys);
};

/**
 * Limpa todo o cache
 */
const limparTudo = () => {
  cache.flushAll();
};

/**
 * Obtém estatísticas do cache
 * @returns {Object} Estatísticas
 */
const getEstatisticas = () => {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses
  };
};

module.exports = {
  verificar,
  guardar,
  limpar,
  limparTudo,
  getEstatisticas
};
