// services/core/cacheService.js
// Cache de respostas com Redis + fallback em memória

const NodeCache = require("node-cache");
const redisClient = require("./redisClient");

const cacheMemoria = new NodeCache({
  stdTTL: 5 * 60,
  checkperiod: 60,
  useClones: false,
});

const CACHE_TTL_PADRAO = 5 * 60;

const gerarChave = (usuarioId, mensagem) => {
  return `cache:${usuarioId}:${mensagem.toLowerCase().trim()}`;
};

const verificar = async (usuarioId, mensagem) => {
  const chave = gerarChave(usuarioId, mensagem);

  if (redisClient.isDisponivel()) {
    try {
      const valor = await redisClient.get(chave);
      if (valor !== null) return valor;
    } catch {
      /* fallback */
    }
  }

  return cacheMemoria.get(chave) || null;
};

const guardar = async (usuarioId, mensagem, resposta, ttl = null) => {
  const chave = gerarChave(usuarioId, mensagem);
  const ttlFinal = ttl || CACHE_TTL_PADRAO;

  if (redisClient.isDisponivel()) {
    try {
      await redisClient.set(chave, resposta, ttlFinal);
      return;
    } catch {
      /* fallback */
    }
  }

  cacheMemoria.set(chave, resposta, ttlFinal);
};

const limpar = async (usuarioId) => {
  if (redisClient.isDisponivel()) {
    try {
      const keys = await redisClient.keys(`cache:${usuarioId}:*`);
      for (const key of keys) {
        await redisClient.del(key);
      }
    } catch {
      /* fallback */
    }
  }

  const keys = cacheMemoria
    .keys()
    .filter((k) => k.startsWith(`cache:${usuarioId}:`));
  cacheMemoria.del(keys);
};

const limparTudo = async () => {
  if (redisClient.isDisponivel()) {
    try {
      const keys = await redisClient.keys("cache:*");
      for (const key of keys) {
        await redisClient.del(key);
      }
    } catch {
      /* fallback */
    }
  }

  cacheMemoria.flushAll();
};

const getEstatisticas = () => {
  return {
    keys: cacheMemoria.keys().length,
    hits: cacheMemoria.getStats().hits,
    misses: cacheMemoria.getStats().misses,
    redisDisponivel: redisClient.isDisponivel(),
  };
};

module.exports = {
  verificar,
  guardar,
  limpar,
  limparTudo,
  getEstatisticas,
};
