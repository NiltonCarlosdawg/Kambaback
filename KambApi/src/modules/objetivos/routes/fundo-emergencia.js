// src/routes/fundo-emergencia.js
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { validar } = require('../../../middleware/validator');
const { protegerRota } = require('../../../middleware/auth');

const {
  obterFundo,
  criarFundo,
  depositar,
  levantar,
  desativar,
  historico
} = require('../controllers/fundoEmergenciaController');

// ==========================================
// SCHEMAS DE VALIDAÇÃO
// ==========================================

const criarFundoSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(100).trim().default('Fundo de Emergência'),
    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .default('#f59e0b')
      .messages({ 'string.pattern.base': 'Cor inválida (use formato hexadecimal)' }),
    icone: Joi.string().max(50).default('shield')
  })
);

const depositarSchema = validar(
  Joi.object({
    cartaoOrigemId: Joi.string().required()
      .messages({ 'any.required': 'Cartão de origem é obrigatório' }),
    valor: Joi.number().positive().required()
      .messages({
        'any.required': 'Valor é obrigatório',
        'number.positive': 'O valor deve ser positivo'
      })
  })
);

const levantarSchema = validar(
  Joi.object({
    cartaoDestinoId: Joi.string().required()
      .messages({ 'any.required': 'Cartão de destino é obrigatório' }),
    valor: Joi.number().positive().required()
      .messages({
        'any.required': 'Valor é obrigatório',
        'number.positive': 'O valor deve ser positivo'
      }),
    motivo: Joi.string().max(200).trim().optional()
      .messages({ 'string.max': 'Motivo deve ter no máximo 200 caracteres' })
  })
);

// ==========================================
// TODAS AS ROTAS PROTEGIDAS
// ==========================================
router.use(protegerRota);

// GET  /fundo-emergencia           → Status e métricas do fundo
router.get('/', obterFundo);

// GET  /fundo-emergencia/historico → Histórico de movimentos
router.get('/historico', historico);

// POST /fundo-emergencia           → Criar o fundo (inactivo)
router.post('/', criarFundoSchema, criarFundo);

// POST /fundo-emergencia/depositar → Depositar (activa se >= 100.000 Kz)
router.post('/depositar', depositarSchema, depositar);

// POST /fundo-emergencia/levantar  → Levantar (desactiva se saldo < 100.000 Kz)
router.post('/levantar', levantarSchema, levantar);

// PATCH /fundo-emergencia/desactivar → Desactivar manualmente
router.patch('/desactivar', desativar);

module.exports = router;