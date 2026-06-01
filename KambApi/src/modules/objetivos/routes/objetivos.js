// src/routes/objetivos.js
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { protegerRota } = require('../../../middleware/auth');
const { validar } = require('../../../middleware/validator');
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


const distribuirPoupancaSchema = validar(
  Joi.object({
    valorTotal: Joi.number().positive().required(),
    cartaoId: Joi.string().required(),
  }),
);

router.post('/distribuir-poupanca', distribuirPoupancaSchema, distribuirPoupanca);



module.exports = router;
