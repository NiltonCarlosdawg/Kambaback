// src/controllers/categoriasController.js
const Categoria = require('../models/Categoria');
const { AppError } = require('../middleware/errorHandler');
const { successResponse, createdResponse } = require('../utils/responseFormatter');

/**
 * ==========================================
 * LISTAR TODAS AS CATEGORIAS (padrão + personalizadas)
 * ==========================================
 */
const listarCategorias = async (req, res, next) => {
  try {
    const resultado = await Categoria.getAllByUsuario(req.usuarioId);

    return successResponse(res, {
      mensagem: 'Categorias carregadas com sucesso',
      ...resultado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * CRIAR CATEGORIA PERSONALIZADA
 * ==========================================
 */
const criarCategoria = async (req, res, next) => {
  try {
    const { nome, tipo, cor, icone } = req.body;

    const categoria = await Categoria.create({
      usuario: req.usuarioId,
      nome,
      tipo,
      cor: cor || undefined,
      icone: icone || 'category'
    });

    return createdResponse(res, {
      mensagem: 'Categoria criada com sucesso! 🎯',
      categoria: categoria.toResponse()
    });
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError('Já tens uma categoria com este nome', 409));
    }
    next(err);
  }
};

/**
 * ==========================================
 * ATUALIZAR CATEGORIA PERSONALIZADA
 * ==========================================
 */
const atualizarCategoria = async (req, res, next) => {
  try {
    const { id } = req.params;
    const campos = ['nome', 'cor', 'icone', 'ordem', 'ativa'];

    const atualizacoes = {};
    campos.forEach(campo => {
      if (req.body[campo] !== undefined) atualizacoes[campo] = req.body[campo];
    });

    if (Object.keys(atualizacoes).length === 0) {
      return next(new AppError('Nada para atualizar', 400));
    }

    const categoria = await Categoria.findOneAndUpdate(
      { _id: id, usuario: req.usuarioId },
      atualizacoes,
      { new: true }
    );

    if (!categoria) return next(new AppError('Categoria não encontrada', 404));

    return successResponse(res, {
      mensagem: 'Categoria atualizada',
      categoria: categoria.toResponse()
    });
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * DELETAR CATEGORIA PERSONALIZADA (só se não estiver em uso)
 * ==========================================
 */
const deletarCategoria = async (req, res, next) => {
  try {
    const { id } = req.params;

    const categoria = await Categoria.findOne({ _id: id, usuario: req.usuarioId });
    if (!categoria) return next(new AppError('Categoria não encontrada', 404));

    // Verifica se está em uso
    const emUso = await require('../models/Gasto').countDocuments({
      usuario: req.usuarioId,
      categoriaPersonalizada: id,
      excluido: false
    });

    if (emUso > 0) {
      return next(new AppError('Não podes apagar uma categoria em uso. Desativa-a.', 400));
    }

    await categoria.deleteOne();

    return successResponse(res, { mensagem: 'Categoria removida com sucesso' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria
};