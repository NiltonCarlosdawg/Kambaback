const prisma = require('../lib/prisma');

/**
 * ==========================================
 * FUNÇÕES ATÓMICAS (Para uso pelo Assistente AI e Dashboard)
 * ==========================================
 */

/**
 * Obtém o fluxo de caixa (receitas - despesas) para um determinado mês.
 */
const getFluxoCaixaMensal = async (usuarioId, ano, mes) => {
  try {
    const hoje = new Date();
    // Garante que ano e mês são números válidos para evitar "Invalid Date"
    const anoFinal = parseInt(ano) || hoje.getFullYear();
    const mesFinal = (mes !== undefined && mes !== null) ? parseInt(mes) : hoje.getMonth();

    const inicioMes = new Date(anoFinal, mesFinal, 1);
    const fimMes = new Date(anoFinal, mesFinal + 1, 0, 23, 59, 59, 999);

    const movimentos = await prisma.gasto.groupBy({
      by: ["tipo"],
      where: {
        usuarioId,
        data: { gte: inicioMes, lte: fimMes },
        excluido: false
      },
      _sum: { valor: true }
    });

    let receitas = 0;
    let despesas = 0;

    movimentos.forEach(m => {
      const valor = Number(m._sum.valor) || 0;
      if (m.tipo === 'receita') receitas = valor;
      if (m.tipo === 'despesa') despesas = valor;
    });

    const poupancaLiquida = receitas - despesas;
    
    return {
        periodo: `${mesFinal + 1}/${anoFinal}`,
        receitas,
        despesas,
        poupancaLiquida,
        taxaPoupanca: receitas > 0 ? Math.round((poupancaLiquida / receitas) * 100) : 0
    };

  } catch (error) {
    console.error("Erro no Insight (Fluxo):", error.message);
    return { erro: "Dados de fluxo indisponíveis" };
  }
};

/**
 * Obtém o status completo dos objetivos financeiros ativos.
 */
const getResumoObjetivos = async (usuarioId) => {
  try {
    const objetivos = await prisma.objetivo.findMany({
        where: {
            usuarioId,
            concluido: false,
            dataFinal: { gte: new Date() }
        },
        select: {
            titulo: true,
            valorAlvo: true,
            valorAtual: true,
            dataFinal: true,
            prioridade: true,
        }
    });

    return objetivos.map(obj => {
        const { valorAlvo, valorAtual, dataFinal } = obj;
        const restante = Number(valorAlvo) - Number(valorAtual);
        const hoje = new Date();
        
        const meses = (dataFinal.getFullYear() - hoje.getFullYear()) * 12 + (dataFinal.getMonth() - hoje.getMonth());
        const poupancaMensalNecessaria = meses > 0 ? restante / meses : restante;

        return {
            ...obj,
            restante: restante < 0 ? 0 : restante,
            progresso: Math.round((Number(valorAtual) / Number(valorAlvo)) * 100) || 0,
            poupancaMensalNecessaria: poupancaMensalNecessaria > 0 ? poupancaMensalNecessaria : 0,
            mesesRestantes: meses > 0 ? meses : 0,
        };
    });
  } catch (error) {
    console.error("Erro no Insight (Objetivos):", error.message);
    return [];
  }
};

/**
 * Verifica o status do fundo de emergência.
 */
const getFundoEmergenciaStatus = async (usuarioId) => {
  try {
    const mesesParaMedia = 6;
    const mesesRecomendados = 6;
    const hoje = new Date();
    const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - mesesParaMedia, 1);

    const despesasTotal = await prisma.gasto.aggregate({
        _sum: { valor: true },
        where: {
            usuarioId,
            tipo: 'despesa',
            excluido: false,
            data: { gte: seisMesesAtras }
        }
    });

    const valorTotalDespesas = Number(despesasTotal._sum.valor) || 0;
    const despesaMediaMensal = valorTotalDespesas / mesesParaMedia;

    // Busca saldo atual de cartões/contas marcados como "reserva"
    const cartoesReserva = await prisma.cartao.aggregate({
        _sum: { saldoAtual: true },
        where: { 
            usuarioId, 
            ativo: true,
            nome: { contains: 'Reserva', mode: 'insensitive' } // Ajuste conforme seu uso
        }
    });
    
    const saldoAtualReserva = Number(cartoesReserva._sum.saldoAtual) || 0;
    const alvoEmergencia = despesaMediaMensal * mesesRecomendados;
    
    return {
        despesaMediaMensal,
        saldoAtualReserva,
        alvoEmergencia,
        mesesCobertos: despesaMediaMensal > 0 ? saldoAtualReserva / despesaMediaMensal : 0,
    };
  } catch (error) {
    return { erro: "Cálculo de emergência indisponível" };
  }
};

/**
 * ==========================================
 * ENDPOINTS DO DASHBOARD
 * ==========================================
 */
const resumoDashboard = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const hoje = new Date();

    const fluxo = await getFluxoCaixaMensal(usuarioId, hoje.getFullYear(), hoje.getMonth());
    const objetivosStatus = await getResumoObjetivos(usuarioId);
    const fundoStatus = await getFundoEmergenciaStatus(usuarioId);
    
    const cartoes = await prisma.cartao.findMany({
      where: { usuarioId, ativo: true },
      select: { saldoAtual: true, disponivel: true }
    });

    const saldoTotal = cartoes.reduce((acc, c) => acc + (Number(c.saldoAtual) || 0), 0);

    const user = await prisma.user.findUnique({
        where: { id: usuarioId },
        select: { rendaMensalMedia: true, nome: true }
    });

    const alertas = [];
    if (user.rendaMensalMedia > 0 && fluxo.despesas > user.rendaMensalMedia * 0.7) {
        alertas.push({ tipo: 'perigo', titulo: 'Atenção ao Orçamento', mensagem: `Gastaste mais de 70% da tua renda!` });
    }

    res.json({
      success: true,
      user: { nome: user.nome },
      saldoTotal,
      esteMes: fluxo,
      objetivos: objetivosStatus,
      fundoEmergencia: fundoStatus,
      alertas
    });

  } catch (err) {
    next(err);
  }
};

const historicoMensal = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const meses = 6; // Reduzi para 6 para performance
    const historico = [];

    for (let i = meses - 1; i >= 0; i--) {
      const data = new Date();
      data.setMonth(data.getMonth() - i);
      const fluxo = await getFluxoCaixaMensal(usuarioId, data.getFullYear(), data.getMonth());
      historico.push(fluxo);
    }

    res.json({ success: true, historico });
  } catch (err) {
    next(err);
  }
};

const topCategorias = async (req, res, next) => {
  try {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const top = await prisma.gasto.groupBy({
      by: ['categoriaId'],
      where: { usuarioId: req.user.id, tipo: 'despesa', data: { gte: inicioMes }, excluido: false },
      _sum: { valor: true },
      orderBy: { _sum: { valor: 'desc' } },
      take: 5
    });

    const categorias = await prisma.categoria.findMany({
      where: { id: { in: top.map(t => t.categoriaId).filter(Boolean) } }
    });

    const resultado = top.map(item => ({
      categoria: categorias.find(c => c.id === item.categoriaId)?.nome || 'Geral',
      valor: item._sum.valor || 0
    }));

    res.json({ success: true, top: resultado });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  resumoDashboard,
  historicoMensal,
  topCategorias,
  getFluxoCaixaMensal,
  getResumoObjetivos,
  getFundoEmergenciaStatus
};