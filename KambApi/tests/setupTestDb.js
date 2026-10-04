// tests/setupTestDb.js — F-022
// Garante que a BD de teste existe e tem o schema, ANTES de correr o Jest
// (`npm test` chama isto via `npm run test:db`). Idempotente:
//   1) cria "kambapro_test" se não existir (conectando ao "postgres" de origem);
//   2) sincroniza o schema via `prisma db push`;
//   3) apaga TODOS os utilizadores da BD de teste — estado de partida
//      determinístico entre runs (a BD de teste é 100% descartável; a BD real
//      nunca é tocada, ver tests/setupEnv.js).
//
// NOTA (evidência do F-009): usa-se `db push` e NÃO `migrate deploy` porque o
// histórico de migrations não reproduz a partir de BD nova — a migration F-020
// (20261004032341, DROP INDEX "PasswordResetToken_otp_idx") ordena-se ANTES da
// F-003 (20261004120000) que é quem cria a tabela PasswordResetToken; numa BD
// limpa o DROP falha (42704) e quebra a cadeia inteira. A BD de teste não
// precisa de histórico, apenas do schema final. Corrigir a ordem/squash = F-009
// (decisão do utilizador).
require('dotenv').config();
const { Client } = require('pg');
const { execFileSync } = require('child_process');
const path = require('path');

const NOME_BD = 'kambapro_test';

const urlDeTeste = () => {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) {
    console.error('[TESTE] DATABASE_URL não definido no .env');
    process.exit(1);
  }
  const u = new URL(base);
  u.pathname = `/${NOME_BD}`;
  return u.toString();
};

const testarLigacao = async (connectionString) => {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  await client.end();
};

(async () => {
  const url = urlDeTeste();

  // 1. Criar a BD se ainda não existir
  let existe = true;
  try {
    await testarLigacao(url);
    console.log(`[TESTE] BD ${NOME_BD} já existe`);
  } catch {
    existe = false;
  }

  if (!existe) {
    const origem = new URL(url);
    origem.pathname = '/postgres'; // BD padrão do servidor para poder criar
    console.log(`[TESTE] A criar BD ${NOME_BD}...`);
    try {
      const client = new Client({
        connectionString: origem.toString(),
        connectionTimeoutMillis: 5000,
      });
      await client.connect();
      await client.query(`CREATE DATABASE "${NOME_BD}"`);
      await client.end();
      console.log(`[TESTE] BD ${NOME_BD} criada`);
    } catch (err) {
      console.error(`[TESTE] Falha ao criar ${NOME_BD}:`, err.message);
      process.exit(1);
    }
  }

  // 2. Schema sincronizado com o schema.prisma (idempotente)
  try {
    execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
    });
    console.log('[TESTE] Schema da BD de teste OK (db push)');
  } catch (err) {
    console.error('[TESTE] Falha no db push:', err.message);
    process.exit(1);
  }

  // 3. Estado de partida limpo: tudo na BD de teste é descartável
  try {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
    await client.connect();
    await client.query('TRUNCATE TABLE "User" CASCADE');
    await client.end();
    console.log('[TESTE] BD de teste limpa (User truncado)');
  } catch (err) {
    console.error('[TESTE] Falha ao limpar:', err.message);
    process.exit(1);
  }
})();
