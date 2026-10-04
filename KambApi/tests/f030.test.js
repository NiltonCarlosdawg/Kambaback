// tests/f030.test.js — F-030
// Pagamento de cartão CREDITO:
//  - pagamento acima da dívida pendiente → AppError 400 (antes: excedente
//    absorvido pelo Math.max(0, ...) a inflar o "limite disponível");
//  - após qualquer pagamento, `saldoDisponivel` é recomposto pela invariante
//    `dívida + disponível + reservado = limiteCredito` (antes, um pagamento
//    a mais + saldoReservado > 0 quebrava a invariante).
const { app, request, registar, limparUtilizadores, resetarLimiteAuth, prisma } = require('./helpers');

describe('F-030: pagamento CREDITO sem inflar o limite', () => {
  let user;
  let cartaoId;
  let categoriaId;

  const auth = () => ({ Authorization: `Bearer ${user.token}` });

  const buscarCartao = async () => {
    const res = await request(app).get('/api/cartoes').set(auth());
    expect(res.status).toBe(200);
    return (res.body.cartoes || []).find((c) => c.id === cartaoId);
  };

  const despesa = (valor) =>
    request(app)
      .post('/api/gastos')
      .set(auth())
      .send({ cartaoId, tipo: 'DESPESA', valor, descricao: 'Compra F030', categoriaId, data: new Date().toISOString() });

  const receita = (valor) =>
    request(app)
      .post('/api/gastos')
      .set(auth())
      .send({ cartaoId, tipo: 'RECEITA', valor, descricao: 'Pagamento F030', categoriaId, data: new Date().toISOString() });

  const conferirInvarianteCredito = (cartao) => {
    // CREDITO: saldoAtual = dívida, logo dívida + disponível + reservado = limite
    expect(Number(cartao.saldoAtual) + Number(cartao.saldoDisponivel) + Number(cartao.saldoReservado)).toBe(
      Number(cartao.limiteCredito),
    );
  };

  beforeEach(() => resetarLimiteAuth());

  beforeAll(async () => {
    user = await registar('f030');

    const cardRes = await request(app)
      .post('/api/cartoes')
      .set(auth())
      .send({ nome: 'Cartão F030', tipo: 'CREDITO', limiteCredito: 50000, diaFechamento: 5, diaVencimento: 15 });
    if (cardRes.status !== 201) throw new Error(JSON.stringify(cardRes.body));
    cartaoId = cardRes.body.cartao.id;

    const catRes = await request(app)
      .post('/api/categorias')
      .set(auth())
      .send({ nome: 'Cat F030', tipo: 'ESSENCIAL' });
    if (catRes.status !== 201) throw new Error(JSON.stringify(catRes.body));
    categoriaId = catRes.body.categoria.id;
  });

  afterAll(async () => {
    await limparUtilizadores(user.email);
  });

  it('estado inicial: sem dívida, disponível = limite, reservado 0', async () => {
    const c = await buscarCartao();
    expect(Number(c.saldoAtual)).toBe(0);
    expect(Number(c.saldoDisponivel)).toBe(50000);
    expect(Number(c.saldoReservado)).toBe(0);
    conferirInvarianteCredito(c);
  });

  it('DESPESA 20000 → dívida 20000, disponível 30000', async () => {
    const res = await despesa(20000);
    expect(res.status).toBe(201);

    const c = await buscarCartao();
    expect(Number(c.saldoAtual)).toBe(20000);
    expect(Number(c.saldoDisponivel)).toBe(30000);
    conferirInvarianteCredito(c);
  });

  it('pagamento parcial 5000 → dívida 15000, disponível 35000', async () => {
    const res = await receita(5000);
    expect(res.status).toBe(201);

    const c = await buscarCartao();
    expect(Number(c.saldoAtual)).toBe(15000);
    expect(Number(c.saldoDisponivel)).toBe(35000);
    conferirInvarianteCredito(c);
  });

  it('pagamento acima da dívida → 400 e saldos intactos', async () => {
    const res = await receita(999999);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/superior à dívida/i);

    const c = await buscarCartao();
    expect(Number(c.saldoAtual)).toBe(15000);
    expect(Number(c.saldoDisponivel)).toBe(35000);
    conferirInvarianteCredito(c);
  });

  it('pagamento exacto da dívida → dívida 0, disponível volta ao limite', async () => {
    const res = await receita(15000);
    expect(res.status).toBe(201);

    const c = await buscarCartao();
    expect(Number(c.saldoAtual)).toBe(0);
    expect(Number(c.saldoDisponivel)).toBe(50000);
    conferirInvarianteCredito(c);
  });

  it('invariante mantida com saldoReservado > 0 e pagamento exacto', async () => {
    // arranca estado consistente via BD: limite 50000, dívida 20000, reservado 10000 → disponível 20000
    await prisma.cartao.update({
      where: { id: cartaoId },
      data: { saldoAtual: 20000, saldoReservado: 10000, saldoDisponivel: 20000 },
    });

    // pagamento a mais seria 400:
    const over = await receita(25000);
    expect(over.status).toBe(400);

    // pagamento exacto:
    const res = await receita(20000);
    expect(res.status).toBe(201);

    const c = await buscarCartao();
    expect(Number(c.saldoAtual)).toBe(0);
    expect(Number(c.saldoReservado)).toBe(10000);
    expect(Number(c.saldoDisponivel)).toBe(40000); // limite - 0 - reservado
    conferirInvarianteCredito(c);
  });
});
