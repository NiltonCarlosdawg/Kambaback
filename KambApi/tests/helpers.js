// tests/helpers.js — F-022
// Utilitários comuns a todos os ficheiros de teste.
// Correm SEMPRE contra a BD de teste (tests/setupEnv.js mapeia DATABASE_URL).
const request = require('supertest');
const { app } = require('../server');
const { limiteAuth } = require('../src/middleware/rateLimiter');
const prisma = require('../src/lib/prisma');

/**
 * O `limiteAuth` é montado DUAS vezes (app.use('/api/auth', ...) + na rota),
 * logo cada pedido falhado em /api/auth consome 2 do orçamento de 5. Reinicia
 * o contador por IP antes de testes que esperam falhar, para nunca esgotar o
 * orçamento do processo (em teste o store é memória por ficheiro).
 */
const resetarLimiteAuth = () => {
  for (const ip of ['::ffff:127.0.0.1', '::1', '127.0.0.1']) {
    try {
      limiteAuth.resetKey(ip);
    } catch {
      /* ignora: chave inexistente */
    }
  }
};

const telefoneUnico = () =>
  `9${Math.floor(Math.random() * 9) + 1}${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;

/**
 * Regista um utilizador de teste e devolve { id, email, senha, token }.
 * Lança erro com o corpo da resposta se o registo não der 201 — um problema
 * de infraestrutura nunca deve parecer um teste a falhar em silêncio.
 */
const registar = async (prefixo) => {
  const email = `${prefixo}${Date.now()}${Math.floor(Math.random() * 10000)}@teste.kamba.dev`;
  const senha = 'Senha123!';
  const res = await request(app).post('/api/auth/register').send({
    nome: `User ${prefixo}`,
    email,
    telefone: telefoneUnico(),
    senha,
    dataNascimento: '1995-05-05',
    sexo: 'Masculino',
    morada: 'Luanda',
  });
  if (res.status !== 201) {
    throw new Error(`Registo falhou (${res.status}): ${JSON.stringify(res.body)}`);
  }
  const utilizador = await prisma.user.findUnique({ where: { email } });
  return { id: utilizador.id, email, senha, token: res.body.accessToken };
};

/** Apaga utilizadores de teste (cascates limpam cartões/gastos/etc.). */
const limparUtilizadores = async (...emails) => {
  await prisma.user.deleteMany({ where: { email: { in: emails.flat() } } });
};

module.exports = { app, request, prisma, registar, limparUtilizadores, resetarLimiteAuth };
