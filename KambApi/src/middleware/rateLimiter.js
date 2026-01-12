// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const slowDown = require('express-slow-down');

/**
 * ==========================================
 * CONFIGURAÇÃO DE REDIS
 * ==========================================
 */
let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3
    });
    redisClient.on('connect', () => console.log('✅ Redis conectado para Rate Limiting'));
  } catch (err) {
    console.warn('⚠️ Falha ao conectar Redis - usando memória local');
  }
}

/**
 * FUNÇÃO AUXILIAR PARA REDIS STORE (v3+)
 */
const getRedisStore = (prefix) => {
  if (!redisClient) return undefined;
  return new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: prefix
  });
};

const mensagemLimite = {
  success: false,
  error: { message: 'Muitas requisições, kamba! Tenta mais tarde.' }
};

const validateOptions = { default: false, ip: false, trustProxy: false };

/**
 * ==========================================
 * DEFINIÇÃO DOS LIMITADORES
 * ==========================================
 */

// 1. GLOBAL
const limiteGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: validateOptions,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(mensagemLimite),
  store: getRedisStore('rl:global:')
});

// 2. AUTENTICAÇÃO
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  validate: validateOptions,
  skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).json({ ...mensagemLimite, error: { message: 'Muitas tentativas de login!' } }),
  store: getRedisStore('rl:auth:')
});

// 3. KAMBA IA
const limiteKamba = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  validate: validateOptions,
  store: getRedisStore('rl:kamba:')
});

// 4. FINANCEIRO (O que estava a faltar!)
const limiteFinanceiro = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  validate: validateOptions,
  store: getRedisStore('rl:financeiro:')
});

// 5. SLOW DOWN
const slowDownLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 500,
  validate: { ip: false, trustProxy: false },
  store: getRedisStore('sd:gen:')
});

/**
 * ==========================================
 * EXPORTAÇÃO (Sincronizada com o server.js)
 * ==========================================
 */
module.exports = {
  limiteGlobal,
  limiteAuth,
  limiteKamba,
  limiteFinanceiro, // Essencial para as rotas de cartões/gastos/objetivos
  slowDownLimiter,
  redisClient 
};