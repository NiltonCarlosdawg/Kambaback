// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');

/**
 * ==========================================
 * CONFIGURAÇÃO DE REDIS (opcional)
 * ==========================================
 */
let redisClient = null;
let redisAvailable = false;

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => {
        console.error('[REDIS] Erro de conexão:', err.message);
        return true;
      }
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
      console.log('✅ Redis conectado para Rate Limiting');
    });

    redisClient.on('error', (err) => {
      redisAvailable = false;
      console.warn('[REDIS] Erro:', err.message);
    });
    
  } catch (err) {
    console.warn('⚠️ Falha ao conectar Redis - usando memória local');
    redisClient = null;
  }
} else {
  console.log('[RATE LIMIT] REDIS_URL não configurada - usando memória local');
}

const getRedisStore = (prefix) => {
  if (!redisClient || !redisAvailable) return undefined;
  
  return new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: prefix
  });
};

const getStore = (prefix) => {
  const redisStore = getRedisStore(prefix);
  if (redisStore) return redisStore;
  return undefined;
};

const mensagemLimite = {
  success: false,
  error: { message: 'Muitas tentativas, kamba! Tenta mais tarde.' }
};

const validateOptions = { ip: false, trustProxy: false };

/**
 * ==========================================
 * APENAS RATE LIMIT DE AUTENTICAÇÃO
 * Protege contra brute force em login/register
 * ==========================================
 */
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  validate: validateOptions,
  skipSuccessfulRequests: true, // Não conta logins bem-sucedidos
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    ...mensagemLimite, 
    error: { message: 'Muitas tentativas de login. Aguarda 15 minutos, kamba!' } 
  },
  store: getStore('rl:auth:')
});

const isRedisAvailable = () => redisAvailable && redisClient?.status === 'ready';

module.exports = {
  limiteAuth,
  redisClient,
  isRedisAvailable
};