// src/controllers/insightsController.js - OTIMIZADO E CORRIGIDO
const prisma = require('../../../lib/prisma');
const { getCache, setCache, deleteCache } = require('../../../utils/cache');


const getFluxoCaixaMensal = async (usuarioId, ano, mes) => {
  try {
    const hoje = new Date();
    const anoFinal = parseInt(ano) || hoje.getFullYear();
    const mesFinal = (mes !== undefined && mes !== null) ? parseInt(mes) : hoje.getMonth();

    
    const cacheKey = `fluxo:${usuarioId}:${anoFinal}:${mesFinal}`;
    
    
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const inicioMes = new Date(anoFinal, mesFinal, 1);
    const fimMes = new Date(anoFinal, mesFinal + 1, 0, 23, 59, 59, 999);

    
    const [receitasTotal, despesasTotal] = await Promise.all([
      prisma.gasto.aggregate({
        _sum: { valor: true },
        where: {
          usuarioId,
          tipo: 'RECEITA', 
          data: { gte: inicioMes, lte: fimMes },
          excluido: false
        }
      }),
      prisma.gasto.aggregate({
        _sum: { valor: true },
        where: {
          usuarioId,
          tipo: 'DESPESA',  
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


const getResumoObjetivos = async (usuarioId) => {
  try {
    const cacheKey = `objetivos:${usuarioId}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const hoje = new Date();

  
    const objetivos = await prisma.objetivo.findMany({
      where: {
        usuarioId,
        concluido: false,
        dataPrevista: { gte: hoje }  
      },
      select: {
        id: true,
        titulo: true,
        valorAlvo: true,
        valorAtual: true,
        dataPrevista: true,  
        prioridade: true,
        categoria: true,
        cor: true
      },
      orderBy: [
        { prioridade: 'desc' },
        { dataPrevista: 'asc' }  
      ]
    });

    // Cálculos em memória (mais rápido que no DB)
    const resultado = objetivos.map(obj => {
      const { valorAlvo, valorAtual, dataPrevista } = obj;  // CORRIGIDO
      const restante = Number(valorAlvo) - Number(valorAtual);
      
      
      const meses = (dataPrevista.getFullYear() - hoje.getFullYear()) * 12 
                    + (dataPrevista.getMonth() - hoje.getMonth());
      
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
    // CORRIGIDO: usa campos corretos do schema Cartao
    const [fluxo, objetivosStatus, cartoesAgg, user] = await Promise.all([
      getFluxoCaixaMensal(usuarioId, hoje.getFullYear(), hoje.getMonth()),
      getResumoObjetivos(usuarioId),
      prisma.cartao.aggregate({
        _sum: { 
          saldoAtual: true, 
          saldoDisponivel: true,  // CORRIGIDO: 'disponivel' → 'saldoDisponivel'
          saldoReservado: true    // Adicionado para cálculo correto
        },
        where: { 
          usuarioId, 
          ativo: true,
          excluido: false
        }
      }),
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { rendaMensalMedia: true, nome: true }
      })
    ]);

    const saldoTotal = Number(cartoesAgg._sum.saldoAtual) || 0;
    const disponivelTotal = Number(cartoesAgg._sum.saldoDisponivel) || 0;
    const reservadoTotal = Number(cartoesAgg._sum.saldoReservado) || 0;

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
        reservado: reservadoTotal,
        utilizavel: disponivelTotal - reservadoTotal // Dinheiro realmente disponível
      },
      esteMes: fluxo,
      objetivos: objetivosStatus.slice(0, 5), // Apenas top 5 para o dashboard
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
 * CORRIGIDO: Usa 'RECEITA' e 'DESPESA' em maiúsculas
 */
const historicoMensal = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    
    // Parâmetro de período (padrão: semestre)
    const { periodo = 'semestre' } = req.query;
    
    // Valida período permitido
    const periodosValidos = ['7dias', '31dias', 'trimestre', 'semestre', 'anual'];
    if (!periodosValidos.includes(periodo)) {
      return res.status(400).json({
        success: false,
        message: `Período inválido. Use: ${periodosValidos.join(', ')}`
      });
    }

    const cacheKey = `historico:${usuarioId}:${periodo}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Calcula data de corte baseada no período
    const dataCorte = new Date();
    const hoje = new Date();
    
    switch (periodo) {
      case '7dias':
        dataCorte.setDate(hoje.getDate() - 7);
        break;
      case '31dias':
        dataCorte.setDate(hoje.getDate() - 31);
        break;
      case 'trimestre':
        dataCorte.setMonth(hoje.getMonth() - 3);
        break;
      case 'semestre':
        dataCorte.setMonth(hoje.getMonth() - 6);
        break;
      case 'anual':
        dataCorte.setFullYear(hoje.getFullYear() - 1);
        break;
    }

    // Query otimizada sem parâmetros dinâmicos no SQL
    const historico = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', data) as mes,
        SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END) as receitas,
        SUM(CASE WHEN tipo = 'DESPESA' THEN valor ELSE 0 END) as despesas,
        SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE -valor END) as poupanca
      FROM "Gasto"
      WHERE "usuarioId" = ${usuarioId}
        AND excluido = false
        AND data >= ${dataCorte}
      GROUP BY DATE_TRUNC('month', data)
      ORDER BY mes ASC
    `;

    // Formata o resultado
    const historicoFormatado = historico.map(h => ({
      periodo: new Date(h.mes).toLocaleDateString('pt-AO', { 
        month: 'short', 
        year: 'numeric' 
      }),
      receitas: Number(h.receitas) || 0,
      despesas: Number(h.despesas) || 0,
      poupancaLiquida: Number(h.poupanca) || 0,
      taxaPoupanca: h.receitas > 0 
        ? Math.round((Number(h.poupanca) / Number(h.receitas)) * 100) 
        : 0
    }));

    // Calcula totais do período
    const totalReceitas = historicoFormatado.reduce((acc, h) => acc + h.receitas, 0);
    const totalDespesas = historicoFormatado.reduce((acc, h) => acc + h.despesas, 0);
    const totalPoupanca = totalReceitas - totalDespesas;

    const resultado = {
      success: true,
      periodo,
      dataInicio: dataCorte.toISOString(),
      dataFim: hoje.toISOString(),
      resumo: {
        totalReceitas,
        totalDespesas,
        totalPoupanca,
        taxaPoupancaMedia: totalReceitas > 0 
          ? Math.round((totalPoupanca / totalReceitas) * 100) 
          : 0,
        totalMeses: historicoFormatado.length
      },
      historico: historicoFormatado,
      timestamp: new Date().toISOString()
    };

    // Cache por 1 hora
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
 * CORRIGIDO: Usa 'DESPESA' em maiúsculas
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
    // CORRIGIDO: Usa 'DESPESA' em maiúsculas
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
        AND g.tipo = 'DESPESA'  -- CORRIGIDO: maiúsculo
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

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  resumoDashboard,
  historicoMensal,
  topCategorias,
  getFluxoCaixaMensal,
  getResumoObjetivos,
  invalidarCacheUsuario
};