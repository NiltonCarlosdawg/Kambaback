const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { validar } = require('../middleware/validator');

const {
  criarGasto,
  listarGastos,
  gastosPorCategoria,
  deletarGasto
} = require('../controllers/gastosController');

const { protegerRota } = require('../middleware/auth');

// ==========================================
// TODAS AS ROTAS DE GASTOS SÃO PROTEGIDAS
// ==========================================
router.use(protegerRota);

// ==========================================
// SCHEMA DE VALIDAÇÃO JOI
// ==========================================
const criarGastoSchema = validar(
  Joi.object({
    cartao: Joi.string().hex().length(24).required()
      .messages({ 'any.required': 'Cartão é obrigatório' }),

    tipo: Joi.string().valid('despesa', 'receita').required(),

    valor: Joi.number().positive().required()
      .messages({ 'number.positive': 'Valor deve ser positivo' }),

    descricao: Joi.string().max(150).allow('').optional(),

    categoria: Joi.string().required()
      .messages({ 'any.required': 'Categoria é obrigatória' }),

    data: Joi.date().iso().default(() => new Date()),

    local: Joi.string().max(100).allow('').optional(),

    parcelado: Joi.object({
      totalParcelas: Joi.number().min(1).max(48).default(1),
      parcelaAtual: Joi.number().min(1).default(1),
      recorrencia: Joi.string().valid('unica', 'mensal', 'anual').default('unica')
    }).optional(),

    objetivo: Joi.string().hex().length(24).allow(null).optional(),

    tags: Joi.array()
      .items(Joi.string().max(30).lowercase())
      .max(10)
      .optional()
  })
);

// ==========================================
// ROTAS
// ==========================================
router.post('/', criarGastoSchema, criarGasto);

router.get('/', listarGastos);
// ?pagina=1&limite=20&tipo=despesa&categoria=alimentacao&cartao=abc123&dataInicio=2025-01-01&dataFim=2025-01-31&busca=mercado

router.get('/por-categoria', gastosPorCategoria);
// ?mes=1&ano=2025 → resumo do mês especificado

router.delete('/:id', deletarGasto);

// Exportar router corretamente
module.exports = router;
