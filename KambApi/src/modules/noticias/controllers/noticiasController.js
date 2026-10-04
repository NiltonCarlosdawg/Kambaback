// src/controllers/noticiasController.js
const noticiaService = require('../services/noticiasService');

/**
 * Retorna as últimas notícias (com cache e fallback)
 */
const ultimas = async (req, res, next) => {
  try {
    const categoria = req.query.categoria || 'angola'; // F-016: default real do serviço ('business' não existe)
    const resultado = await noticiaService.buscarNoticias(categoria);

    res.json({
      success: true,
      data: resultado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retorna um resumo das notícias gerado por IA
 */
const resumo = async (req, res, next) => {
  try {
    const categoria = req.query.categoria || 'angola'; // F-016: default real do serviço ('business' não existe)
    const resultado = await noticiaService.gerarResumoIA(categoria);

    res.json({
      success: true,
      data: resultado
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retorna um alerta de impacto das notícias nas finanças do utilizador
 */
const impacto = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const resultado = await noticiaService.verificarImpactoFinanceiro(usuarioId);

    res.json({
      success: true,
      impacto: resultado
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { ultimas, resumo, impacto };
