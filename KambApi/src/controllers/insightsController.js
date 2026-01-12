// src/controllers/insightsController.js - OTIMIZADO
const prisma = require('../lib/prisma');
const { getCache, setCache, deleteCache } = require('../utils/cache');

/**
 * ==========================================
 * FUNÇÕES ATÔMICAS (Para uso pelo Assistente AI e Dashboard)
 * OTIMIZADO: Com cache e queries eficientes
 * ==========================================
 */

/**
 * Obtém o fluxo de caixa (receitas - despesas) para um determinado mês.
 * OTIMIZADO: Agora com cache de 5 minutos
 */
const getFluxoCaixaMensal = async (usuarioId, ano, mes) => {
  try {
    const hoje = new Date();
    const anoFinal = parseInt(ano) || hoje.getFullYear();
    const mesFinal = (mes !== undefined && mes !== null) ? parseInt(mes) : hoje.getMonth();

    // Cache key único para este usuário/período
    const cacheKey = `fluxo:${usuarioId}:${anoFinal}:${mesFinal}`;
    
    // Tenta buscar do cache primeiro
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const inicioMes = new Date(anoFinal, mesFinal, 1);
    const fimMes = new Date(anoFinal, mesFinal + 1, 0, 23, 59, 59, 999);

    // Query otimizada - usa aggregate em vez de groupBy quando possível
    const [receitasTotal, despesasTotal] = await Promise.all([
      prisma.gasto.aggregate({
        _sum: { valor: true },
        where: {
          usuarioId,
          tipo: 'receita',
          data: { gte: inicioMes, lte: fimMes },
          excluido: false
        }
      }),
      prisma.gasto.aggregate({
        _sum: { valor: true },
        where: {
          usuarioId,
          tipo: 'despesa',
          data: { gte: inicioMes, lte: fimMes },
          excluido: false
        }
      })
    ]);

    const receitas = Number(receitasTotal._sum.valor) || 0;
    const despesas = Number(despesasTotal._sum.valor) || 0;
    const poupancaLiquida = receitas - despesas;
    
    const resultado = {
      periodo: `${mesFinal + 1}/${anoFinal}`,
      receitas,
      despesas,
      poupancaLiquida,
      taxaPoupanca: receitas > 0 ? Math.round((poupancaLiquida / receitas) * 100) : 0
    };

    // Armazena no cache por 5 minutos
    await setCache(cacheKey, resultado, 300);

    return resultado;

  } catch (error) {
    console.error("Erro no Insight (Fluxo):", error.message);
    return { erro: "Dados de fluxo indisponíveis" };
  }
};

/**
 * Obtém o status completo dos objetivos financeiros ativos.
 * OTIMIZADO: Query única + cálculos em memória
 */
const getResumoObjetivos = async (usuarioId) => {
  try {
    const cacheKey = `objetivos:${usuarioId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const hoje = new Date();

    // Uma única query com todos os filtros
    const objetivos = await prisma.objetivo.findMany({
      where: {
        usuarioId,
        concluido: false,
        dataFinal: { gte: hoje }
      },
      select: {
        id: true,
        titulo: true,
        valorAlvo: true,
        valorAtual: true,
        dataFinal: true,
        prioridade: true,
        categoria: true,
        cor: true
      },
      orderBy: [
        { prioridade: 'desc' },
        { dataFinal: 'asc' }
      ]
    });

    // Cálculos em memória (mais rápido que no DB)
    const resultado = objetivos.map(obj => {
      const { valorAlvo, valorAtual, dataFinal } = obj;
      const restante = Number(valorAlvo) - Number(valorAtual);
      
      const meses = (dataFinal.getFullYear() - hoje.getFullYear()) * 12 
                    + (dataFinal.getMonth() - hoje.getMonth());
      
      const poupancaMensalNecessaria = meses > 0 ? restante / meses : restante;

      return {
        ...obj,
        restante: restante < 0 ? 0 : restante,
        progresso: Math.round((Number(valorAtual) / Number(valorAlvo)) * 100) || 0,
        poupancaMensalNecessaria: poupancaMensalNecessaria > 0 ? poupancaMensalNecessaria : 0,
        mesesRestantes: meses > 0 ? meses : 0,
      };
    });

    // Cache por 2 minutos (objetivos mudam com frequência)
    await setCache(cacheKey, resultado, 120);

    return resultado;

  } catch (error) {
    console.error("Erro no Insight (Objetivos):", error.message);
    return [];
  }
};

/**
 * Verifica o status do fundo de emergência.
 * OTIMIZADO: Queries paralelas + cache
 */
const getFundoEmergenciaStatus = async (usuarioId) => {
  try {
    const cacheKey = `fundo:${usuarioId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const mesesParaMedia = 6;
    const mesesRecomendados = 6;
    const hoje = new Date();
    const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - mesesParaMedia, 1);

    // Queries paralelas - muito mais rápido!
    const [despesasTotal, cartoesReserva] = await Promise.all([
      prisma.gasto.aggregate({
        _sum: { valor: true },
        where: {
          usuarioId,
          tipo: 'despesa',
          excluido: false,
          data: { gte: seisMesesAtras }
        }
      }),
      prisma.cartao.aggregate({
        _sum: { saldoAtual: true },
        where: { 
          usuarioId, 
          ativo: true,
          nome: { contains: 'Reserva', mode: 'insensitive' }
        }
      })
    ]);

    const valorTotalDespesas = Number(despesasTotal._sum.valor) || 0;
    const despesaMediaMensal = valorTotalDespesas / mesesParaMedia;
    const saldoAtualReserva = Number(cartoesReserva._sum.saldoAtual) || 0;
    const alvoEmergencia = despesaMediaMensal * mesesRecomendados;
    
    const resultado = {
      despesaMediaMensal,
      saldoAtualReserva,
      alvoEmergencia,
      mesesCobertos: despesaMediaMensal > 0 ? saldoAtualReserva / despesaMediaMensal : 0,
      percentualAtingido: alvoEmergencia > 0 ? Math.round((saldoAtualReserva / alvoEmergencia) * 100) : 0
    };

    // Cache por 10 minutos
    await setCache(cacheKey, resultado, 600);

    return resultado;

  } catch (error) {
    console.error("Erro no cálculo de emergência:", error.message);
    return { erro: "Cálculo de emergência indisponível" };
  }
};

/**
 * ==========================================
 * ENDPOINTS DO DASHBOARD
 * OTIMIZADO: Queries paralelas + cache inteligente
 * ==========================================
 */
const resumoDashboard = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const cacheKey = `dashboard:${usuarioId}`;

    // Tenta buscar dashboard completo do cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        cached: true,
        cachedAt: cached.timestamp
      });
    }

    const hoje = new Date();

    // OTIMIZADO: Todas as queries em paralelo!
    const [fluxo, objetivosStatus, fundoStatus, cartoes, user] = await Promise.all([
      getFluxoCaixaMensal(usuarioId, hoje.getFullYear(), hoje.getMonth()),
      getResumoObjetivos(usuarioId),
      getFundoEmergenciaStatus(usuarioId),
      prisma.cartao.aggregate({
        _sum: { saldoAtual: true, disponivel: true },
        where: { usuarioId, ativo: true }
      }),
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { rendaMensalMedia: true, nome: true }
      })
    ]);

    const saldoTotal = Number(cartoes._sum.saldoAtual) || 0;
    const disponivelTotal = Number(cartoes._sum.disponivel) || 0;

    // Gera alertas inteligentes
    const alertas = [];
    
    if (user.rendaMensalMedia > 0 && fluxo.despesas > user.rendaMensalMedia * 0.7) {
      alertas.push({ 
        tipo: 'perigo', 
        titulo: 'Atenção ao Orçamento', 
        mensagem: `Gastaste mais de 70% da tua renda!`,
        valor: Math.round((fluxo.despesas / user.rendaMensalMedia) * 100)
      });
    }

    if (fundoStatus.mesesCobertos < 3) {
      alertas.push({
        tipo: 'aviso',
        titulo: 'Fundo de Emergência Baixo',
        mensagem: `Tens apenas ${fundoStatus.mesesCobertos.toFixed(1)} meses de reserva. Recomendamos 6 meses.`
      });
    }

    if (fluxo.poupancaLiquida < 0) {
      alertas.push({
        tipo: 'perigo',
        titulo: 'Gastaste Mais que Recebeste',
        mensagem: `Déficit de ${Math.abs(fluxo.poupancaLiquida).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })} este mês!`
      });
    }

    const resultado = {
      success: true,
      user: { nome: user.nome },
      saldos: {
        total: saldoTotal,
        disponivel: disponivelTotal,
        reservado: saldoTotal - disponivelTotal
      },
      esteMes: fluxo,
      objetivos: objetivosStatus.slice(0, 5), // Apenas top 5 para o dashboard
      fundoEmergencia: fundoStatus,
      alertas,
      timestamp: new Date().toISOString()
    };

    // Cache do dashboard por 3 minutos
    await setCache(cacheKey, resultado, 180);

    res.json(resultado);

  } catch (err) {
    next(err);
  }
};

/**
 * HISTÓRICO MENSAL
 * OTIMIZADO: Query única com rawQuery para performance máxima
 */
const historicoMensal = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const meses = parseInt(req.query.meses) || 6;
    const cacheKey = `historico:${usuarioId}:${meses}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // SUPER OTIMIZADO: Query raw SQL que faz tudo de uma vez
    const historico = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', data) as mes,
        SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) as receitas,
        SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as despesas,
        SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END) as poupanca
      FROM "Gasto"
      WHERE "usuarioId" = ${usuarioId}
        AND excluido = false
        AND data >= NOW() - INTERVAL '${meses} months'
      GROUP BY DATE_TRUNC('month', data)
      ORDER BY mes ASC
    `;

    // Formata o resultado
    const historicoFormatado = historico.map(h => ({
      periodo: new Date(h.mes).toLocaleDateString('pt-AO', { month: 'short', year: 'numeric' }),
      receitas: Number(h.receitas) || 0,
      despesas: Number(h.despesas) || 0,
      poupancaLiquida: Number(h.poupanca) || 0,
      taxaPoupanca: h.receitas > 0 ? Math.round((Number(h.poupanca) / Number(h.receitas)) * 100) : 0
    }));

    const resultado = {
      success: true,
      historico: historicoFormatado,
      meses,
      timestamp: new Date().toISOString()
    };

    // Cache por 1 hora (histórico muda pouco)
    await setCache(cacheKey, resultado, 3600);

    res.json(resultado);

  } catch (err) {
    console.error('[HISTÓRICO] Erro:', err);
    next(err);
  }
};

/**
 * TOP CATEGORIAS
 * OTIMIZADO: Query única com JOIN e cache
 */
const topCategorias = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const cacheKey = `top-categorias:${usuarioId}`;

    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // OTIMIZADO: Query raw com JOIN 
    const top = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.nome,
        c.cor,
        SUM(g.valor) as total,
        COUNT(g.id) as quantidade
      FROM "Gasto" g
      LEFT JOIN "Categoria" c ON g."categoriaId" = c.id
      WHERE g."usuarioId" = ${usuarioId}
        AND g.tipo = 'despesa'
        AND g.data >= ${inicioMes}
        AND g.excluido = false
      GROUP BY c.id, c.nome, c.cor
      ORDER BY total DESC
      LIMIT 5
    `;

    const totalGasto = top.reduce((acc, cat) => acc + Number(cat.total), 0);

    const resultado = {
      success: true,
      top: top.map(cat => ({
        categoria: cat.nome || 'Sem categoria',
        cor: cat.cor || '#9E9E9E',
        valor: Number(cat.total) || 0,
        quantidade: Number(cat.quantidade),
        porcentagem: totalGasto > 0 ? Math.round((Number(cat.total) / totalGasto) * 100) : 0
      })),
      totalGasto,
      periodo: inicioMes.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' }),
      timestamp: new Date().toISOString()
    };

    // Cache por 5 minutos
    await setCache(cacheKey, resultado, 300);

    res.json(resultado);

  } catch (err) {
    console.error('[TOP CATEGORIAS] Erro:', err);
    next(err);
  }
};

/**
 * ==========================================
 * INVALIDAÇÃO DE CACHE
 * Chame quando dados forem modificados
 * ==========================================
 */
const invalidarCacheUsuario = async (usuarioId) => {
  const keys = [
    `dashboard:${usuarioId}`,
    `fluxo:${usuarioId}:*`,
    `objetivos:${usuarioId}`,
    `fundo:${usuarioId}`,
    `historico:${usuarioId}:*`,
    `top-categorias:${usuarioId}`
  ];

  for (const key of keys) {
    await deleteCache(key);
  }
};

module.exports = {
  resumoDashboard,
  historicoMensal,
  topCategorias,
  getFluxoCaixaMensal,
  getResumoObjetivos,
  getFundoEmergenciaStatus,
  invalidarCacheUsuario
};