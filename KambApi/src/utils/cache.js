// src/utils/cache.js
const Redis = require('ioredis');

/**
 * ==========================================
 * SISTEMA DE CACHE INTELIGENTE
 * Suporta Redis + Fallback para Memória
 * ==========================================
 */

let redisClient = null;
const memoryCache = new Map();

// Tenta conectar ao Redis
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    redisClient.on('error', (err) => {
      console.warn('⚠️  Redis error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('✅ Cache Redis conectado');
    });

    redisClient.on('ready', () => {
      console.log('✅ Cache Redis pronto');
    });

  } catch (err) {
    console.warn('⚠️  Redis indisponível - usando cache em memória');
    redisClient = null;
  }
}

/**
 * Verifica se Redis está disponível
 */
const isRedisAvailable = () => {
  return redisClient && redisClient.status === 'ready';
};

/**
 * GET - Busca valor do cache
 * @param {string} key - Chave do cache
 * @returns {Promise<any|null>}
 */
const getCache = async (key) => {
  try {
    if (isRedisAvailable()) {
      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    }

    // Fallback para memória
    const cached = memoryCache.get(key);
    if (cached && cached.expireAt > Date.now()) {
      return cached.value;
    }

    // Remove se expirado
    if (cached) {
      memoryCache.delete(key);
    }

    return null;

  } catch (err) {
    console.error('[CACHE] Erro ao buscar:', err.message);
    return null;
  }
};

/**
 * SET - Armazena valor no cache
 * @param {string} key - Chave do cache
 * @param {any} value - Valor a armazenar
 * @param {number} ttl - Tempo de vida em segundos (padrão: 300 = 5min)
 * @returns {Promise<boolean>}
 */
const setCache = async (key, value, ttl = 300) => {
  try {
    if (isRedisAvailable()) {
      await redisClient.setex(key, ttl, JSON.stringify(value));
      return true;
    }

    // Fallback para memória
    memoryCache.set(key, {
      value,
      expireAt: Date.now() + (ttl * 1000)
    });

    return true;

  } catch (err) {
    console.error('[CACHE] Erro ao salvar:', err.message);
    return false;
  }
};

/**
 * DELETE - Remove valor do cache
 * Suporta wildcard (*) para deletar múltiplas keys
 * @param {string} pattern - Chave ou padrão (ex: "user:123:*")
 * @returns {Promise<number>} - Número de keys deletadas
 */
const deleteCache = async (pattern) => {
  try {
    if (isRedisAvailable()) {
      // Se tem wildcard, usa SCAN para buscar keys
      if (pattern.includes('*')) {
        const keys = [];
        let cursor = '0';

        do {
          const [nextCursor, matchedKeys] = await redisClient.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100
          );

          cursor = nextCursor;
          keys.push(...matchedKeys);
        } while (cursor !== '0');

        if (keys.length > 0) {
          await redisClient.del(...keys);
          return keys.length;
        }

        return 0;
      }

      // Key exata
      const deleted = await redisClient.del(pattern);
      return deleted;
    }

    // Fallback para memória
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      let count = 0;

      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key);
          count++;
        }
      }

      return count;
    }

    // Key exata
    const existed = memoryCache.has(pattern);
    memoryCache.delete(pattern);
    return existed ? 1 : 0;

  } catch (err) {
    console.error('[CACHE] Erro ao deletar:', err.message);
    return 0;
  }
};

/**
 * CLEAR - Limpa todo o cache (use com cuidado!)
 * @param {string} prefix - Opcional: limpa apenas keys com este prefixo
 * @returns {Promise<boolean>}
 */
const clearCache = async (prefix = null) => {
  try {
    if (isRedisAvailable()) {
      if (prefix) {
        await deleteCache(`${prefix}*`);
      } else {
        await redisClient.flushdb();
      }
      console.log(`✅ Cache limpo${prefix ? ` (prefix: ${prefix})` : ''}`);
      return true;
    }

    // Fallback para memória
    if (prefix) {
      for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          memoryCache.delete(key);
        }
      }
    } else {
      memoryCache.clear();
    }

    return true;

  } catch (err) {
    console.error('[CACHE] Erro ao limpar:', err.message);
    return false;
  }
};

/**
 * EXISTS - Verifica se chave existe no cache
 * @param {string} key
 * @returns {Promise<boolean>}
 */
const existsCache = async (key) => {
  try {
    if (isRedisAvailable()) {
      const exists = await redisClient.exists(key);
      return exists === 1;
    }

    const cached = memoryCache.get(key);
    if (cached && cached.expireAt > Date.now()) {
      return true;
    }

    return false;

  } catch (err) {
    console.error('[CACHE] Erro ao verificar existência:', err.message);
    return false;
  }
};

/**
 * TTL - Retorna tempo restante de vida de uma key (em segundos)
 * @param {string} key
 * @returns {Promise<number>} - Segundos restantes ou -1 se não existe
 */
const getTTL = async (key) => {
  try {
    if (isRedisAvailable()) {
      return await redisClient.ttl(key);
    }

    const cached = memoryCache.get(key);
    if (cached) {
      return Math.max(0, Math.floor((cached.expireAt - Date.now()) / 1000));
    }

    return -1;

  } catch (err) {
    console.error('[CACHE] Erro ao buscar TTL:', err.message);
    return -1;
  }
};

/**
 * INCREMENT - Incrementa valor numérico no cache (útil para contadores)
 * @param {string} key
 * @param {number} amount - Valor a incrementar (padrão: 1)
 * @returns {Promise<number>} - Novo valor
 */
const incrementCache = async (key, amount = 1) => {
  try {
    if (isRedisAvailable()) {
      return await redisClient.incrby(key, amount);
    }

    const cached = memoryCache.get(key);
    const currentValue = (cached?.value || 0) + amount;

    memoryCache.set(key, {
      value: currentValue,
      expireAt: cached?.expireAt || (Date.now() + 86400000) // 24h padrão
    });

    return currentValue;

  } catch (err) {
    console.error('[CACHE] Erro ao incrementar:', err.message);
    return 0;
  }
};

/**
 * GET_OR_SET - Busca do cache ou executa função e armazena
 * @param {string} key
 * @param {Function} fn - Função assíncrona que retorna o valor
 * @param {number} ttl - TTL em segundos
 * @returns {Promise<any>}
 */
const getOrSet = async (key, fn, ttl = 300) => {
  try {
    // Tenta buscar do cache
    const cached = await getCache(key);
    if (cached !== null) {
      return cached;
    }

    // Executa função para obter valor
    const value = await fn();

    // Armazena no cache
    await setCache(key, value, ttl);

    return value;

  } catch (err) {
    console.error('[CACHE] Erro no getOrSet:', err.message);
    // Se falhar, executa a função diretamente
    return await fn();
  }
};

/**
 * STATS - Retorna estatísticas do cache
 * @returns {Promise<object>}
 */
const getCacheStats = async () => {
  try {
    if (isRedisAvailable()) {
      const info = await redisClient.info('stats');
      const dbsize = await redisClient.dbsize();

      return {
        type: 'redis',
        connected: true,
        totalKeys: dbsize,
        rawInfo: info
      };
    }

    return {
      type: 'memory',
      connected: true,
      totalKeys: memoryCache.size,
      keys: Array.from(memoryCache.keys())
    };

  } catch (err) {
    console.error('[CACHE] Erro ao buscar stats:', err.message);
    return { type: 'unknown', connected: false };
  }
};

/**
 * Limpa cache expirado da memória (garbage collection)
 * Roda automaticamente a cada 10 minutos
 */
const cleanExpiredMemoryCache = () => {
  if (redisClient) return; // Redis faz isso automaticamente

  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of memoryCache.entries()) {
    if (value.expireAt < now) {
      memoryCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cache em memória: ${cleaned} entradas expiradas removidas`);
  }
};

// Agenda limpeza automática
if (!redisClient) {
  setInterval(cleanExpiredMemoryCache, 10 * 60 * 1000); // 10 minutos
}

/**
 * Desconecta Redis gracefully
 */
const disconnectCache = async () => {
  if (redisClient) {
    await redisClient.quit();
    console.log('✅ Cache Redis desconectado');
  }
};

// ==========================================
// EXPORTAÇÕES
// ==========================================
module.exports = {
  getCache,
  setCache,
  deleteCache,
  clearCache,
  existsCache,
  getTTL,
  incrementCache,
  getOrSet,
  getCacheStats,
  disconnectCache,
  isRedisAvailable
};