// src/routes/objetivos.js
const express = require('express');
const router = express.Router();
const { protegerRota } = require('../../../middleware/auth');
const {
  listarObjetivos,
  criarObjetivo,
  atualizarObjetivo,
  distribuirPoupanca,
  deletarObjetivo
} = require('../controllers/objetivosController');

// Todas as rotas protegidas
router.use(protegerRota);

// ==========================================
// ROTAS CRUD BÁSICAS
// ==========================================

// Listar todos os objetivos
router.get('/', listarObjetivos);

// Criar novo objetivo
router.post('/', criarObjetivo);

// ✅ CORREÇÃO: Usar PUT para atualização completa (ou PATCH se preferir)
router.put('/:id', atualizarObjetivo);

// Deletar objetivo (soft delete)
router.delete('/:id', deletarObjetivo);

// ==========================================
// ROTAS ESPECÍFICAS
// ==========================================

// Distribuir poupança automática
router.post('/distribuir-poupanca', distribuirPoupanca);

// ✅ Se tiver rota PATCH para progresso parcial, descomente:
// router.patch('/:id/progresso', adicionarProgresso);

module.exports = router;