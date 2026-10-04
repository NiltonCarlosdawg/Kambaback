// tests/f033.test.js — F-033
// Dados sensíveis em segurança:
//  - refreshToken nunca em texto claro na BD (guardado como sha256 hex);
//  - número do cartão cifrado na BD (AES-256-GCM) — a API só devolve mascarado;
//  - números duplicados (mesmo com espaços) → 409;
//  - GET /api/cartoes nunca expõe o número completo.
const crypto = require('crypto');
const { app, request, registar, limparUtilizadores, resetarLimiteAuth, prisma } = require('./helpers');

describe('F-033: dados sensíveis em segurança', () => {
  let user;
  const auth = () => ({ Authorization: `Bearer ${user.token}` });

  beforeEach(() => resetarLimiteAuth());
  beforeAll(async () => { user = await registar('f033'); });
  afterAll(async () => { await limparUtilizadores(user.email); });

  it('refreshToken guardado na BD é sha256 (hex) e não o JWT', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: user.email, senha: 'Senha123!' });
    expect(login.status).toBe(200);
    const refreshTokenPlain = login.body.refreshToken;
    expect(refreshTokenPlain).toMatch(/\./); // JWT tem pontos

    const naBD = await prisma.user.findUnique({ where: { email: user.email } });
    expect(naBD.refreshToken).toHaveLength(64);
    expect(naBD.refreshToken).not.toBe(refreshTokenPlain);
    expect(naBD.refreshToken).toBe(
      crypto.createHash('sha256').update(refreshTokenPlain).digest('hex'),
    );
  });

  it('POST /api/cartoes devolve número mascarado e segundo igual → 409', async () => {
    const primeiro = await request(app)
      .post('/api/cartoes').set(auth())
      .send({ nome: 'Cartão F033', tipo: 'DEBITO', saldoAtual: 1000, numero: '4111111111111111' });
    expect(primeiro.status).toBe(201);
    expect(primeiro.body.cartao.numero).not.toBe('4111111111111111');
    expect(primeiro.body.cartao.numero).toMatch(/^\*+/); // mascarado

    const duplicado = await request(app)
      .post('/api/cartoes').set(auth())
      .send({ nome: 'Cartão F033-dup', tipo: 'DEBITO', saldoAtual: 0, numero: ' 4111111111111111 ' });
    expect(duplicado.status).toBe(409);
  });

  it('GET /api/cartoes nunca devolve o número completo', async () => {
    const lista = await request(app).get('/api/cartoes').set(auth());
    const json = JSON.stringify(lista.body);
    expect(json).not.toContain('4111111111111111');
    expect(json).toContain('*'); // algo mascarado deve aparecer
  });
});
