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
      // Pagamento de dívida
      saldoAtual = Math.max(0, saldoAtual - valorNum);
      saldoDisponivel = Math.min(limite, saldoDisponivel + valorNum);
    } else {
      saldoAtual += valorNum;
      saldoDisponivel += valorNum;
    }
    if (valorDistribuido > 0) {
      saldoReservado += valorDistribuido;
      saldoDisponivel -= valorDistribuido;
    }
  }

  return {
    saldoAtual,
    saldoDisponivel,
    saldoReservado,
  };
};

module.exports = { calcularNovosSaldos };
