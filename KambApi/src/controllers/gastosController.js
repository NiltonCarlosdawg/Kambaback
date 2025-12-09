// src/controllers/gastosController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

/**
 * ==========================================
 * CRIAR NOVO GASTO / RECEITA
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
    objetivoId,
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

      // 3. Cria o gasto — REMOVIDO objetivoId e include objetivo (não existe no schema)
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
          categoria: { select: { nome: true } }
          // objetivo removido — não existe no model Gasto
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

  const skip = (pagina - 1) * limite;
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

    const [gastos, total] = await Promise.all([
      prisma.gasto.findMany({
        where,
        include: {
          cartao: { select: { nome: true, tipo: true, cor: true, icone: true } },
          // objetivo removido — não existe no schema
          categoria: { select: { nome: true, cor: true } }
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
        paginas: Math.ceil(total / take)
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * RESUMO POR CATEGORIA (MÊS/ANO)
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
    const resultado = await prisma.gasto.groupBy({
      by: ['categoriaId'],
      where: {
        usuarioId: req.user.id,
        tipo: 'despesa',
        data: { gte: inicio, lte: fim },
        excluido: false
      },
      _sum: { valor: true },
      _count: { _all: true },
      orderBy: { _sum: { valor: 'desc' } }
    });

    const totalDespesas = resultado.reduce((acc, r) => acc + (r._sum.valor || 0), 0);

    const categoriaIds = resultado.map(r => r.categoriaId).filter(Boolean);
    const categorias = await prisma.categoria.findMany({
      where: { id: { in: categoriaIds } },
      select: { id: true, nome: true }
    });

    const categoriasFormatadas = resultado.map(item => ({
      categoria: categorias.find(c => c.id === item.categoriaId)?.nome || 'Sem categoria',
      total: item._sum.valor || 0,
      quantidade: item._count._all,
      porcentagem: totalDespesas > 0 ? Math.round((item._sum.valor / totalDespesas) * 100) : 0
    }));

    res.json({
      success: true,
      message: 'Resumo por categoria',
      periodo: inicio.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' }),
      totalDespesas,
      categorias: categoriasFormatadas
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * DELETAR GASTO (soft delete + revert saldo)
 * ==========================================
 */
const deletarGasto = async (req, res, next) => {
  const { id } = req.params;

  try {
    await prisma.$transaction(async (tx) => {
      const gasto = await tx.gasto.findFirst({
        where: { id, usuarioId: req.user.id },
        include: { cartao: true }
      });

      if (!gasto) throw new AppError('Gasto não encontrado', 404);
      if (gasto.excluido) throw new AppError('Gasto já foi removido', 400);

      await tx.gasto.update({
        where: { id },
        data: { excluido: true }
      });

      if (gasto.cartao) {
        const ajuste = gasto.tipo === 'despesa' ? +gasto.valor : -gasto.valor;
        await tx.cartao.update({
          where: { id: gasto.cartaoId },
          data: { saldoAtual: { increment: ajuste } }
        });
      }
    });

    res.json({ success: true, message: 'Gasto removido com sucesso' });

  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Erro ao deletar gasto', 500));
  }
};

module.exports = {
  criarGasto,
  listarGastos,
  gastosPorCategoria,
  deletarGasto
};