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

// F-015: schemas Joi nas rotas de escrita — antes entravam na BD
// titulo gigante (> VarChar(200)), prioridade fora do enum (500 do Prisma),
// dataPrevista 'lixo' (Invalid Date) e concluido "false" (Boolean("false")
// === true reabria marcando como concluído)
const criarObjetivoSchema = validar(
  Joi.object({
    titulo: Joi.string().trim().min(2).max(200).required()
      .messages({
        'any.required': 'Título é obrigatório',
        'string.min': 'Título deve ter pelo menos 2 caracteres',
        'string.max': 'Título deve ter no máximo 200 caracteres',
      }),
    valorAlvo: Joi.number().positive().required()
      .messages({
        'any.required': 'Valor alvo é obrigatório',
        'number.positive': 'Valor alvo deve ser positivo',
      }),
    dataPrevista: Joi.date().required()
      .messages({
        'any.required': 'Data prevista é obrigatória',
        'date.format': 'Data prevista inválida',
      }),
    categoria: Joi.string().max(50).allow('', null),
    prioridade: Joi.string().uppercase()
      .valid('BAIXA', 'MEDIA', 'ALTA', 'URGENTE').default('MEDIA'),
    icone: Joi.string().max(50).allow('', null),
    cor: Joi.string().max(7).allow('', null),
    porcentagemDistribuicao: Joi.number().min(0).max(100).default(0),
    descricao: Joi.string().max(2000).allow('', null),
  }).unknown(true),
);

const atualizarObjetivoSchema = validar(
  Joi.object({
    titulo: Joi.string().trim().min(2).max(200),
    valorAlvo: Joi.number().positive()
      .messages({ 'number.positive': 'Valor alvo deve ser positivo' }),
    valorAtual: Joi.number().min(0),
    dataPrevista: Joi.date(),
    categoria: Joi.string().max(50).allow('', null),
    prioridade: Joi.string().uppercase()
      .valid('BAIXA', 'MEDIA', 'ALTA', 'URGENTE'),
    icone: Joi.string().max(50).allow('', null),
    cor: Joi.string().max(7).allow('', null),
    porcentagemDistribuicao: Joi.number().min(0).max(100),
    concluido: Joi.boolean()
      .messages({ 'boolean.base': 'concluido deve ser true ou false' }),
    descricao: Joi.string().max(2000).allow('', null),
  }).unknown(true),
);

router.post('/', criarObjetivoSchema, criarObjetivo);


router.put('/:id', atualizarObjetivoSchema, atualizarObjetivo);

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
