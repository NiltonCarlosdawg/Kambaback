// src/controllers/insightsController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

/**
 * ==========================================
 * DASHBOARD PRINCIPAL – RESUMO COMPLETO
 * ==========================================
 */
const resumoDashboard = async (req, res, next) => {
  try {
    const usuarioId = req.user.id; // vindo do middleware protect

    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. SALDOS DOS CARTÕES (só ativos)
    const cartoes = await prisma.cartao.findMany({
      where: { usuarioId, ativo: true },
      select: { saldoAtual: true, disponivel: true }
    });

    const saldoTotal = cartoes.reduce((acc, c) => acc + (c.saldoAtual || 0), 0);
    const disponivelTotal = cartoes.reduce((acc, c) => acc + (c.disponivel || 0), 0);

    // 2. MOVIMENTOS DO MÊS ATUAL (receitas e despesas)
    const movimentos = await prisma.gasto.groupBy({
      by: ['tipo'],
      where: {
        usuarioId,
        data: { gte: inicioMes, lte: fimMes },
        excluido: false
      },
      _sum: { valor: true },
      _count: { _all: true }
    });

    let receitas = 0, despesas = 0, qtdReceitas = 0, qtdDespesas = 0;

    movimentos.forEach(m => {
      if (m.tipo === 'receita') {
        receitas = m._sum.valor || 0;
        qtdReceitas = m._count._all;
      }
      if (m.tipo === 'despesa') {
        despesas = m._sum.valor || 0;
        qtdDespesas = m._count._all;
      }
    });

    const poupancaMes = receitas - despesas;

    // 3. OBJETIVOS ATIVOS
    const objetivosAtivos = await prisma.objetivo.count({
      where: {
        usuarioId,
        concluido: false,
        dataFinal: { gte: new Date() }
      }
    });

    // 4. ALERTAS INTELIGENTES
    const alertas = [];

    if (despesas > receitas * 0.9 && despesas > 0) {
      alertas.push({
        tipo: 'perigo',
        titulo: 'Cuidado, kamba!',
        mensagem: 'Estás gastando quase tudo que entra. Reduz aí!'
      });
    }

    if (poupancaMes > 50000 && objetivosAtivos === 0) {
      alertas.push({
        tipo: 'sucesso',
        titulo: 'Poupança disponível!',
        mensagem: `Tens ${poupancaMes.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })} de sobra este mês. Cria um objetivo!`
      });
    }

    if (saldoTotal < 100000) {
      alertas.push({
        tipo: 'aviso',
        titulo: 'Fundo de emergência baixo',
        mensagem: 'Tenta manter pelo menos 3 meses de despesas guardadas.'
      });
    }

    // Resposta final
    res.json({
      success: true,
      mensagem: 'Dashboard carregado com sucesso',
      periodo: hoje.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' }),
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
      objetivos: {
        emAndamento: objetivosAtivos
      },
      alertas
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * HISTÓRICO MENSAL – EVOLUÇÃO DA POUPANÇA
 * ==========================================
 */
const historicoMensal = async (req, res, next) => {
  try {
    const meses = 24;
    const historico = [];

    for (let i = meses - 1; i >= 0; i--) {
      const data = new Date();
      data.setMonth(data.getMonth() - i);
      const inicio = new Date(data.getFullYear(), data.getMonth(), 1);
      const fim = new Date(data.getFullYear(), data.getMonth() + 1, 0, 23, 59, 59);

      const movimentos = await prisma.gasto.groupBy({
        by: ['tipo'],
        where: {
          usuarioId: req.user.id,
          data: { gte: inicio, lte: fim },
          excluido: false
        },
        _sum: { valor: true }
      });

      let receitas = 0, despesas = 0;
      movimentos.forEach(m => {
        if (m.tipo === 'receita') receitas = m._sum.valor || 0;
        if (m.tipo === 'despesa') despesas = m._sum.valor || 0;
      });

      const poupancaLiquida = receitas - despesas;

      historico.push({
        periodo: data.toLocaleDateString('pt-AO', { month: 'short', year: 'numeric' }),
        saldoFinal: 0, // pode ser melhorado com histórico real de saldos
        poupancaLiquida,
        taxaPoupanca: receitas > 0 ? Math.round((poupancaLiquida / receitas) * 100) : 0
      });
    }

    res.json({
      success: true,
      mensagem: 'Histórico carregado',
      historico
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * TOP 5 CATEGORIAS DO MÊS
 * ==========================================
 */
const topCategorias = async (req, res, next) => {
  try {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const top = await prisma.gasto.groupBy({
      by: ['categoriaId'],
      where: {
        usuarioId: req.user.id,
        tipo: 'despesa',
        data: { gte: inicioMes },
        excluido: false
      },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
      take: 5
    });

    // Busca nome da categoria
    const categoriasIds = top.map(t => t.categoriaId).filter(Boolean);
    const categorias = await prisma.categoria.findMany({
      where: { id: { in: categoriasIds } },
      select: { id: true, nome: true }
    });

    const resultado = top.map((item, index) => ({
      posicao: index + 1,
      categoria: categorias.find(c => c.id === item.categoriaId)?.nome || 'Sem categoria',
      valor: item._sum.valor || 0
    }));

    res.json({
      success: true,
      mensagem: 'Top 5 categorias do mês',
      top: resultado
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