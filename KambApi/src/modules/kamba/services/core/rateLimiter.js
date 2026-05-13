// services/core/rateLimiter.js
// Rate limiting em memória (preparado para Redis no futuro)

const limites = new Map();

const MAX_REQUESTS = 15;
const RATE_WINDOW = 60 * 1000; // 1 minuto

/**
 * Verifica se o utilizador está dentro do rate limit
 * @param {string} usuarioId - ID do utilizador
 * @returns {Object} { bloqueado: boolean, tentarEm: number }
 */
const verificar = (usuarioId) => {
  const agora = Date.now();
  const userLimit = limites.get(usuarioId) || { count: 0, resetAt: agora + RATE_WINDOW };

  if (agora > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = agora + RATE_WINDOW;
  }

  if (userLimit.count >= MAX_REQUESTS) {
    return { 
      bloqueado: true, 
      tentarEm: Math.ceil((userLimit.resetAt - agora) / 1000) 
    };
  }

  userLimit.count++;
  limites.set(usuarioId, userLimit);

  return { bloqueado: false, tentarEm: 0 };
};

/**
 * Obtém o estado actual do rate limit de um utilizador
 * @param {string} usuarioId - ID do utilizador
 * @returns {Object} Estado do rate limit
 */
const getEstado = (usuarioId) => {
  const agora = Date.now();
  const userLimit = limites.get(usuarioId);
  
  if (!userLimit) {
    return { count: 0, limit: MAX_REQUESTS, resetAt: agora + RATE_WINDOW };
  }

  return {
    count: userLimit.count,
    limit: MAX_REQUESTS,
    resetAt: userLimit.resetAt,
    remaining: Math.max(0, MAX_REQUESTS - userLimit.count)
  };
};

/**
 * Reseta o rate limit de um utilizador
 * @param {string} usuarioId - ID do utilizador
 */
const reset = (usuarioId) => {
  limites.delete(usuarioId);
};

/**
 * Limpa entradas expiradas do rate limiter
 */
const limparExpirados = () => {
  const agora = Date.now();
  for (const [usuarioId, limit] of limites.entries()) {
    if (agora > limit.resetAt) {
      limites.delete(usuarioId);
    }
  }
};

// Limpar expirados a cada 5 minutos
setInterval(limparExpirados, 5 * 60 * 1000);

module.exports = {
  verificar,
  getEstado,
  reset,
  MAX_REQUESTS,
  RATE_WINDOW
};
