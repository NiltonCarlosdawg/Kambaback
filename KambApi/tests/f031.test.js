// tests/f031.test.js — F-031
// Fundo de emergência:
//  (a) categoria dos movimentos nunca é a primeira alfabética (era "Alimentação")
//  (b) levantamento não duplica entradas no histórico do fundo
//  (c) criação do fundo é atómica (2 POSTs concorrentes → 1 fundo, sempre)
const { app, request, registar, limparUtilizadores, resetarLimiteAuth, prisma } = require('./helpers');

describe('F-031: fundo de emergência', () => {
  let user;
  let origemId, destinoId;

  const auth = () => ({ Authorization: `Bearer ${user.token}` });

  beforeEach(() => resetarLimiteAuth());

  beforeAll(async () => {
    user = await registar('f031a');

    const o = await request(app)
      .post('/api/cartoes')
      .set(auth())
      .send({ nome: 'Origem F031', tipo: 'DEBITO', saldoAtual: 200000 });
    if (o.status !== 201) throw new Error(JSON.stringify(o.body));
    origemId = o.body.cartao.id;

    const d = await request(app)
      .post('/api/cartoes')
      .set(auth())
      .send({ nome: 'Destino F031', tipo: 'DEBITO', saldoAtual: 5000 });
    if (d.status !== 201) throw new Error(JSON.stringify(d.body));
    destinoId = d.body.cartao.id;
  });

  afterAll(async () => {
    await limparUtilizadores(user.email);
  });

  it('(c) dois POSTs concorrentes criam exactamente um fundo', async () => {
    const [r1, r2] = await Promise.all([
      request(app).post('/api/fundo-emergencia').set(auth()).send({}),
      request(app).post('/api/fundo-emergencia').set(auth()).send({}),
    ]);
    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const fundos = await prisma.cartao.count({
      where: { usuarioId: user.id, isFundoEmergencia: true, excluido: false },
    });
    expect(fundos).toBe(1);
  });

  it('(a) depósito fica categorizado como POUPANCA, nunca "Alimentação"', async () => {
    const dep = await request(app)
      .post('/api/fundo-emergencia/depositar')
      .set(auth())
      .send({ cartaoOrigemId: origemId, valor: 120000 });
    expect(dep.status).toBe(200);

    const gasto = await prisma.gasto.findFirst({
      where: { usuarioId: user.id, descricao: { contains: 'Depósito no Fundo' } },
      include: { categoria: true },
    });
    expect(gasto).toBeTruthy();
    expect(gasto.categoria.tipo).toBe('POUPANCA');
    expect(gasto.categoria.nome).toMatch(/Fundo|Poupança/i);
    expect(gasto.categoria.nome).not.toBe('Alimentação');
  });

  it('(b) historico mostra 1 DEPOSITO + 1 LEVANTAMENTO (entrada no destino excluída)', async () => {
    const lev = await request(app)
      .post('/api/fundo-emergencia/levantar')
      .set(auth())
      .send({ cartaoDestinoId: destinoId, valor: 30000 });
    expect(lev.status).toBe(200);

    const hist = await request(app)
      .get('/api/fundo-emergencia/historico')
      .set(auth());
    expect(hist.status).toBe(200);
    expect(hist.body.movimentos).toHaveLength(2);

    const tipos = hist.body.movimentos.map((m) => m.tipo).sort();
    expect(tipos).toEqual(['DEPOSITO', 'LEVANTAMENTO']);

    // Receipts distintos:
    //  - gasto de saida no FUNDO → tag base + 'fundo-emergencia-saida'
    const gastoFundo = await prisma.gasto.findFirst({
      where: {
        usuarioId: user.id,
        tipo: 'DESPESA',
        descricao: { contains: 'Levantamento' },
      },
    });
    expect(gastoFundo.tags).toContain('fundo-emergencia');
    expect(gastoFundo.tags).toContain('fundo-emergencia-saida');

    //  - receita na conta de destino → SEM tag base 'fundo-emergencia'
    const gastoDestino = await prisma.gasto.findFirst({
      where: { usuarioId: user.id, tipo: 'RECEITA', cartaoId: destinoId },
      orderBy: { criadoEm: 'desc' },
    });
    expect(gastoDestino).toBeTruthy();
    expect(gastoDestino.tags).not.toContain('fundo-emergencia');
    expect(gastoDestino.tags).toContain('fundo-emergencia-saida');
  });
});
