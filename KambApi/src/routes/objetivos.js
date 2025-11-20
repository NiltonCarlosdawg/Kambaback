const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { validar } = require('../middleware/validator');

const {
  listarObjetivos,
  criarObjetivo,
  atualizarObjetivo,
  adicionarProgresso,
  distribuirPoupanca,
  deletarObjetivo
} = require('../controllers/objetivosController');

const { protegerRota } = require('../middleware/auth');

// ==========================================
// TODAS AS ROTAS SÃO PROTEGIDAS
// ==========================================
router.use(protegerRota);

// ==========================================
// SCHEMAS DE VALIDAÇÃO JOI
// ==========================================
const criarObjetivoSchema = validar(
  Joi.object({
    titulo: Joi.string().min(3).max(80).required()
      .messages({ 'any.required': 'Título do objetivo é obrigatório' }),

    descricao: Joi.string().max(300).allow('').optional(),

    categoria: Joi.string()
      .valid('casa', 'carro', 'educacao', 'viagem', 'emergencia',
             'negocio', 'casamento', 'aposentadoria', 'outro')
      .required(),

    valorAlvo: Joi.number().min(1000).required(),

    dataPrevista: Joi.date().greater('now').required()
      .messages({ 'date.greater': 'Data prevista deve ser no futuro' }),

    prioridade: Joi.string()
      .valid('baixa', 'media', 'alta', 'urgente')
      .default('media'),

    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .default('#10b981'),

    icone: Joi.string().default('target'),

    porcentagemDistribuicao: Joi.number().integer().min(0).max(100).default(0),

    modoDistribuicao: Joi.string().valid('automatico', 'manual').default('automatico')
  })
);

const adicionarProgressoSchema = validar(
  Joi.object({
    valor: Joi.number().positive().required()
      .messages({ 'number.positive': 'O valor deve ser positivo' })
  })
);

// ==========================================
// ROTAS
// ==========================================
router.get('/', listarObjetivos);
router.post('/', criarObjetivoSchema, criarObjetivo);

router.patch('/:id', criarObjetivoSchema, atualizarObjetivo);
router.patch('/:id/progresso', adicionarProgressoSchema, adicionarProgresso);

router.post('/distribuir-poupanca', distribuirPoupanca);

router.delete('/:id', deletarObjetivo);

// Exportar router corretamente
module.exports = router;
