// src/controllers/cartoesController.js
const Cartao = require('../models/Cartao');
const { AppError } = require('../middleware/errorHandler');
const { successResponse, createdResponse } = require('../utils/responseFormatter');

/**
 * ==========================================
 * LISTAR TODOS OS CARTÕES DO USUÁRIO
 * ==========================================
 */
const listarCartoes = async (req, res, next) => {
  try {
    const cartoes = await Cartao.find({
      usuario: req.usuarioId,
      ativo: true
    }).sort({ criadoEm: -1 });

    const totalSaldo = cartoes.reduce((acc, c) => acc + c.saldoAtual, 0);
    const totalDisponivel = cartoes.reduce((acc, c) => acc + c.disponivel, 0);

    return successResponse(res, {
      mensagem: 'Cartões carregados com sucesso',
      cartoes: cartoes.map(c => c.toPublic ? c.toPublic() : c),
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
 * ==========================================
 * CRIAR NOVO CARTÃO
 * ==========================================
 */
const criarCartao = async (req, res, next) => {
  try {
    const { nome, tipo, banco, numero, saldoAtual = 0, limiteCredito = 0, cor, icone } = req.body;

    const cartao = await Cartao.create({
      usuario: req.usuarioId,
      nome,
      tipo,
      banco: banco || null,
      numero: numero || null,
      saldoAtual,
      limiteCredito,
      cor: cor || '#1e40af',
      icone: icone || 'credit_card'
    });

    return createdResponse(res, {
      mensagem: 'Cartão adicionado com sucesso! 💳',
      cartao: cartao.toPublic()
    }, `/api/cartoes/${cartao._id}`);
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError('Já tens um cartão com este número', 409));
    }
    next(err);
  }
};

/**
 * ==========================================
 * ATUALIZAR CARTÃO
 * ==========================================
 */
const atualizarCartao = async (req, res, next) => {
  try {
    const { id } = req.params;
    const camposPermitidos = ['nome', 'banco', 'cor', 'icone', 'ativo', 'bloqueado'];

    const atualizacoes = {};
    Object.keys(req.body).forEach(key => {
      if (camposPermitidos.includes(key)) {
        atualizacoes[key] = req.body[key];
      }
    });

    if (Object.keys(atualizacoes).length === 0) {
      return next(new AppError('Nenhum dado válido para atualizar', 400));
    }

    const cartao = await Cartao.findOneAndUpdate(
      { _id: id, usuario: req.usuarioId },
      atualizacoes,
      { new: true, runValidators: true }
    );

    if (!cartao) {
      return next(new AppError('Cartão não encontrado', 404));
    }

    return successResponse(res, {
      mensagem: 'Cartão atualizado com sucesso',
      cartao: cartao.toPublic()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * ATUALIZAR SALDO (usado por gastos e receitas)
 * ==========================================
 */
const atualizarSaldo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { valor, tipoTransacao } = req.body; // 'despesa' ou 'receita'

    if (!['despesa', 'receita'].includes(tipoTransacao)) {
      return next(new AppError('Tipo de transação inválido', 400));
    }

    const cartao = await Cartao.findOne({ _id: id, usuario: req.usuarioId });
    if (!cartao) {
      return next(new AppError('Cartão não encontrado', 404));
    }

    if (!cartao.ativo) {
      return next(new AppError('Este cartão está inativo', 400));
    }

    if (tipoTransacao === 'despesa' && !cartao.podeGastar(valor)) {
      return next(new AppError('Saldo insuficiente', 400));
    }

    await cartao.atualizarSaldo(valor, tipoTransacao);

    return successResponse(res, {
      mensagem: 'Saldo atualizado com sucesso',
      cartao: cartao.toPublic()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * DELETAR CARTÃO (só se não tiver gastos)
 * ==========================================
 */
const deletarCartao = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cartao = await Cartao.findOne({ _id: id, usuario: req.usuarioId });
    if (!cartao) {
      return next(new AppError('Cartão não encontrado', 404));
    }

    // Verifica se tem gastos
    const temGastos = await require('../models/Gasto').countDocuments({ cartao: id, excluido: false });
    if (temGastos > 0) {
      return next(new AppError('Não podes apagar um cartão com transações. Desativa-o.', 400));
    }

    await cartao.deleteOne();

    return successResponse(res, { mensagem: 'Cartão removido com sucesso' });
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