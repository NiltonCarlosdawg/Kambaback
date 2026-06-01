const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { validar } = require('../../../middleware/validator');

const {
  criarGasto,
  listarGastos,
  gastosPorCategoria,
  atualizarGasto,
  deletarGasto
} = require('../controllers/gastosController');

const { protegerRota } = require('../../../middleware/auth');

const criarGastoSchema = validar(
  Joi.object({
    cartaoId: Joi.string().required()
      .messages({ 'any.required': 'Cartão é obrigatório' }),

    // ATUALIZADO: Enums maiúsculos conforme schema Prisma
    tipo: Joi.string().valid('DESPESA', 'RECEITA').required()
      .messages({ 
        'any.required': 'Tipo é obrigatório',
        'any.only': 'Tipo deve ser DESPESA ou RECEITA'
      }),

    valor: Joi.number().positive().required()
      .messages({ 
        'number.positive': 'Valor deve ser positivo',
        'any.required': 'Valor é obrigatório'
      }),

    descricao: Joi.string().max(500).required()
      .messages({ 'any.required': 'Descrição é obrigatória' }),

    categoriaId: Joi.string().required()
      .messages({ 'any.required': 'Categoria é obrigatória' }),

    data: Joi.alternatives().try(
      Joi.date().iso(),
      Joi.string().isoDate()
    ).default(() => new Date().toISOString()),

    local: Joi.string().max(200).allow('', null).optional(),

   
    parcelado: Joi.boolean().default(false),
    totalParcelas: Joi.number().min(1).max(48).default(1),
    parcelaAtual: Joi.number().min(1).default(1),

  
    objetivoId: Joi.string().optional().allow('', null),
    
    tags: Joi.array()
      .items(Joi.string().max(50))
      .max(20)
      .optional()
  })
);


const listarGastosQuerySchema = validar(
  Joi.object({
    pagina: Joi.number().integer().min(1).default(1),
    limite: Joi.number().integer().min(1).max(100).default(20),
    tipo: Joi.string().valid('DESPESA', 'RECEITA', 'todos').optional(),
    categoriaId: Joi.string().optional(),
    cartaoId: Joi.string().optional(),
    objetivoId: Joi.string().optional(),
    dataInicio: Joi.date().iso().optional(),
    dataFim: Joi.date().iso().optional()
  }).unknown(true), 
  'query'
);

const atualizarGastoSchema = validar(
  Joi.object({
    descricao: Joi.string().max(500).trim().optional(),
    categoriaId: Joi.string().optional().allow(null, ''),
    data: Joi.alternatives().try(
      Joi.date().iso(),
      Joi.string().isoDate()
    ).optional(),
    local: Joi.string().max(200).allow('', null).optional(),
    tags: Joi.array()
      .items(Joi.string().max(50))
      .max(20)
      .optional(),
  }).min(1)
);

// ==========================================
// ROTAS
// ==========================================
router.use(protegerRota);

router.post('/', criarGastoSchema, criarGasto);
router.get('/', listarGastosQuerySchema, listarGastos);
router.get('/por-categoria', gastosPorCategoria);
router.patch('/:id', atualizarGastoSchema, atualizarGasto);
router.delete('/:id', deletarGasto);

module.exports = router;
