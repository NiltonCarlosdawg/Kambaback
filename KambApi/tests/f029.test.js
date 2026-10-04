// tests/f029.test.js — F-029
// Corrida TOCTOU (double-spend): o débito passa a ser CONDICIONADO dentro da
// transação (updateMany com `gte` + decrement atómico) — a verificação de saldo
// prévia é só um atalho para a mensagem amigável. Dois pedidos concorrentes
// nunca passam ambos; em falha, o throw faz rollback (sem efeitos parciais).
const {
  app,
  request,
  registar,
  limparUtilizadores,
  resetarLimiteAuth,
  prisma,
} = require('./helpers');
const Wizard = require('../src/modules/kamba/controllers/kambaWizardController');

describe('F-029: débito atómico (sem TOCTOU)', () => {
  beforeEach(() => resetarLimiteAuth());

  describe('wizard de gasto (kambaWizardController.concluir)', () => {
    let user;
    let cartaoId;

    const auth = () => ({ Authorization: `Bearer ${user.token}` });

    const buscarCartao = async () => {
      const res = await request(app).get('/api/cartoes').set(auth());
      expect(res.status).toBe(200);
      const cartao = (res.body.cartoes || []).find((c) => c.id === cartaoId);
      expect(cartao).toBeDefined();
      return cartao;
    };

    /** Percorre o fluxo registar_gasto até à conclusão. */
    const correrWizard = async (valor, descricao) => {
      await Wizard.iniciarFluxo(user.id, 'registar_gasto');
      let r = await Wizard.processarRespostaFluxo(user.id, valor);
      expect(r.continuar).toBe(true); // pergunta da categoria
      r = await Wizard.processarRespostaFluxo(user.id, '4'); // Lazer (sem recorrente)
      expect(r.continuar).toBe(true); // pergunta da moeda
      r = await Wizard.processarRespostaFluxo(user.id, '1'); // AOA
      expect(r.continuar).toBe(true); // pergunta da descrição
      return Wizard.processarRespostaFluxo(user.id, descricao);
    };

    beforeAll(async () => {
      user = await registar('f029w');

      const res = await request(app)
        .post('/api/cartoes')
        .set(auth())
        .send({ nome: 'Conta Wizard F029', tipo: 'DEBITO', saldoAtual: 10000 });
      if (res.status !== 201 || !res.body.cartao?.id) {
        throw new Error(`Criação de cartão falhou: ${res.status} ${JSON.stringify(res.body)}`);
      }
      cartaoId = res.body.cartao.id;
    });

    afterAll(async () => {
      await limparUtilizadores(user.email);
    });

    it('conclui o gasto e debita saldoAtual e saldoDisponivel exatamente', async () => {
      const fim = await correrWizard('5000', 'Gasto de teste F-029');
      expect(fim.continuar).toBe(false);
      expect(fim.mensagem).toMatch(/Gasto registado/);

      const cartao = await buscarCartao();
      expect(Number(cartao.saldoAtual)).toBe(5000);
      expect(Number(cartao.saldoDisponivel)).toBe(5000);
      expect(Number(cartao.saldoReservado)).toBe(0);

      const lista = await request(app).get('/api/gastos').set(auth());
      const gasto = (lista.body.gastos || []).find(
        (g) => g.descricao === 'Gasto de teste F-029',
      );
      expect(gasto).toBeDefined();
      expect(gasto.tipo).toBe('DESPESA');
      expect(Number(gasto.valor)).toBe(5000);
    });

    it('saldo não chega → mensagem amigável e NADA muda (sem efeitos parciais)', async () => {
      // saldo actual 5000 (teste anterior) — gasto de 6000 é recusado
      const fim = await correrWizard('6000', 'Gasto acima do saldo');
      expect(fim.mensagem).toMatch(/Saldo insuficiente/);

      const cartao = await buscarCartao();
      expect(Number(cartao.saldoAtual)).toBe(5000);
      expect(Number(cartao.saldoDisponivel)).toBe(5000);

      const lista = await request(app).get('/api/gastos').set(auth());
      expect(
        (lista.body.gastos || []).filter((g) => g.descricao === 'Gasto acima do saldo'),
      ).toHaveLength(0);
    });
  });

  describe('distribuir-poupanca concorrente (objetivosController)', () => {
    let user;
    let cartaoId;
    let objetivoId;

    const auth = () => ({ Authorization: `Bearer ${user.token}` });

    beforeAll(async () => {
      user = await registar('f029d');

      const cardRes = await request(app)
        .post('/api/cartoes')
        .set(auth())
        .send({
          nome: 'Conta Dist F029',
          tipo: 'DEBITO',
          saldoAtual: 100000,
          distribuirParaObjetivos: true,
          percentualDistribuicaoPoupanca: 100,
        });
      if (cardRes.status !== 201 || !cardRes.body.cartao?.id) {
        throw new Error(`Cartão falhou: ${cardRes.status} ${JSON.stringify(cardRes.body)}`);
      }
      cartaoId = cardRes.body.cartao.id;

      const objRes = await request(app)
        .post('/api/objetivos')
        .set(auth())
        .send({
          titulo: 'Meta F-029',
          valorAlvo: 500000,
          dataPrevista: '2027-06-30',
          porcentagemDistribuicao: 100,
        });
      if (objRes.status !== 201) {
        throw new Error(`Objetivo falhou: ${objRes.status} ${JSON.stringify(objRes.body)}`);
      }
      objetivoId = objRes.body.objetivo?.id;
    });

    afterAll(async () => {
      await limparUtilizadores(user.email);
    });

    it('duas distribuições de 60000 concorrentes → exactamente uma passa', async () => {
      const enviar = () =>
        request(app)
          .post('/api/objetivos/distribuir-poupanca')
          .set(auth())
          .send({ valorTotal: 60000, cartaoId });

      const [r1, r2] = await Promise.all([enviar(), enviar()]);
      const statuses = [r1.status, r2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 400]);

      const falha = r1.status === 400 ? r1 : r2;
      expect(falha.body.error?.message || falha.body.mensagem).toMatch(
        /insuficiente/i,
      );

      // Estado final: uma única distribuição (60000) — nunca duas
      const cartaoRes = await request(app).get('/api/cartoes').set(auth());
      const cartao = (cartaoRes.body.cartoes || []).find((c) => c.id === cartaoId);
      expect(Number(cartao.saldoAtual)).toBe(100000);
      expect(Number(cartao.saldoReservado)).toBe(60000);
      expect(Number(cartao.saldoDisponivel)).toBe(40000);
      // invariante: saldoAtual - saldoReservado == saldoDisponivel
      expect(Number(cartao.saldoAtual) - Number(cartao.saldoReservado)).toBe(
        Number(cartao.saldoDisponivel),
      );

      const objetivo = await prisma.objetivo.findUnique({ where: { id: objetivoId } });
      expect(Number(objetivo.valorAtual)).toBe(60000); // incrementado UMA vez
    });
  });
});
