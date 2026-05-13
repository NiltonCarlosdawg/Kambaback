const request = require('supertest');
const { app } = require('../server');

describe('Auth API', () => {
  let accessToken;
  let refreshToken;

  describe('POST /api/auth/register', () => {
    it('deve registar um novo utilizador', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          nome: 'Teste User',
          email: `teste${Date.now()}@example.com`,
          telefone: '923456789',
          senha: 'Senha123!',
          dataNascimento: '1990-01-01',
          sexo: 'Masculino',
          morada: 'Luanda'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('deve rejeitar email duplicado', async () => {
      const email = `dup${Date.now()}@example.com`;
      await request(app).post('/api/auth/register').send({
        nome: 'Teste', email, telefone: '923456788',
        senha: 'Senha123!', dataNascimento: '1990-01-01',
        sexo: 'Masculino', morada: 'Luanda'
      });

      const res = await request(app).post('/api/auth/register').send({
        nome: 'Teste2', email, telefone: '923456787',
        senha: 'Senha123!', dataNascimento: '1990-01-01',
        sexo: 'Masculino', morada: 'Luanda'
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('deve fazer login com credenciais válidas', async () => {
      const email = `login${Date.now()}@example.com`;
      const senha = 'Senha123!';
      await request(app).post('/api/auth/register').send({
        nome: 'Login Test', email, telefone: '923456786',
        senha, dataNascimento: '1990-01-01',
        sexo: 'Masculino', morada: 'Luanda'
      });

      const res = await request(app).post('/api/auth/login').send({ email, senha });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
    });

    it('deve rejeitar credenciais inválidas', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'naoexiste@example.com',
        senha: 'senhaerrada'
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('deve gerar novo access token', async () => {
      const email = `refresh${Date.now()}@example.com`;
      const senha = 'Senha123!';
      const reg = await request(app).post('/api/auth/register').send({
        nome: 'Refresh Test', email, telefone: '923456785',
        senha, dataNascimento: '1990-01-01',
        sexo: 'Masculino', morada: 'Luanda'
      });

      const res = await request(app).post('/api/auth/refresh').send({
        refreshToken: reg.body.refreshToken
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
    });

    it('deve rejeitar refresh token inválido', async () => {
      const res = await request(app).post('/api/auth/refresh').send({
        refreshToken: 'token-invalido'
      });
      expect(res.status).toBe(401);
    });
  });
});
