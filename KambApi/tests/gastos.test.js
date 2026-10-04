const request = require('supertest');
const { app } = require('../server');

describe('Gastos API', () => {
  let token;
  let cartaoId;
  let categoriaId;
  let autoCartaoId;
  const objetivosAuto = {};
  const uniqueTelefone = () => `9${Math.floor(Math.random() * 9) + 1}${String(Date.now() % 10000000).padStart(7, '0')}`;

  beforeAll(async () => {
    // Regista e faz login para obter token
    const email = `gastos${Date.now()}@example.com`;
    const senha = 'Senha123!';
    await request(app).post('/api/auth/register').send({
      nome: 'Gastos Test', email, telefone: uniqueTelefone(),
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

      expect(res.status).toBe(201);
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

  describe('Distribuição automática de poupança', () => {
    beforeAll(async () => {
      const autoCartaoRes = await request(app)
        .post('/api/cartoes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nome: 'Cartão Auto',
          tipo: 'DEBITO',
          saldoAtual: 0,
          banco: 'Banco Teste',
          distribuirParaObjetivos: true,
          percentualDistribuicaoPoupanca: 10
        });

      autoCartaoId = autoCartaoRes.body.cartao?.id;

      const metas = [
        { chave: 'meta15', titulo: 'Meta 15', porcentagemDistribuicao: 15 },
        { chave: 'meta20', titulo: 'Meta 20', porcentagemDistribuicao: 20 },
        { chave: 'meta65', titulo: 'Meta 65', porcentagemDistribuicao: 65 }
      ];

      for (const meta of metas) {
        const objetivoRes = await request(app)
          .post('/api/objetivos')
          .set('Authorization', `Bearer ${token}`)
          .send({
            titulo: meta.titulo,
            valorAlvo: 1000000,
            dataPrevista: '2030-12-31',
            categoria: 'Geral',
            prioridade: 'MEDIA',
            icone: 'target',
            cor: '#10b981',
            porcentagemDistribuicao: meta.porcentagemDistribuicao
          });

        objetivosAuto[meta.chave] = objetivoRes.body.objetivo?.id;
      }
    });

    it('deve reservar 10% e dividir o pool pelos pesos dos objetivos', async () => {
      const res = await request(app)
        .post('/api/gastos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          cartaoId: autoCartaoId,
          tipo: 'RECEITA',
          valor: 100000,
          descricao: 'Receita com distribuição automática',
          categoriaId
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.distribuicaoAutomatica).toBe(true);

      const distribuicoes = res.body.data.distribuicoes || [];
      const porTitulo = Object.fromEntries(distribuicoes.map((item) => [item.titulo, Number(item.valor)]));

      expect(porTitulo['Meta 15']).toBe(1500);
      expect(porTitulo['Meta 20']).toBe(2000);
      expect(porTitulo['Meta 65']).toBe(6500);

      const objetivosRes = await request(app)
        .get('/api/objetivos')
        .set('Authorization', `Bearer ${token}`);

      expect(objetivosRes.status).toBe(200);

      const objetivos = objetivosRes.body.objetivos || [];
      const porId = Object.fromEntries(objetivos.map((obj) => [obj.id, Number(obj.valorAtual)]));

      expect(porId[objetivosAuto.meta15]).toBe(1500);
      expect(porId[objetivosAuto.meta20]).toBe(2000);
      expect(porId[objetivosAuto.meta65]).toBe(6500);

      const cartoesRes = await request(app)
        .get('/api/cartoes')
        .set('Authorization', `Bearer ${token}`);

      expect(cartoesRes.status).toBe(200);
      const cartaoAuto = (cartoesRes.body.cartoes || []).find((c) => c.id === autoCartaoId);

      expect(cartaoAuto).toBeDefined();
      expect(Number(cartaoAuto.saldoAtual)).toBe(100000);
      expect(Number(cartaoAuto.saldoReservado)).toBe(10000);
      expect(Number(cartaoAuto.saldoDisponivel)).toBe(90000);
    });
  });
});
