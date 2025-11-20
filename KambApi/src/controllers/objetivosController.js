// src/controllers/objetivosController.js
const Objetivo = require('../models/Objetivo');
const Cartao = require('../models/Cartao');
const { AppError } = require('../middleware/errorHandler');
const { successResponse, createdResponse } = require('../utils/responseFormatter');

/**
 * ==========================================
 * LISTAR TODOS OS OBJETIVOS + DASHBOARD
 * ==========================================
 */
const listarObjetivos = async (req, res, next) => {
  try {
    const dashboard = await Objetivo.getDashboard(req.usuarioId);

    return successResponse(res, {
      mensagem: 'Objetivos carregados com sucesso',
      ...dashboard
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * CRIAR NOVO OBJETIVO
 * ==========================================
 */
const criarObjetivo = async (req, res, next) => {
  try {
    const {
      titulo,
      descricao,
      categoria,
      valorAlvo,
      dataPrevista,
      prioridade = 'media',
      cor,
      icone,
      porcentagemDistribuicao = 0,
      modoDistribuicao = 'automatico'
    } = req.body;

    const objetivo = await Objetivo.create({
      usuario: req.usuarioId,
      titulo,
      descricao: descricao || '',
      categoria,
      valorAlvo,
      dataPrevista,
      prioridade,
      cor: cor || '#10b981',
      icone: icone || 'target',
      porcentagemDistribuicao,
      modoDistribuicao
    });

    return createdResponse(res, {
      mensagem: 'Objetivo criado com sucesso! Vamos lá, kamba! 🔥',
      objetivo: objetivo.toDashboard()
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * ATUALIZAR OBJETIVO
 * ==========================================
 */
const atualizarObjetivo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const camposPermitidos = [
      'titulo', 'descricao', 'valorAlvo', 'dataPrevista',
      'prioridade', 'cor', 'icone', 'porcentagemDistribuicao',
      'modoDistribuicao', 'ativo'
    ];

    const atualizacoes = {};
    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) atualizacoes[campo] = req.body[campo];
    });

    if (Object.keys(atualizacoes).length === 0) {
      return next(new AppError('Nada para atualizar', 400));
    }

    const objetivo = await Objetivo.findOneAndUpdate(
      { _id: id, usuario: req.usuarioId },
      atualizacoes,
      { new: true, runValidators: true }
    );

    if (!objetivo) return next(new AppError('Objetivo não encontrado', 404));

    return successResponse(res, {
      mensagem: 'Objetivo atualizado',
      objetivo: objetivo.toDashboard()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * ADICIONAR PROGRESSO MANUAL
 * ==========================================
 */
const adicionarProgresso = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { valor } = req.body;

    if (!valor || valor <= 0) {
      return next(new AppError('Valor deve ser positivo', 400));
    }

    const objetivo = await Objetivo.findOne({ _id: id, usuario: req.usuarioId });
    if (!objetivo) return next(new AppError('Objetivo não encontrado', 404));
    if (!objetivo.ativo) return next(new AppError('Objetivo inativo', 400));

    await objetivo.adicionarProgresso(valor);

    return successResponse(res, {
      mensagem: `Progresso adicionado! Faltam ${objetivo.valorFaltante.toLocaleString('pt-AO')} AOA`,
      objetivo: objetivo.toDashboard()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * DISTRIBUIR POUPANÇA AUTOMÁTICA
 * ==========================================
 */
const distribuirPoupanca = async (req, res, next) => {
  try {
    // 1. Calcula poupança líquida do mês (receitas - despesas)
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const fimMes = new Date();
    fimMes.setMonth(fimMes.getMonth() + 1);
    fimMes.setDate(0);

    const gastos = await require('../models/Gasto').aggregate([
      {
        $match: {
          usuario: req.usuarioId,
          data: { $gte: inicioMes, $lte: fimMes },
          excluido: false
        }
      },
      {
        $group: {
          _id: '$tipo',
          total: { $sum: '$valor' }
        }
      }
    ]);

    let receitas = 0, despesas = 0;
    gastos.forEach(g => {
      if (g._id === 'receita') receitas = g.total;
      if (g._id === 'despesa') despesas = g.total;
    });

    const poupancaDisponivel = receitas - despesas;
    if (poupancaDisponivel <= 0) {
      return successResponse(res, {
        mensagem: 'Sem poupança este mês. Continua a lutar, kamba! 💪',
        poupancaDisponivel,
        distribuidos: []
      });
    }

    // 2. Busca objetivos ativos com distribuição automática
    const objetivos = await Objetivo.find({
      usuario: req.usuarioId,
      ativo: true,
      modoDistribuicao: 'automatico',
      porcentagemDistribuicao: { $gt: 0 }
    });

    if (objetivos.length === 0) {
      return successResponse(res, {
        mensagem: 'Poupança disponível, mas sem objetivos automáticos configurados',
        poupancaDisponivel
      });
    }

    // 3. Distribui proporcionalmente
    const distribuidos = [];
    for (const obj of objetivos) {
      const valor = Math.round(poupancaDisponivel * (obj.porcentagemDistribuicao / 100));
      if (valor > 0) {
        await obj.adicionarProgresso(valor);
        distribuidos.push({
          objetivo: obj.titulo,
          valor,
          progressoAnterior: obj.progressoPercentual - (valor / obj.valorAlvo) * 100,
          progressoAtual: obj.progressoPercentual
        });
      }
    }

    return successResponse(res, {
      mensagem: `Poupança distribuída automaticamente! ${poupancaDisponivel.toLocaleString('pt-AO')} AOA investidos no teu futuro 🇦🇴`,
      poupancaDisponivel,
      distribuidos
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * DELETAR OBJETIVO
 * ==========================================
 */
const deletarObjetivo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const objetivo = await Objetivo.findOneAndDelete({ _id: id, usuario: req.usuarioId });

    if (!objetivo) return next(new AppError('Objetivo não encontrado', 404));

    return successResponse(res, { mensagem: 'Objetivo removido' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listarObjetivos,
  criarObjetivo,
  atualizarObjetivo,
  adicionarProgresso,
  distribuirPoupanca,
  deletarObjetivo
};