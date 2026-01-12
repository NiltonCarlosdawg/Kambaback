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
// SCHEMA DE VALIDAÇÃO JOI - CORRIGIDO
// ==========================================
const criarGastoSchema = validar(
  Joi.object({
    // CORRIGIDO: cartao → cartaoId (alinhado com controller)
    cartaoId: Joi.string().required()
      .messages({ 'any.required': 'Cartão é obrigatório' }),

    tipo: Joi.string().valid('despesa', 'receita').required()
      .messages({ 'any.required': 'Tipo é obrigatório (despesa ou receita)' }),

    valor: Joi.number().positive().required()
      .messages({ 
        'number.positive': 'Valor deve ser positivo',
        'any.required': 'Valor é obrigatório'
      }),

    descricao: Joi.string().max(150).allow('').optional(),

    // CORRIGIDO: categoria → categoriaId (alinhado com controller)
    categoriaId: Joi.string().required()
      .messages({ 'any.required': 'Categoria é obrigatória' }),

    data: Joi.date().iso().default(() => new Date()),

    local: Joi.string().max(100).allow('').optional(),

    parcelado: Joi.object({
      totalParcelas: Joi.number().min(1).max(48).default(1),
      parcelaAtual: Joi.number().min(1).default(1),
      recorrencia: Joi.string().valid('unica', 'mensal', 'anual').default('unica')
    }).optional(),

    // CORRIGIDO: removido campo objetivo (não existe relação no schema)
    
    tags: Joi.array()
      .items(Joi.string().max(30).lowercase())
      .max(10)
      .optional()
  })
);

// ==========================================
// ROTAS
// ==========================================

// Criar novo gasto/receita
router.post('/', criarGastoSchema, criarGasto);

// Listar gastos com filtros e paginação
router.get('/', listarGastos);
// Query params aceitos:
// ?pagina=1&limite=20&tipo=despesa&categoria=<id>&cartao=<id>&dataInicio=2025-01-01&dataFim=2025-01-31&busca=mercado

// Resumo por categoria (mês específico)
router.get('/por-categoria', gastosPorCategoria);
// Query params: ?mes=1&ano=2025

// Deletar gasto (soft delete)
router.delete('/:id', deletarGasto);

module.exports = router;