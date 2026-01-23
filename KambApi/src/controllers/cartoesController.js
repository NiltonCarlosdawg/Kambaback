// src/controllers/cartoesController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

/**
 * LISTAR TODOS OS CARTÕES DO USUÁRIO
 */
const listarCartoes = async (req, res, next) => {
  try {
    const cartoes = await prisma.cartao.findMany({
      where: {
        usuarioId: req.user.id,
        ativo: true
      },
      orderBy: { criadoEm: 'desc' }
    });

    const totalSaldo = cartoes.reduce((acc, c) => acc + (c.saldoAtual || 0), 0);
    const totalDisponivel = cartoes.reduce((acc, c) => acc + (c.disponivel || 0), 0);

    res.json({
      success: true,
      message: 'Cartões carregados com sucesso',
      cartoes,
      resumo: {
        totalCartoes: cartoes.length,
        saldoTotal: totalSaldo,
        disponivelTotal: totalDisponivel
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * CRIAR NOVO CARTÃO
 */
const criarCartao = async (req, res, next) => {
  const {
    nome,
    tipo,
    banco,
    numero,
    saldoAtual = 0,
    limiteCredito = 0,
    cor = '#1e40af',
    icone = 'credit_card'
  } = req.body;

  if (!nome || !tipo) {
    return next(new AppError('Nome e tipo do cartão são obrigatórios', 400));
  }

  try {
    const cartao = await prisma.cartao.create({
      data: {
        usuarioId: req.user.id,
        nome: nome.trim(),
        tipo,
        banco: banco?.trim() || null,
        numero: numero?.trim() || null,
        saldoAtual: parseFloat(saldoAtual),
        limiteCredito: parseFloat(limiteCredito),
        disponivel: parseFloat(saldoAtual),
        cor,
        icone,
        ativo: true,
        bloqueado: false
      }
    });

    res.status(201).json({
      success: true,
      message: 'Cartão adicionado com sucesso!',
      cartao
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return next(new AppError('Já tens um cartão com este número', 409));
    }
    next(err);
  }
};

/**
 * ATUALIZAR CARTÃO
 */
const atualizarCartao = async (req, res, next) => {
  const { id } = req.params;
  const camposPermitidos = ['nome', 'banco', 'cor', 'icone', 'ativo', 'bloqueado'];
  const dados = {};

  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      dados[campo] = req.body[campo];
    }
  }

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nenhum dado válido para atualizar', 400));
  }

  try {
    const cartao = await prisma.cartao.updateMany({
      where: { id, usuarioId: req.user.id },
      data: dados
    });

    if (cartao.count === 0) {
      return next(new AppError('Cartão não encontrado', 404));
    }

    const atualizado = await prisma.cartao.findUnique({ where: { id } });

    res.json({
      success: true,
      message: 'Cartão atualizado com sucesso',
      cartao: atualizado
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ATUALIZAR SALDO DO CARTÃO (usado por gastos/receitas)
 */
const atualizarSaldo = async (req, res, next) => {
  const { id } = req.params;
  const { valor, tipoTransacao } = req.body; // 'despesa' ou 'receita'

  if (!['despesa', 'receita'].includes(tipoTransacao)) {
    return next(new AppError('Tipo de transação inválido. Use "despesa" ou "receita"', 400));
  }

  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0) {
    return next(new AppError('Valor inválido', 400));
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const cartao = await tx.cartao.findFirst({
        where: { id, usuarioId: req.user.id }
      });

      if (!cartao) throw new AppError('Cartão não encontrado', 404);
      if (!cartao.ativo) throw new AppError('Este cartão está inativo', 400);

      if (tipoTransacao === 'despesa') {
        const disponivel = cartao.saldoAtual - (cartao.reservado || 0);
        if (disponivel < valorNum) {
          throw new AppError(`Saldo insuficiente no cartão ${cartao.nome}`, 400);
        }
      }

      const novoSaldo = tipoTransacao === 'despesa'
        ? cartao.saldoAtual - valorNum
        : cartao.saldoAtual + valorNum;

      const atualizado = await tx.cartao.update({
        where: { id },
        data: { saldoAtual: novoSaldo }
      });

      return atualizado;
    });

    res.json({
      success: true,
      message: 'Saldo atualizado com sucesso',
      cartao: resultado
    });

  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Erro ao atualizar saldo', 500));
  }
};

/**
 * DELETAR CARTÃO (só se não tiver transações)
 */
const deletarCartao = async (req, res, next) => {
  const { id } = req.params;

  try {
    const atualizado = await prisma.gasto.update({
      where: { id, usuarioId: req.user.id },
      data: { excluido: true }
    });

    // Invalida cache se tiver
    await invalidarCacheUsuario(req.user.id);

    res.json({
      success: true,
      message: 'Gasto removido com sucesso (movido para lixeira)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listarCartoes,
  criarCartao,
  atualizarCartao,
  atualizarSaldo,
  deletarCartao
};