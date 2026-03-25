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


router.get('/', listarObjetivos);

router.post('/', criarObjetivo);


router.put('/:id', atualizarObjetivo);

// Deletar objetivo (soft delete)
router.delete('/:id', deletarObjetivo);


router.post('/distribuir-poupanca', distribuirPoupanca);



module.exports = router;