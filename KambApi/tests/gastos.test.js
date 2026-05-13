const request = require('supertest');
const { app } = require('../server');

describe('Gastos API', () => {
  let token;
  let cartaoId;
  let categoriaId;

  beforeAll(async () => {
    // Regista e faz login para obter token
    const email = `gastos${Date.now()}@example.com`;
    const senha = 'Senha123!';
    await request(app).post('/api/auth/register').send({
      nome: 'Gastos Test', email, telefone: '923456784',
      senha, dataNascimento: '1990-01-01',
      sexo: 'Masculino', morada: 'Luanda'
    });
    const login = await request(app).post('/api/auth/login').send({ email, senha });
    token = login.body.accessToken;

    // Cria cartão e categoria para os testes
    const cartaoRes = await request(app)
      .post('/api/cartoes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Conta Teste', tipo: 'DEBITO', saldoAtual: 100000 });
    cartaoId = cartaoRes.body.cartao?.id;

    const catRes = await request(app)
      .post('/api/categorias')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Teste Cat', tipo: 'ESSENCIAL' });
    categoriaId = catRes.body.categoria?.id;
  });

  describe('POST /api/gastos', () => {
    it('deve criar uma nova despesa', async () => {
      const res = await request(app)
        .post('/api/gastos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cartaoId,
          tipo: 'DESPESA',
          valor: 5000,
          descricao: 'Compra teste',
          categoriaId,
          data: new Date().toISOString()
        });

      expect([201, 200]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('deve rejeitar valor negativo', async () => {
      const res = await request(app)
        .post('/api/gastos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cartaoId,
          tipo: 'DESPESA',
          valor: -100,
          descricao: 'Erro',
          categoriaId
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/gastos', () => {
    it('deve listar transações', async () => {
      const res = await request(app)
        .get('/api/gastos')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.gastos)).toBe(true);
    });
  });
});
