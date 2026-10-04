// src/modules/cartoes/services/saldoCartaoService.js
//
// REGRA ÚNICA DE MOVIMENTAÇÃO DE SALDOS DE CARTÃO (F-005)
// Usado por gastosController.criarGasto e cartoesController.atualizarSaldo
// para a semântica de saldoAtual deixar de divergir entre endpoints.
//
// Invariantes:
// - DEBITO/POUPANCA: saldoAtual = dinheiro real do cartão.
//     DESPESA diminui, RECEITA aumenta; saldoDisponivel = saldoAtual - saldoReservado.
// - CREDITO: saldoAtual = DÍVIDA (0 = sem dívida, nunca negativa).
//     DESPESA aumenta a dívida e esgota o limite disponível;
//     RECEITA é PAGAMENTO: diminui a dívida (até 0) e devolve o limite
//     (nunca acima de limiteCredito — um pagamento a mais não cria limite extra).
// - saldoDisponivel nunca fica negativo: ambas as pontas validam antes de escrever.

const AppError = require('../../../middleware/AppError');

const calcularNovosSaldos = (cartao, tipo, valorNum, valorDistribuido = 0) => {
  const ehCredito = cartao.tipo === 'CREDITO';
  const limite = Number(cartao.limiteCredito || 0);
  let saldoAtual = Number(cartao.saldoAtual);
  let saldoDisponivel = Number(cartao.saldoDisponivel);
  let saldoReservado = Number(cartao.saldoReservado);

  if (tipo === 'DESPESA') {
    if (saldoDisponivel < valorNum) {
      throw new AppError(
        ehCredito
          ? `Limite de crédito insuficiente no cartão ${cartao.nome}. ` +
            `Disponível: ${saldoDisponivel.toFixed(2)} Kz`
          : `Saldo disponível insuficiente no cartão ${cartao.nome}. ` +
            `Disponível: ${saldoDisponivel.toFixed(2)} Kz`,
        400,
      );
    }
    saldoAtual = ehCredito ? saldoAtual + valorNum : saldoAtual - valorNum;
    saldoDisponivel -= valorNum;
  } else {
    // RECEITA
    if (ehCredito) {
      // F-030: pagamento acima da dívida é erro — o `Math.max(0, ...)`
      // antigo absorvia o excedente a inflar o limite disponível (quebrava
      // a invariante quando existia saldoReservado > 0).
      if (valorNum > saldoAtual) {
        throw new AppError(
          `Pagamento (${valorNum.toFixed(2)} Kz) superior à dívida pendente ` +
            `(${saldoAtual.toFixed(2)} Kz) do cartão ${cartao.nome}`,
          400,
        );
      }
      saldoAtual = Math.max(0, saldoAtual - valorNum);
    } else {
      saldoAtual += valorNum;
      saldoDisponivel += valorNum;
    }
    if (valorDistribuido > 0) {
      saldoReservado += valorDistribuido;
      if (!ehCredito) saldoDisponivel -= valorDistribuido;
    }
    if (ehCredito) {
      // F-030: recompõe o disponível pela invariante do CREDITO
      // (dívida + disponível + reservado = limite), nunca acima do limite.
      saldoDisponivel = Math.max(0, limite - saldoAtual - saldoReservado);
    }
  }

  return {
    saldoAtual,
    saldoDisponivel,
    saldoReservado,
  };
};

module.exports = { calcularNovosSaldos };
