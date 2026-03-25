const insightsRouter = require('../../insights/routes/insights');
const express = require('express');
const router = express.Router();

const {
  resumoDashboard,
  historicoMensal,  // Agora suporta múltiplos períodos
  topCategorias
} = require('../../insights/controllers/insightsController');

const { protegerRota } = require('../../../middleware/auth');

// ==========================================
// TODAS AS ROTAS SÃO PROTEGIDAS
// ==========================================
router.use(protegerRota);

// ==========================================
// ROTAS DO DASHBOARD / INSIGHTS
// ==========================================

// Dashboard principal + alertas
router.get('/resumo', resumoDashboard);


router.get('/historico', historicoMensal);

// Top 5 categorias do mês
router.get('/top-categorias', topCategorias);

module.exports = router;

// Reexporta o mesmo router - funciona como alias perfeito
module.exports = insightsRouter;