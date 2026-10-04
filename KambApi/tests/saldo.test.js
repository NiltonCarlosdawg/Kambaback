// tests/saldo.test.js — F-022
// Invariantes financeiras do cartão DEBITO (lógica onde estavam os bugs
// F-005/C-01): mudanças de saldo exatas, recusa por saldo insuficiente sem
// efeitos parciais, estorno exato no DELETE e a relação
// saldoAtual - saldoReservado == saldoDisponivel em cada passo.
const { app, request, registar, limparUtilizadores, resetarLimiteAuth } = require('./helpers');

describe('Invariantes de saldo (cartão DEBITO)', () => {
  let user;
  let cartaoId;
  let categoriaId;
  let gastoDespesaId;

  const auth = () => ({ Authorization: `Bearer ${user.token}` });

  const buscarCartao = async () => {
    const res = await request(app).get('/api/cartoes').set(auth());
    expect(res.status).toBe(200);
    const cartao = (res.body.cartoes || []).find((c) => c.id === cartaoId);
    expect(cartao).toBeDefined();
    return cartao;
  };

  /** Invariante fundamental do modelo de saldo. */
  const conferirInvariante = (cartao) => {
    expect(Number(cartao.saldoAtual) - Number(cartao.saldoReservado)).toBe(
      Number(cartao.saldoDisponivel),
    );
  };

  beforeAll(async () => {
    user = await registar('saldo');

    const cartaoRes = await request(app)
      .post('/api/cartoes')
      .set(auth())
      .send({ nome: 'Conta Saldo', tipo: 'DEBITO', saldoAtual: 100000 });
    if (cartaoRes.status !== 201 || !cartaoRes.body.cartao?.id) {
      throw new Error(`Criação de cartão falhou: ${cartaoRes.status} ${JSON.stringify(cartaoRes.body)}`);
    }
    cartaoId = cartaoRes.body.cartao.id;

    const catRes = await request(app)
      .post('/api/categorias')
      .set(auth())
      .send({ nome: 'Cat Saldo', tipo: 'ESSENCIAL' });
    if (catRes.status !== 201 || !catRes.body.categoria?.id) {
      throw new Error(`Criação de categoria falhou: ${catRes.status} ${JSON.stringify(catRes.body)}`);
    }
    categoriaId = catRes.body.categoria.id;
  });

  beforeEach(() => resetarLimiteAuth());

  afterAll(async () => {
    await limparUtilizadores(user.email);
  });

  it('estado inicial: saldoAtual = saldoDisponivel = 100000, reservado 0', async () => {
    const cartao = await buscarCartao();
    expect(Number(cartao.saldoAtual)).toBe(100000);
    expect(Number(cartao.saldoReservado)).toBe(0);
    expect(Number(cartao.saldoDisponivel)).toBe(100000);
    conferirInvariante(cartao);
  });

  it('DESPESA decresce o saldo exatamente pelo valor', async () => {
    const res = await request(app)
      .post('/api/gastos')
      .set(auth())
      .send({
        cartaoId,
        tipo: 'DESPESA',
        valor: 3000,
        descricao: 'Despesa de teste',
        categoriaId,
        data: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    gastoDespesaId = res.body.data.id;

    const cartao = await buscarCartao();
    expect(Number(cartao.saldoAtual)).toBe(97000);
    expect(Number(cartao.saldoReservado)).toBe(0);
    expect(Number(cartao.saldoDisponivel)).toBe(97000);
    conferirInvariante(cartao);
  });

  it('DESPESA acima do disponível → 400 e saldos permanecem intactos', async () => {
    const res = await request(app)
      .post('/api/gastos')
      .set(auth())
      .send({
        cartaoId,
        tipo: 'DESPESA',
        valor: 999999,
        descricao: 'Tentativa acima do saldo',
        categoriaId,
        data: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/insuficiente/i);

    const cartao = await buscarCartao();
    expect(Number(cartao.saldoAtual)).toBe(97000);
    expect(Number(cartao.saldoDisponivel)).toBe(97000);
    conferirInvariante(cartao);
  });

  it('RECEITA incrementa o saldo exatamente pelo valor', async () => {
    const res = await request(app)
      .post('/api/gastos')
      .set(auth())
      .send({
        cartaoId,
        tipo: 'RECEITA',
        valor: 5000,
        descricao: 'Receita de teste',
        categoriaId,
        data: new Date().toISOString(),
      });
    expect(res.status).toBe(201);

    const cartao = await buscarCartao();
    expect(Number(cartao.saldoAtual)).toBe(102000);
    expect(Number(cartao.saldoReservado)).toBe(0);
    expect(Number(cartao.saldoDisponivel)).toBe(102000);
    conferirInvariante(cartao);
  });

  it('DELETE reverte exatamente o valor da DESPESA (estorno)', async () => {
    const res = await request(app).delete(`/api/gastos/${gastoDespesaId}`).set(auth());
    expect(res.status).toBe(200);

    // 102000 + 3000 (estorno exato da despesa de 3000)
    const cartao = await buscarCartao();
    expect(Number(cartao.saldoAtual)).toBe(105000);
    expect(Number(cartao.saldoReservado)).toBe(0);
    expect(Number(cartao.saldoDisponivel)).toBe(105000);
    conferirInvariante(cartao);

    const lista = await request(app).get('/api/gastos').set(auth());
    const gasto = (lista.body.gastos || []).find((g) => g.id === gastoDespesaId);
    expect(gasto).toBeUndefined();
  });
});
