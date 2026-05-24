const redisClient = require("./redisClient");

const MAX_REQUESTS = 15;
const RATE_WINDOW = 60;

const PREFIXO = "ratelimit:";

const verificar = async (usuarioId) => {
  const chave = `${PREFIXO}${usuarioId}`;

  if (redisClient.isDisponivel()) {
    try {
      const count = await redisClient.incr(chave);
      if (count === 1) {
        await redisClient.expire(chave, RATE_WINDOW);
      }

      if (count > MAX_REQUESTS) {
        const ttlRemaining = await redisClient.ttl(chave);
        return {
          bloqueado: true,
          tentarEm: ttlRemaining > 0 ? ttlRemaining : 0,
        };
      }

      return { bloqueado: false, tentarEm: 0 };
    } catch {
      /* fallback memory */
    }
  }

  return verificarEmMemoria(usuarioId);
};

const limitesMemoria = new Map();

const verificarEmMemoria = (usuarioId) => {
  const agora = Date.now();
  const windowMs = RATE_WINDOW * 1000;
  const userLimit = limitesMemoria.get(usuarioId) || {
    count: 0,
    resetAt: agora + windowMs,
  };

  if (agora > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = agora + windowMs;
  }

  if (userLimit.count >= MAX_REQUESTS) {
    return {
      bloqueado: true,
      tentarEm: Math.ceil((userLimit.resetAt - agora) / 1000),
    };
  }

  userLimit.count++;
  limitesMemoria.set(usuarioId, userLimit);
  return { bloqueado: false, tentarEm: 0 };
};

const getEstado = async (usuarioId) => {
  const chave = `${PREFIXO}${usuarioId}`;

  if (redisClient.isDisponivel()) {
    try {
      const count = await redisClient.get(chave);
      const ttlRemaining = await redisClient.ttl(chave);

      return {
        count: count || 0,
        limit: MAX_REQUESTS,
        resetAt:
          ttlRemaining > 0
            ? Date.now() + ttlRemaining * 1000
            : Date.now() + RATE_WINDOW * 1000,
        remaining: Math.max(0, MAX_REQUESTS - (count || 0)),
        redis: true,
      };
    } catch {
      /* fallback */
    }
  }

  return getEstadoMemoria(usuarioId);
};

const getEstadoMemoria = (usuarioId) => {
  const agora = Date.now();
  const userLimit = limitesMemoria.get(usuarioId);

  if (!userLimit) {
    return {
      count: 0,
      limit: MAX_REQUESTS,
      resetAt: agora + RATE_WINDOW * 1000,
      redis: false,
    };
  }

  return {
    count: userLimit.count,
    limit: MAX_REQUESTS,
    resetAt: userLimit.resetAt,
    remaining: Math.max(0, MAX_REQUESTS - userLimit.count),
    redis: false,
  };
};

const reset = async (usuarioId) => {
  const chave = `${PREFIXO}${usuarioId}`;

  if (redisClient.isDisponivel()) {
    try {
      await redisClient.del(chave);
      return;
    } catch {
      /* fallback */
    }
  }

  limitesMemoria.delete(usuarioId);
};

module.exports = {
  verificar,
  getEstado,
  reset,
  MAX_REQUESTS,
  RATE_WINDOW,
};
