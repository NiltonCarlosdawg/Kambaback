// tests/setupEnv.js — F-022 (setupFiles do Jest)
// Corre antes de os testes importarem o `server`/`prisma`: aponta DATABASE_URL
// para a BD de teste dedicada. ABD real nunca é tocada por `npm test`.
// (O dotenv do server.js não sobrescreve variáveis já definidas — aqui ganhamos.)
require('dotenv').config();

const urlDeTeste = () => {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('[TESTE] DATABASE_URL não definido no .env');
  const u = new URL(base);
  u.pathname = '/kambapro_test';
  return u.toString();
};

process.env.DATABASE_URL = urlDeTeste();

// Rate limit hermético: em teste o Redis não é usado (ver src/utils/redisUrl.js)
// e cada ficheiro de teste tem o seu contador em memória.
