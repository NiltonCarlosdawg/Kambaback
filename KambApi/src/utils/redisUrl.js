// src/utils/redisUrl.js
//
// F-021: unifica a configuração Redis do projeto. Antes, `rateLimiter.js` e
// `cache.js` só liam `REDIS_URL` — mas o .env define `REDIS_HOST/PORT/PASSWORD`,
// logo o cliente nem sequer era criado (o store do limiteAuth ficava sempre em
// memória e o cache nunca usava Redis). Aceita os dois formatos: `REDIS_URL`
// (ex.: addon do Render) tem prioridade; caso contrário monta a URL a partir
// de REDIS_HOST/PORT/PASSWORD. Devolve `null` quando não há configuração.
//
// Nota: em hosts locais a password NÃO é anexada — o Redis de dev é sem
// password e o ioredis entra em loop de reconexão com "ERR AUTH ... called
// without any password configured". Se o Redis local tiver password, define
// `REDIS_URL` diretamente (escape hatch documentado).
const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '::1'];

const montarRedisUrl = () => {
  // Testes (jest) ficam herméticos: sem Redis, o rate limit usa memória por
  // processo e um run nunca herda contadores do anterior (F-021)
  if (process.env.NODE_ENV === 'test') return null;
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  if (!process.env.REDIS_HOST) return null;
  const local = HOSTS_LOCAIS.includes(process.env.REDIS_HOST);
  const senha = process.env.REDIS_PASSWORD && !local
    ? `:${encodeURIComponent(process.env.REDIS_PASSWORD)}@`
    : '';
  return `redis://${senha}${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
};

module.exports = { montarRedisUrl };
