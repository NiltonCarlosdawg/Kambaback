const express = require('express');
const router = express.Router();

const {
  resumoDashboard,
  historicoMensal,
  topCategorias
} = require('../controllers/insightsController');

const { protegerRota } = require('../middleware/auth');

// ==========================================
// TODAS AS ROTAS SÃO PROTEGIDAS
// ==========================================
router.use(protegerRota);

// ==========================================
// ROTAS DO DASHBOARD / INSIGHTS
// ==========================================
router.get('/resumo', resumoDashboard);          // Dashboard principal + alertas
router.get('/historico', historicoMensal);       // Gráfico de evolução (24 meses)
router.get('/top-categorias', topCategorias);    // Top 5 categorias do mês

// Exportar router corretamente
module.exports = router;
