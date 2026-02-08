// src/routes/categorias.js
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
// SCHEMAS DE VALIDAÇÃO JOI - ATUALIZADOS
// ==========================================
const criarSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(40).trim().required()
      .messages({ 
        'any.required': 'Nome da categoria é obrigatório',
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome deve ter no máximo 40 caracteres'
      }),

    tipo: Joi.string()
      .trim()
      .uppercase() // Converte para maiúsculas antes de validar
      .valid('ESSENCIAL', 'FLEXIVEL', 'POUPANCA', 'RENDIMENTO')
      .required()
      .messages({ 
        'any.required': 'Tipo é obrigatório',
        'any.only': 'Tipo deve ser: ESSENCIAL, FLEXIVEL, POUPANCA ou RENDIMENTO'
      }),

    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .optional()
      .messages({ 'string.pattern.base': 'Cor deve ser um código hexadecimal válido (ex: #FF6384)' }),

    icone: Joi.string().max(50).optional()
      .messages({ 'string.max': 'Nome do ícone deve ter no máximo 50 caracteres' })
  })
);

const atualizarSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(40).trim().optional()
      .messages({ 
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome deve ter no máximo 40 caracteres'
      }),
    
    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .optional()
      .messages({ 'string.pattern.base': 'Cor deve ser hexadecimal (ex: #FF6384)' }),
    
    icone: Joi.string().max(50).optional()
      .messages({ 'string.max': 'Nome do ícone deve ter no máximo 50 caracteres' }),
    
    ordem: Joi.number().integer().min(0).optional()
      .messages({
        'number.min': 'Ordem deve ser um número positivo',
        'number.integer': 'Ordem deve ser um número inteiro'
      }),
    
    ativa: Joi.boolean().optional()
  })
  .min(1)
  .messages({ 'object.min': 'Pelo menos um campo deve ser enviado para atualização' })
);

// ==========================================
// ROTAS
// ==========================================
router.get('/', listarCategorias);           // Retorna categorias padrão + personalizadas
router.post('/', criarSchema, criarCategoria);
router.patch('/:id', atualizarSchema, atualizarCategoria);
router.delete('/:id', deletarCategoria);

// Exportar router corretamente
module.exports = router;