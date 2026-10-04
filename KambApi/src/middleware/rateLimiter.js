// src/middleware/rateLimiter.js
const { rateLimit, MemoryStore } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const { montarRedisUrl } = require('../utils/redisUrl');

/**
 * ==========================================
 * CONFIGURAÇÃO DE REDIS (opcional)
 * ==========================================
 * F-021: a ligação é criada já com a URL unificada (REDIS_URL ou
 * REDIS_HOST/PORT/PASSWORD) — antes só REDIS_URL era lido, o .env não o tinha
 * e o cliente nunca existia.
 */
let redisClient = null;
let redisAvailable = false;

const redisUrl = montarRedisUrl();
if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      reconnectOnError: (err) => {
        // credenciais erradas/diferentes não se resolvem a repetir — evita o
        // loop infinito de reconexão (F-021)
        if (/\bAUTH\b|NOAUTH/i.test(err.message)) {
          console.warn('[REDIS] AUTH recusado — Rate Limit fica em memória local');
          return false;
        }
        console.error('[REDIS] Erro de conexão:', err.message);
        return true;
      },
    });

    // 'ready' (e não 'connect') = já pode executar comandos; o PING confirma
    // que a autenticação também passou — só aí o store Redis é seguro de usar
    redisClient.on('ready', async () => {
      try {
        await redisClient.ping();
        redisAvailable = true;
        console.log('✅ Redis conectado para Rate Limiting');
      } catch (err) {
        redisAvailable = false;
        console.warn('[RATE LIMIT] Redis não autenticado — memória local:', err.message);
      }
    });
    redisClient.on('close', () => {
      redisAvailable = false;
    });
    redisClient.on('error', (err) => {
      redisAvailable = false;
      console.warn('[REDIS] Erro:', err.message);
    });

  } catch (err) {
    console.warn('⚠️ Falha ao conectar Redis - usando memória local', err.message);
    redisClient = null;
  }
} else {
  console.log('[RATE LIMIT] REDIS_HOST/URL não configurada - usando memória local');
}

const isRedisAvailable = () => redisAvailable && redisClient?.status === 'ready';

/**
 * ==========================================
 * STORE DELEGADORA (F-021)
 * ==========================================
 * A store era criada no load do módulo, ANTES de o Redis ficar 'ready' — e
 * nem sequer havia cliente, por isso o rate limit de login era efêmero por
 * processo (perdia-se ao reiniciar e não partilhava entre instâncias).
 *
 * Agora: memória enquanto o Redis não está disponível (uma indisponibilidade
 * nunca derruba os pedidos de auth) e RedisStore assim que estiver
 * (`rl:auth:*` passa a existir na BD, sobrevive a restarts e é limpo com
 * `redis-cli del rl:auth:*`).
 */
class StoreDelegadora {
  constructor(prefixo) {
    this.prefixo = prefixo;
    this.local = new MemoryStore();
    this.redis = null;
  }

  alvo() {
    if (isRedisAvailable()) {
      if (!this.redis) {
        this.redis = new RedisStore({
          prefix: this.prefixo,
          // rate-limit-redis faz sendCommand(...command); ioredis: client.call(...)
          sendCommand: (...args) => redisClient.call(...args),
        });
        // O ERL chama store.init(options) UMA vez, no load do módulo — quando
        // ainda não há Redis. Guardamos os options (windowMs etc.) e cá aplicamo-
        // los quando o RedisStore nasce lazy, senão `this.windowMs` fica undefined
        // e o script Lua rebenta (F-021).
        if (this._initArgs && typeof this.redis.init === 'function') {
          this.redis.init(...this._initArgs);
        }
      }
      return this.redis;
    }
    return this.local;
  }

  // Uma falha do Redis nunca pode derrabar um pedido de auth: cai para a
  // memória local nesse pedido (se o próprio alvo for a memória, propaga).
  async _fwd(metodo, ...args) {
    const alvo = this.alvo();
    try {
      return await alvo[metodo](...args);
    } catch (err) {
      if (alvo !== this.local) {
        console.warn(`[RATE LIMIT] Redis falhou em ${metodo} — memória local:`, err.message);
        return this.local[metodo](...args);
      }
      throw err;
    }
  }

  async init(...args) {
    this._initArgs = args; // repassados ao RedisStore quando este for criado
    const a = this.alvo();
    if (typeof a.init === 'function') return a.init(...args);
  }
  async get(key) { return this._fwd('get', key); }
  async set(key, value, ttlMs) { return this._fwd('set', key, value, ttlMs); }
  async increment(key) { return this._fwd('increment', key); }
  async decrement(key) { return this._fwd('decrement', key); }
  async resetKey(key) { return this._fwd('resetKey', key); }
  async shutdown() {
    const a = this.alvo();
    if (typeof a.shutdown === 'function') return a.shutdown();
  }
}

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
  store: new StoreDelegadora('rl:auth:'),
});

module.exports = {
  limiteAuth,
  redisClient,
  isRedisAvailable
};
