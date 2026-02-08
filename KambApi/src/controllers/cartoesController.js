// src/controllers/cartoesController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');
const { invalidarCacheUsuario } = require('./insightsController');

/**
 * LISTAR TODOS OS CARTÕES DO USUÁRIO
 */
const listarCartoes = async (req, res, next) => {
  try {
    const cartoes = await prisma.cartao.findMany({
      where: {
        usuarioId: req.user.id,
        ativo: true,
        excluido: false
      },
      orderBy: { criadoEm: 'desc' }
    });

    // Cálculo dos totais usando Decimal corretamente
    let totalSaldo = 0;
    let totalDisponivel = 0;
    let totalReservado = 0;

    cartoes.forEach(c => {
      totalSaldo += Number(c.saldoAtual) || 0;
      totalDisponivel += Number(c.saldoDisponivel) || 0;
      totalReservado += Number(c.saldoReservado) || 0;
    });

    res.json({
      success: true,
      message: 'Cartões carregados com sucesso',
      cartoes,
      resumo: {
        totalCartoes: cartoes.length,
        saldoTotal: totalSaldo,
        disponivelTotal: totalDisponivel,
        reservadoTotal: totalReservado
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
    icone = 'credit_card',
    distribuirParaObjetivos = false
  } = req.body;

  if (!nome || !tipo) {
    return next(new AppError('Nome e tipo do cartão são obrigatórios', 400));
  }

  // Validar tipo do enum
  const tiposValidos = ['DEBITO', 'CREDITO', 'POUPANCA'];
  if (!tiposValidos.includes(tipo)) {
    return next(new AppError('Tipo de cartão inválido. Use: DEBITO, CREDITO ou POUPANCA', 400));
  }

  try {
    if (numero) {
      const existe = await prisma.cartao.findFirst({
        where: {
          usuarioId: req.user.id,
          numero: numero.trim(),
          excluido: false
        }
      });

      if (existe) {
        return next(new AppError('Já tens um cartão com este número', 409));
      }
    }

    const saldoInicial = parseFloat(saldoAtual) || 0;

    const cartao = await prisma.cartao.create({
      data: {
        usuarioId: req.user.id,
        nome: nome.trim(),
        tipo,
        banco: banco?.trim() || null,
        numero: numero?.trim() || null,
        saldoAtual: saldoInicial,
        saldoDisponivel: saldoInicial, // Inicialmente disponível = saldo
        saldoReservado: 0,
        limiteCredito: parseFloat(limiteCredito) || 0,
        cor,
        icone,
        distribuirParaObjetivos: !!distribuirParaObjetivos,
        ativo: true,
        excluido: false
      }
    });

    await invalidarCacheUsuario(req.user.id);

    res.status(201).json({
      success: true,
      message: 'Cartão adicionado com sucesso!',
      cartao
    });

  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('Já tens um cartão com este número', 409));
    next(err);
  }
};

/**
 * ATUALIZAR CARTÃO (Campos permitidos)
 */
const atualizarCartao = async (req, res, next) => {
  const { id } = req.params;
  
  // Removido 'bloqueado' - esse campo só existe no User, não no Cartao
  const camposPermitidos = [
    'nome', 'banco', 'cor', 'icone', 'ativo', 
    'distribuirParaObjetivos', 'limiteCredito'
  ];
  
  const dados = {};

  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      if (campo === 'distribuirParaObjetivos' || campo === 'ativo') {
        dados[campo] = !!req.body[campo];
      } else if (campo === 'limiteCredito') {
        dados[campo] = parseFloat(req.body[campo]) || 0;
      } else {
        dados[campo] = req.body[campo]?.trim?.() || req.body[campo];
      }
    }
  }

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nenhum dado válido para atualizar', 400));
  }

  try {
    const cartao = await prisma.cartao.updateMany({
      where: { 
        id, 
        usuarioId: req.user.id,
        excluido: false 
      },
      data: dados
    });

    if (cartao.count === 0) {
      return next(new AppError('Cartão não encontrado', 404));
    }

    const atualizado = await prisma.cartao.findUnique({ where: { id } });

    if (dados.ativo !== undefined || dados.distribuirParaObjetivos !== undefined) {
      await invalidarCacheUsuario(req.user.id);
    }

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
 * ATUALIZAR SALDO DO CARTÃO (Ajustado para Decimal e campos novos)
 */
const atualizarSaldo = async (req, res, next) => {
  const { id } = req.params;
  const { valor, tipoTransacao } = req.body;

  if (!['DESPESA', 'RECEITA'].includes(tipoTransacao)) {
    return next(new AppError('Tipo de transação inválido. Use "DESPESA" ou "RECEITA"', 400));
  }

  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0) {
    return next(new AppError('Valor inválido', 400));
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const cartao = await tx.cartao.findFirst({
        where: { id, usuarioId: req.user.id, ativo: true, excluido: false }
      });

      if (!cartao) throw new AppError('Cartão não encontrado ou inativo', 404);

      const saldoAtual = Number(cartao.saldoAtual);
      const saldoDisponivel = Number(cartao.saldoDisponivel);
      const saldoReservado = Number(cartao.saldoReservado);

      let novoSaldo, novoDisponivel;

      if (tipoTransacao === 'DESPESA') {
        // Verifica saldo disponível (desconsidera o reservado)
        if (saldoDisponivel < valorNum) {
          throw new AppError(`Saldo disponível insuficiente no cartão ${cartao.nome}. Disponível: ${saldoDisponivel}`, 400);
        }
        novoSaldo = saldoAtual - valorNum;
        novoDisponivel = saldoDisponivel - valorNum;
        // Reservado permanece igual em despesas normais
      } else {
        // RECEITA
        novoSaldo = saldoAtual + valorNum;
        novoDisponivel = saldoDisponivel + valorNum;
      }

      return await tx.cartao.update({
        where: { id },
        data: { 
          saldoAtual: novoSaldo,
          saldoDisponivel: novoDisponivel
        }
      });
    });

    await invalidarCacheUsuario(req.user.id);

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
 * DELETAR CARTÃO
 */
const deletarCartao = async (req, res, next) => {
  const { id } = req.params;

  try {
    const cartao = await prisma.cartao.findFirst({
      where: { id, usuarioId: req.user.id, excluido: false }
    });

    if (!cartao) return next(new AppError('Cartão não encontrado', 404));

    const transacoes = await prisma.gasto.count({
      where: { cartaoId: id, usuarioId: req.user.id, excluido: false }
    });

    if (transacoes > 0) {
      return next(new AppError(
        `Não é possível deletar este cartão porque existem ${transacoes} transações associadas.`, 
        409
      ));
    }

    await prisma.cartao.update({
      where: { id },
      data: { ativo: false, excluido: true, numero: null }
    });

    await invalidarCacheUsuario(req.user.id);

    res.json({ success: true, message: 'Cartão removido com sucesso' });

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