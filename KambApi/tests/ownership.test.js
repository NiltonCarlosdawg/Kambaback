// tests/ownership.test.js — F-022
// Autorização cruzada: um utilizador nunca lê, altera ou apaga recursos de
// outro. Cada rota é verificada por listagem (não aparecem) e por tentativa
// direta (404 + estado da vítima intacto).
const { app, request, registar, limparUtilizadores, resetarLimiteAuth } = require('./helpers');

describe('Ownership (autorização cruzada)', () => {
  let a; // atacante
  let b; // vítima
  let cartaoB;
  let categoriaB;
  let gastoB;
  let objetivoB;

  const authA = () => ({ Authorization: `Bearer ${a.token}` });
  const authB = () => ({ Authorization: `Bearer ${b.token}` });

  beforeAll(async () => {
    a = await registar('owna');
    b = await registar('ownb');

    const cartaoRes = await request(app)
      .post('/api/cartoes')
      .set(authB())
      .send({ nome: 'Cartao B', tipo: 'DEBITO', saldoAtual: 50000 });
    if (cartaoRes.status !== 201 || !cartaoRes.body.cartao?.id) {
      throw new Error(`Criação de cartão falhou: ${cartaoRes.status} ${JSON.stringify(cartaoRes.body)}`);
    }
    cartaoB = cartaoRes.body.cartao.id;

    const catRes = await request(app)
      .post('/api/categorias')
      .set(authB())
      .send({ nome: 'Cat Own B', tipo: 'ESSENCIAL' });
    if (catRes.status !== 201 || !catRes.body.categoria?.id) {
      throw new Error(`Criação de categoria falhou: ${catRes.status} ${JSON.stringify(catRes.body)}`);
    }
    categoriaB = catRes.body.categoria.id;

    const gastoRes = await request(app)
      .post('/api/gastos')
      .set(authB())
      .send({
        cartaoId: cartaoB,
        tipo: 'DESPESA',
        valor: 1000,
        descricao: 'Gasto privado de B',
        categoriaId: categoriaB,
        data: new Date().toISOString(),
      });
    if (gastoRes.status !== 201 || !gastoRes.body.data?.id) {
      throw new Error(`Criação de gasto falhou: ${gastoRes.status} ${JSON.stringify(gastoRes.body)}`);
    }
    gastoB = gastoRes.body.data.id;

    const objRes = await request(app)
      .post('/api/objetivos')
      .set(authB())
      .send({
        titulo: 'Meta privada de B',
        valorAlvo: 500000,
        dataPrevista: '2030-12-31',
        categoria: 'Geral',
        prioridade: 'MEDIA',
        icone: 'target',
        cor: '#10b981',
      });
    if (objRes.status !== 201 || !objRes.body.objetivo?.id) {
      throw new Error(`Criação de objetivo falhou: ${objRes.status} ${JSON.stringify(objRes.body)}`);
    }
    objetivoB = objRes.body.objetivo.id;
  });

  beforeEach(() => resetarLimiteAuth());

  afterAll(async () => {
    await limparUtilizadores(a.email, b.email);
  });

  it('rotas protegidas sem token devolvem 401', async () => {
    const res = await request(app).get('/api/gastos');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('A não lista gastos de B', async () => {
    const res = await request(app).get('/api/gastos').set(authA());
    expect(res.status).toBe(200);
    const ids = (res.body.gastos || []).map((g) => g.id);
    expect(ids).not.toContain(gastoB);
  });

  it('A não altera gasto de B (PATCH → 404 e descrição intacta)', async () => {
    const res = await request(app)
      .patch(`/api/gastos/${gastoB}`)
      .set(authA())
      .send({ descricao: 'HACKEADO' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Transação não encontrada');

    const listaB = await request(app).get('/api/gastos').set(authB());
    const gasto = (listaB.body.gastos || []).find((g) => g.id === gastoB);
    expect(gasto).toBeDefined();
    expect(gasto.descricao).toBe('Gasto privado de B');
  });

  it('A não apaga gasto de B (DELETE → 404 e gasto continua ativo)', async () => {
    const res = await request(app).delete(`/api/gastos/${gastoB}`).set(authA());
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Transação não encontrada');

    const listaB = await request(app).get('/api/gastos').set(authB());
    expect((listaB.body.gastos || []).map((g) => g.id)).toContain(gastoB);
  });

  it('A não lista cartões de B', async () => {
    const res = await request(app).get('/api/cartoes').set(authA());
    expect(res.status).toBe(200);
    expect((res.body.cartoes || []).map((c) => c.id)).not.toContain(cartaoB);
  });

  it('A não apaga cartão de B (DELETE → 404 e cartão continua ativo)', async () => {
    const res = await request(app).delete(`/api/cartoes/${cartaoB}`).set(authA());
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Cartão não encontrado');

    const listaB = await request(app).get('/api/cartoes').set(authB());
    expect((listaB.body.cartoes || []).map((c) => c.id)).toContain(cartaoB);
  });

  it('A não lista objetivos de B', async () => {
    const res = await request(app).get('/api/objetivos').set(authA());
    expect(res.status).toBe(200);
    expect((res.body.objetivos || []).map((o) => o.id)).not.toContain(objetivoB);
  });

  it('A não altera objetivo de B (PUT → 404 e título intacto)', async () => {
    const res = await request(app)
      .put(`/api/objetivos/${objetivoB}`)
      .set(authA())
      .send({ titulo: 'HACKEADO' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Objetivo não encontrado');

    const listaB = await request(app).get('/api/objetivos').set(authB());
    const obj = (listaB.body.objetivos || []).find((o) => o.id === objetivoB);
    expect(obj).toBeDefined();
    expect(obj.titulo).toBe('Meta privada de B');
  });

  it('A não apaga objetivo de B (DELETE → 404 e objetivo continua)', async () => {
    const res = await request(app).delete(`/api/objetivos/${objetivoB}`).set(authA());
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Objetivo não encontrado');

    const listaB = await request(app).get('/api/objetivos').set(authB());
    expect((listaB.body.objetivos || []).map((o) => o.id)).toContain(objetivoB);
  });
});
