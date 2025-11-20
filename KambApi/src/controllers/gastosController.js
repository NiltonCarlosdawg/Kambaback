// src/controllers/gastosController.js
const Gasto = require('../models/Gasto');
const Cartao = require('../models/Cartao');
const Objetivo = require('../models/Objetivo');
const { AppError } = require('../middleware/errorHandler');
const { successResponse, createdResponse } = require('../utils/responseFormatter');

/**
 * ==========================================
 * CRIAR NOVO GASTO / RECEITA
 * ==========================================
 */
const criarGasto = async (req, res, next) => {
  try {
    const {
      cartao: cartaoId,
      tipo,
      valor,
      descricao,
      categoria,
      data,
      local,
      parcelado,
      objetivo: objetivoId,
      tags
    } = req.body;

    const usuarioId = req.usuarioId;

    // 1. Busca e valida cartão
    const cartao = await Cartao.findOne({ _id: cartaoId, usuario: usuarioId, ativo: true });
    if (!cartao) return next(new AppError('Cartão inválido ou inativo', 400));

    // 2. Verifica saldo (só para despesas)
    if (tipo === 'despesa' && !cartao.podeGastar(valor)) {
      return next(new AppError(`Saldo insuficiente no cartão ${cartao.nome}`, 400));
    }

    // 3. Cria o gasto
    const gasto = await Gasto.create({
      usuario: usuarioId,
      cartao: cartaoId,
      tipo,
      valor,
      descricao: descricao || '',
      categoria,
      categoriaPersonalizada: null, // será validado no service depois se necessário
      data: data || new Date(),
      local,
      parcelado: parcelado || { totalParcelas: 1, parcelaAtual: 1, recorrencia: 'unica' },
      objetivo: objetivoId || null,
      tags: tags || [],
      cartaoDestino: null // para transferências, implementamos depois
    });

    // 4. Atualiza saldo do cartão
    await cartao.atualizarSaldo(valor, tipo);

    // 5. Se estiver ligado a objetivo → adiciona progresso
    if (objetivoId && tipo === 'receita') {
      await Objetivo.findByIdAndUpdate(objetivoId, {
        $inc: { valorAtual: valor }
      });
    }

    return createdResponse(res, {
      mensagem: tipo === 'despesa' 
        ? 'Gasto registrado com sucesso! 💸' 
        : 'Receita registrada com sucesso! 🤑',
      gasto: await gasto.populate('cartao', 'nome tipo cor').execPopulate()
    }, `/api/gastos/${gasto._id}`);

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * LISTAR GASTOS COM FILTROS
 * ==========================================
 */
const listarGastos = async (req, res, next) => {
  try {
    const {
      pagina = 1,
      limite = 20,
      tipo,
      categoria,
      cartao,
      dataInicio,
      dataFim,
      busca
    } = req.query;

    const filtro = { usuario: req.usuarioId, excluido: false };

    if (tipo) filtro.tipo = tipo;
    if (categoria) filtro.categoria = categoria;
    if (cartao) filtro.cartao = cartao;
    if (dataInicio || dataFim) {
      filtro.data = {};
      if (dataInicio) filtro.data.$gte = new Date(dataInicio);
      if (dataFim) filtro.data.$lte = new Date(dataFim);
    }
変換
    if (busca) {
      filtro.$or = [
        { descricao: { $regex: busca, $options: 'i' } },
        { local: { $regex: busca, $options: 'i' } },
        { tags: { $in: [new RegExp(busca, 'i')] } }
      ];
    }

    const total = await Gasto.countDocuments(filtro);
    const gastos = await Gasto.find(filtro)
      .sort({ data: -1 })
      .skip((pagina - 1) * limite)
      .limit(parseInt(limite))
      .populate('cartao', 'nome tipo cor icone')
      .populate('objetivo', 'titulo cor');

    return successResponse(res, {
      mensagem: 'Gastos carregados',
      gastos: gastos.map(g => g.toResponse ? g.toResponse() : g),
      paginacao: {
        pagina: parseInt(pagina),
        limite: parseInt(limite),
        total,
        paginas: Math.ceil(total / limite)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * GASTOS POR CATEGORIA (RESUMO)
 * ==========================================
 */
const gastosPorCategoria = async (req, res, next) => {
  try {
    const { mes, ano } = req.query;
    const inicio = mes && ano ? new Date(ano, mes - 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const fim = mes && ano ? new Date(ano, mes, 0, 23, 59, 59) : new Date();

    const resultado = await Gasto.aggregate([
      {
        $match: {
          usuario: req.usuarioId,
          data: { $gte: inicio, $lte: fim },
          tipo: 'despesa',
          excluido: false
        }
      },
      {
        $group: {
          _id: '$categoria',
          total: { $sum: '$valor' },
          quantidade: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const totalDespesas = resultado.reduce((acc, c) => acc + c.total, 0);

    return successResponse(res, {
      mensagem: 'Resumo por categoria',
      periodo: `${inicio.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' })}`,
      totalDespesas,
      categorias: resultado.map(c => ({
        categoria: c._id,
        total: c.total,
        porcentagem: totalDespesas > 0 ? Math.round((c.total / totalDespesas) * 100) : 0,
        quantidade: c.quantidade
      }))
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * DELETAR GASTO (soft delete)
 * ==========================================
 */
const deletarGasto = async (req, res, next) => {
  try {
    const { id } = req.params;

    const gasto = await Gasto.findOne({ _id: id, usuario: req.usuarioId });
    if (!gasto) return next(new AppError('Gasto não encontrado', 404));

    await gasto.softDelete();

    // Reverte o saldo no cartão
    const cartao = await Cartao.findById(gasto.cartao);
    if (cartao) {
      await cartao.atualizarSaldo(gasto.valor, gasto.tipo === 'despesa' ? 'receita' : 'despesa');
    }

    return successResponse(res, { mensagem: 'Gasto removido com sucesso' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  criarGasto,
  listarGastos,
  gastosPorCategoria,
  deletarGasto
};