const Redis = require("ioredis");

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379");
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

let redis = null;
let disponivel = false;

const inicializar = async () => {
  if (redis) return redis;

  try {
    redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    await redis.connect();
    await redis.ping();
    disponivel = true;
    return redis;
  } catch (err) {
    console.warn(
      "[REDIS] Não disponível, usando fallback em memória:",
      err.message,
    );
    disponivel = false;
    redis = null;
    return null;
  }
};

const getRedis = () => redis;
const isDisponivel = () => disponivel;

const get = async (chave) => {
  if (!disponivel) return null;
  try {
    const valor = await redis.get(chave);
    return valor ? JSON.parse(valor) : null;
  } catch {
    return null;
  }
};

const set = async (chave, valor, ttlSegundos = null) => {
  if (!disponivel) return false;
  try {
    const stringValor = JSON.stringify(valor);
    if (ttlSegundos) {
      await redis.setex(chave, ttlSegundos, stringValor);
    } else {
      await redis.set(chave, stringValor);
    }
    return true;
  } catch {
    return false;
  }
};

const del = async (chave) => {
  if (!disponivel) return false;
  try {
    await redis.del(chave);
    return true;
  } catch {
    return false;
  }
};

const keys = async (padrao) => {
  if (!disponivel) return [];
  try {
    return await redis.keys(padrao);
  } catch {
    return [];
  }
};

const incr = async (chave) => {
  if (!disponivel) return -1;
  try {
    return await redis.incr(chave);
  } catch {
    return -1;
  }
};

const expire = async (chave, segundos) => {
  if (!disponivel) return false;
  try {
    await redis.expire(chave, segundos);
    return true;
  } catch {
    return false;
  }
};

const ttl = async (chave) => {
  if (!disponivel) return -1;
  try {
    return await redis.ttl(chave);
  } catch {
    return -1;
  }
};

const hset = async (chave, campo, valor) => {
  if (!disponivel) return false;
  try {
    await redis.hset(chave, campo, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
};

const hget = async (chave, campo) => {
  if (!disponivel) return null;
  try {
    const valor = await redis.hget(chave, campo);
    return valor ? JSON.parse(valor) : null;
  } catch {
    return null;
  }
};

const hgetall = async (chave) => {
  if (!disponivel) return {};
  try {
    const dados = await redis.hgetall(chave);
    const parsed = {};
    for (const [campo, valor] of Object.entries(dados)) {
      try {
        parsed[campo] = JSON.parse(valor);
      } catch {
        parsed[campo] = valor;
      }
    }
    return parsed;
  } catch {
    return {};
  }
};

const hdel = async (chave, campo) => {
  if (!disponivel) return false;
  try {
    await redis.hdel(chave, campo);
    return true;
  } catch {
    return false;
  }
};

const setLock = async (chave, ttlSegundos = 5) => {
  if (!disponivel) return false;
  try {
    const result = await redis.set(chave, "1", "NX", "EX", ttlSegundos);
    return result === "OK";
  } catch {
    return false;
  }
};

const releaseLock = async (chave) => {
  return del(chave);
};

module.exports = {
  inicializar,
  getRedis,
  isDisponivel,
  get,
  set,
  del,
  keys,
  incr,
  expire,
  ttl,
  hset,
  hget,
  hgetall,
  hdel,
  setLock,
  releaseLock,
};
