// src/controllers/gastosController.js - COM INVALIDAÇÃO DE CACHE
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');
const { invalidarCacheUsuario } = require('./insightsController');

/**
 * ==========================================
 * CRIAR NOVO GASTO / RECEITA
 * OTIMIZADO: Com invalidação de cache
 * ==========================================
 */
const criarGasto = async (req, res, next) => {
  const {
    cartaoId,
    tipo,
    valor,
    descricao,
    categoriaId,
    data,
    local,
    parcelado,
    tags
  } = req.body;

  const usuarioId = req.user.id;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Valida cartão
      const cartao = await tx.cartao.findFirst({
        where: { id: cartaoId, usuarioId, ativo: true }
      });
      if (!cartao) throw new AppError('Cartão inválido ou inativo', 400);

      // 2. Verifica saldo (apenas despesa)
      if (tipo === 'despesa') {
        const disponivel = (cartao.saldoAtual || 0) - (cartao.reservado || 0);
        if (disponivel < valor) {
          throw new AppError(`Saldo insuficiente no cartão ${cartao.nome}`, 400);
        }
      }

      // 3. Cria o gasto
      const gasto = await tx.gasto.create({
        data: {
          usuarioId,
          cartaoId,
          tipo,
          valor: parseFloat(valor),
          descricao: descricao || '',
          categoriaId,
          data: data ? new Date(data) : new Date(),
          local: local || null,
          parcelado: parcelado || { totalParcelas: 1, parcelaAtual: 1, recorrencia: 'unica' },
          tags: tags || [],
          excluido: false
        },
        include: {
          cartao: { select: { nome: true, tipo: true, cor: true, icone: true } },
          categoria: { select: { nome: true, cor: true } }
        }
      });

      // 4. Atualiza saldo do cartão
      const novoSaldo = tipo === 'despesa'
        ? cartao.saldoAtual - valor
        : cartao.saldoAtual + valor;

      await tx.cartao.update({
        where: { id: cartaoId },
        data: { saldoAtual: novoSaldo }
      });

      return gasto;
    });

    // OTIMIZAÇÃO: Invalida cache após criar gasto
    await invalidarCacheUsuario(usuarioId);

    res.status(201).json({
      success: true,
      message: tipo === 'despesa' ? 'Gasto registrado com sucesso!' : 'Receita registrada com sucesso!',
      gasto: resultado
    });

  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Erro ao criar transação', 500));
  }
};

/**
 * ==========================================
 * LISTAR GASTOS COM FILTROS + PAGINAÇÃO
 * OTIMIZADO: Queries eficientes com índices
 * ==========================================
 */
const listarGastos = async (req, res, next) => {
  const {
    pagina = 1,
    limite = 20,
    tipo,
    categoria: categoriaId,
    cartao: cartaoId,
    dataInicio,
    dataFim,
    busca
  } = req.query;

  const skip = (parseInt(pagina) - 1) * parseInt(limite);
  const take = parseInt(limite);

  try {
    const where = {
      usuarioId: req.user.id,
      excluido: false,
      ...(tipo && { tipo }),
      ...(cartaoId && { cartaoId }),
      ...(categoriaId && { categoriaId }),
      ...(dataInicio || dataFim ? {
        data: {
          ...(dataInicio && { gte: new Date(dataInicio) }),
          ...(dataFim && { lte: new Date(dataFim) })
        }
      } : {}),
      ...(busca ? {
        OR: [
          { descricao: { contains: busca, mode: 'insensitive' } },
          { local: { contains: busca, mode: 'insensitive' } },
          { tags: { hasSome: [busca] } }
        ]
      } : {})
    };

    // OTIMIZADO: Queries em paralelo
    const [gastos, total] = await Promise.all([
      prisma.gasto.findMany({
        where,
        include: {
          cartao: { select: { nome: true, tipo: true, cor: true, icone: true } },
          categoria: { select: { nome: true, cor: true, icone: true } }
        },
        orderBy: { data: 'desc' },
        skip,
        take
      }),
      prisma.gasto.count({ where })
    ]);

    res.json({
      success: true,
      message: 'Gastos carregados',
      gastos,
      paginacao: {
        pagina: parseInt(pagina),
        limite: take,
        total,
        paginas: Math.ceil(total / take),
        temProxima: skip + take < total,
        temAnterior: parseInt(pagina) > 1
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * RESUMO POR CATEGORIA (MÊS/ANO)
 * SUPER OTIMIZADO: Query raw SQL
 * ==========================================
 */
const gastosPorCategoria = async (req, res, next) => {
  let { mes, ano } = req.query;
  const hoje = new Date();
  mes = mes ? parseInt(mes) : hoje.getMonth() + 1;
  ano = ano ? parseInt(ano) : hoje.getFullYear();

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  try {
    // SUPER OTIMIZADO: Raw SQL com JOIN direto
    const resultado = await prisma.$queryRaw`
      SELECT 
        c.id as "categoriaId",
        c.nome as categoria,
        c.cor,
        c.icone,
        SUM(g.valor) as total,
        COUNT(g.id) as quantidade
      FROM "Gasto" g
      LEFT JOIN "Categoria" c ON g."categoriaId" = c.id
      WHERE g."usuarioId" = ${req.user.id}
        AND g.tipo = 'despesa'
        AND g.data >= ${inicio}
        AND g.data <= ${fim}
        AND g.excluido = false
      GROUP BY c.id, c.nome, c.cor, c.icone
      ORDER BY total DESC
    `;

    const totalDespesas = resultado.reduce((acc, r) => acc + Number(r.total), 0);

    const categoriasFormatadas = resultado.map(item => ({
      categoriaId: item.categoriaId,
      categoria: item.categoria || 'Sem categoria',
      cor: item.cor || '#9E9E9E',
      icone: item.icone || 'help',
      total: Number(item.total) || 0,
      quantidade: Number(item.quantidade),
      porcentagem: totalDespesas > 0 ? Math.round((Number(item.total) / totalDespesas) * 100) : 0,
      media: Number(item.total) / Number(item.quantidade)
    }));

    res.json({
      success: true,
      message: 'Resumo por categoria',
      periodo: inicio.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' }),
      totalDespesas,
      totalCategorias: categoriasFormatadas.length,
      categorias: categoriasFormatadas
    });

  } catch (err) {
    console.error('[GASTOS POR CATEGORIA] Erro:', err);
    next(err);
  }
};

/**
 * ==========================================
 * DELETAR GASTO (soft delete + revert saldo)
 * OTIMIZADO: Com invalidação de cache
 * ==========================================
 */
const deletarGasto = async (req, res, next) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.findFirst({
        where: { id, usuarioId },
        include: { cartao: true }
      });

      if (!gasto) throw new AppError('Gasto não encontrado', 404);
      if (gasto.excluido) throw new AppError('Gasto já foi removido', 400);

      // Soft delete
      await tx.gasto.update({
        where: { id },
        data: { excluido: true }
      });

      // Reverte o saldo do cartão
      if (gasto.cartao) {
        const ajuste = gasto.tipo === 'despesa' ? +gasto.valor : -gasto.valor;
        await tx.cartao.update({
          where: { id: gasto.cartaoId },
          data: { saldoAtual: { increment: ajuste } }
        });
      }
    });

    // OTIMIZAÇÃO: Invalida cache após deletar
    await invalidarCacheUsuario(usuarioId);

    res.json({ success: true, message: 'Gasto removido com sucesso' });

  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Erro ao deletar gasto', 500));
  }
};

/**
 * ==========================================
 * ESTATÍSTICAS RÁPIDAS (NOVO ENDPOINT)
 * Resumo do mês sem paginação
 * ==========================================
 */
const estatisticasRapidas = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    // Query super otimizada com raw SQL
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) FILTER (WHERE tipo = 'despesa') as total_despesas,
        COUNT(*) FILTER (WHERE tipo = 'receita') as total_receitas,
        SUM(valor) FILTER (WHERE tipo = 'despesa') as soma_despesas,
        SUM(valor) FILTER (WHERE tipo = 'receita') as soma_receitas,
        AVG(valor) FILTER (WHERE tipo = 'despesa') as media_despesas
      FROM "Gasto"
      WHERE "usuarioId" = ${usuarioId}
        AND data >= ${inicioMes}
        AND excluido = false
    `;

    const result = stats[0];

    res.json({
      success: true,
      periodo: 'Este mês',
      transacoes: {
        totalDespesas: Number(result.total_despesas) || 0,
        totalReceitas: Number(result.total_receitas) || 0,
        total: Number(result.total_despesas) + Number(result.total_receitas)
      },
      valores: {
        despesas: Number(result.soma_despesas) || 0,
        receitas: Number(result.soma_receitas) || 0,
        saldo: (Number(result.soma_receitas) || 0) - (Number(result.soma_despesas) || 0),
        mediaDespesa: Number(result.media_despesas) || 0
      }
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  criarGasto,
  listarGastos,
  gastosPorCategoria,
  deletarGasto,
  estatisticasRapidas
};