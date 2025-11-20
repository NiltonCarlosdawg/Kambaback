// src/controllers/insightsController.js
const Gasto = require('../models/Gasto');
const Cartao = require('../models/Cartao');
const Objetivo = require('../models/Objetivo');
const HistoricoPoupanca = require('../models/HistoricoPoupanca');
const { successResponse } = require('../utils/responseFormatter');

/**
 * ==========================================
 * DASHBOARD PRINCIPAL – RESUMO COMPLETO
 * ==========================================
 */
const resumoDashboard = async (req, res, next) => {
  try {
    const usuarioId = req.usuarioId;

    // 1. Saldos atuais
    const cartoes = await Cartao.find({ usuario: usuarioId, ativo: true });
    const saldoTotal = cartoes.reduce((acc, c) => acc + c.saldoAtual, 0);
    const disponivelTotal = cartoes.reduce((acc, c) => acc + c.disponivel, 0);

    // 2. Este mês
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const fimMes = new Date();
    fimMes.setMonth(fimMes.getMonth() + 1);
    fimMes.setDate(0);

    const movimentos = await Gasto.aggregate([
      {
        $match: {
          usuario: usuarioId,
          data: { $gte: inicioMes },
          excluido: false
        }
      },
      {
        $group: {
          _id: '$tipo',
          total: { $sum: '$valor' },
          quantidade: { $sum: 1 }
        }
      }
    ]);

    let receitas = 0, despesas = 0, qtdReceitas = 0, qtdDespesas = 0;
    movimentos.forEach(m => {
      if (m._id === 'receita') { receitas = m.total; qtdReceitas = m.quantidade; }
      if (m._id === 'despesa') { despesas = m.total; qtdDespesas = m.quantidade; }
    });

    const poupancaMes = receitas - despesas;

    // 3. Objetivos
    const objetivosResumo = await Objetivo.getDashboard(usuarioId);
    const objetivosAtivos = objetivosResumo.resumo.emAndamento;

    // 4. Alertas inteligentes
    const alertas = [];

    if (despesas > receitas * 0.9) {
      alertas.push({
        tipo: 'perigo',
        titulo: 'Cuidado, kamba!',
        mensagem: 'Estás gastando quase tudo que entra. Reduz aí!'
      });
    }

    if (poupancaMes > 0 && objetivosAtivos === 0) {
      alertas.push({
        tipo: 'sucesso',
        titulo: 'Poupança disponível!',
        mensagem: `Tens ${poupancaMes.toLocaleString('pt-AO')} AOA de sobra este mês. Cria um objetivo e investe no futuro!`
      });
    }

    if (saldoTotal < 50000) {
      alertas.push({
        tipo: 'aviso',
        titulo: 'Fundo de emergência baixo',
        mensagem: 'Tenta manter pelo menos 3 meses de despesas guardadas.'
      });
    }

    return successResponse(res, {
      mensagem: 'Dashboard carregado com sucesso',
      periodo: new Date().toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' }),
      saldo: {
        total: saldoTotal,
        disponivel: disponivelTotal,
        cartoes: cartoes.length
      },
      esteMes: {
        receitas,
        despesas,
        poupanca: poupancaMes,
        transacoes: qtdReceitas + qtdDespesas
      },
      objetivos: objetivosResumo.resumo,
      alertas
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * HISTÓRICO MENSAL (gráfico de evolução)
 * ==========================================
 */
const historicoMensal = async (req, res, next) => {
  try {
    const historico = await HistoricoPoupanca.getGraficoEvolucao(req.usuarioId, 2); // últimos 24 meses

    return successResponse(res, {
      mensagem: 'Histórico mensal carregado',
      historico: historico.map(h => ({
        periodo: h.periodoFormatado,
        saldoFinal: h.saldoTotal,
        poupancaLiquida: h.poupancaLiquida,
        taxaPoupanca: h.taxaPoupanca
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * TOP CATEGORIAS DO MÊS
 * ==========================================
 */
const topCategorias = async (req, res, next) => {
  try {
    const inicio = new Date();
    inicio.setDate(1);

    const resultado = await Gasto.aggregate([
      {
        $match: {
          usuario: req.usuarioId,
          tipo: 'despesa',
          data: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          excluido: false
        }
      },
      {
        $group: {
          _id: '$categoria',
          total: { $sum: '$valor' }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]);

    return successResponse(res, {
      mensagem: 'Top 5 categorias do mês',
      top: resultado.map((c, i) => ({
        posicao: i + 1,
        categoria: c._id,
        valor: c.total
      }))
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  resumoDashboard,
  historicoMensal,
  topCategorias
};