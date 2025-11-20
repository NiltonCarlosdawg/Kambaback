const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { validar } = require('../middleware/validator');

const {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria
} = require('../controllers/categoriasController');

const { protegerRota } = require('../middleware/auth');

// ==========================================
// TODAS AS ROTAS SÃO PROTEGIDAS
// ==========================================
router.use(protegerRota);

// ==========================================
// SCHEMAS DE VALIDAÇÃO JOI
// ==========================================
const criarSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(40).required()
      .messages({ 'any.required': 'Nome da categoria é obrigatório' }),

    tipo: Joi.string().valid('despesa', 'receita').required()
      .messages({ 'any.required': 'Tipo (despesa ou receita) é obrigatório' }),

    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .optional()
      .messages({ 'string.pattern.base': 'Cor deve ser um código hexadecimal válido (ex: #FF6384)' }),

    icone: Joi.string().optional()
  })
);

const atualizarSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(40),
    cor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    icone: Joi.string(),
    ordem: Joi.number().integer(),
    ativa: Joi.boolean()
  })
  .min(1)
  .messages({ 'object.min': 'Pelo menos um campo deve ser enviado para atualização' })
);

// ==========================================
// ROTAS
// ==========================================
router.get('/', listarCategorias);        // → retorna categorias padrão + personalizadas
router.post('/', criarSchema, criarCategoria);
router.patch('/:id', atualizarSchema, atualizarCategoria);
router.delete('/:id', deletarCategoria);

// Exportar router corretamente
module.exports = router;
