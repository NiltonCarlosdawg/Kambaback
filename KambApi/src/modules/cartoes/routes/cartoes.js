const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { validar } = require('../../../middleware/validator');

const {
  listarCartoes,
  criarCartao,
  atualizarCartao,
  atualizarSaldo,
  deletarCartao
} = require('../controllers/cartoesController');

const { protegerRota } = require('../../../middleware/auth');

// ==========================================
// SCHEMAS DE VALIDAÇÃO JOI (REFATORADOS)
// ==========================================

const criarCartaoSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(100).trim().required()
      .messages({ 
        'any.required': 'Nome do cartão é obrigatório',
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome deve ter no máximo 100 caracteres'
      }),

    tipo: Joi.string()
      .valid('DEBITO', 'CREDITO', 'POUPANCA')
      .required()
      .messages({ 
        'any.required': 'Tipo de cartão é obrigatório',
        'any.only': 'Tipo deve ser: DEBITO, CREDITO ou POUPANCA'
      }),

    banco: Joi.string().max(100).trim().allow('', null).optional(),

    numero: Joi.string().max(50).trim().allow('', null).optional(),

    // 🎯 SALDO ATUAL - Obrigatório para DEBITO e POUPANCA, ignorado para CREDITO
    saldoAtual: Joi.when('tipo', {
      is: Joi.valid('DEBITO', 'POUPANCA'),
      then: Joi.number().min(0).required().messages({
        'any.required': 'Saldo inicial é obrigatório para cartões de Débito e Poupança',
        'number.min': 'Saldo não pode ser negativo'
      }),
      otherwise: Joi.number().min(0).default(0)
    }),

    // 🎯 LIMITE DE CRÉDITO - Obrigatório e > 0 para CREDITO, forçado a 0 para DEBITO/POUPANCA
    limiteCredito: Joi.when('tipo', {
      is: 'CREDITO',
      then: Joi.number().positive().required().messages({
        'any.required': 'Limite de crédito é obrigatório para cartões de Crédito',
        'number.positive': 'Limite de crédito deve ser maior que zero'
      }),
      otherwise: Joi.number().valid(0).default(0).messages({
        'any.only': 'Cartões de Débito e Poupança não podem ter limite de crédito'
      })
    }),

    // 🎯 DIA DE FECHAMENTO - Obrigatório para CREDITO (1-31), ignorado para DEBITO/POUPANCA
    diaFechamento: Joi.when('tipo', {
      is: 'CREDITO',
      then: Joi.number().integer().min(1).max(31).required().messages({
        'any.required': 'Dia de fechamento é obrigatório para cartões de Crédito',
        'number.min': 'Dia de fechamento deve ser entre 1 e 31',
        'number.max': 'Dia de fechamento deve ser entre 1 e 31'
      }),
      otherwise: Joi.forbidden().messages({
        'any.unknown': 'Dia de fechamento não é aplicável a cartões de Débito ou Poupança'
      })
    }),

    // 🎯 DIA DE VENCIMENTO - Obrigatório para CREDITO (1-31), ignorado para DEBITO/POUPANCA
    diaVencimento: Joi.when('tipo', {
      is: 'CREDITO',
      then: Joi.number().integer().min(1).max(31).required().messages({
        'any.required': 'Dia de vencimento é obrigatório para cartões de Crédito',
        'number.min': 'Dia de vencimento deve ser entre 1 e 31',
        'number.max': 'Dia de vencimento deve ser entre 1 e 31'
      }),
      otherwise: Joi.forbidden().messages({
        'any.unknown': 'Dia de vencimento não é aplicável a cartões de Débito ou Poupança'
      })
    }),

    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .default('#6366f1')
      .messages({ 'string.pattern.base': 'Cor inválida (use formato hexadecimal)' }),

    icone: Joi.string().max(50).default('credit-card'),
    
    // Distribuição automática de receitas para objetivos
    distribuirParaObjetivos: Joi.boolean().default(false),
    percentualDistribuicaoPoupanca: Joi.when('distribuirParaObjetivos', {
      is: true,
      then: Joi.number().positive().max(100).required().messages({
        'any.required': 'A percentagem de distribuição da poupança é obrigatória quando a distribuição automática está activa',
        'number.positive': 'A percentagem deve ser positiva',
        'number.max': 'A percentagem não pode exceder 100%'
      }),
      otherwise: Joi.number().min(0).max(100).default(0)
        .messages({ 'number.max': 'A percentagem não pode exceder 100%' })
    })
  })
);

const atualizarCartaoSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(100).trim().optional()
      .messages({ 
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome deve ter no máximo 100 caracteres'
      }),
    
    banco: Joi.string().max(100).trim().allow('', null).optional(),
    
    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .optional()
      .messages({ 'string.pattern.base': 'Cor inválida (use formato hexadecimal)' }),
    
    icone: Joi.string().max(50).optional(),
    
    ativo: Joi.boolean().optional(),
    
    // Apenas para cartões de crédito
    limiteCredito: Joi.number().min(0).optional()
      .messages({ 'number.min': 'Limite não pode ser negativo' }),
    
    diaFechamento: Joi.number().integer().min(1).max(31).optional()
      .messages({
        'number.min': 'Dia de fechamento deve ser entre 1 e 31',
        'number.max': 'Dia de fechamento deve ser entre 1 e 31'
      }),
    
    diaVencimento: Joi.number().integer().min(1).max(31).optional()
      .messages({
        'number.min': 'Dia de vencimento deve ser entre 1 e 31',
        'number.max': 'Dia de vencimento deve ser entre 1 e 31'
      }),
    
    distribuirParaObjetivos: Joi.boolean().optional()
      ,
    percentualDistribuicaoPoupanca: Joi.number().min(0).max(100).optional()
      .messages({ 'number.max': 'A percentagem não pode exceder 100%' })
  })
  .min(1)
  .messages({ 'object.min': 'Pelo menos um campo deve ser enviado para atualização' })
);

const atualizarSaldoSchema = validar(
  Joi.object({
    valor: Joi.number().positive().required()
      .messages({ 
        'any.required': 'Valor é obrigatório',
        'number.positive': 'O valor deve ser positivo' 
      }),
    
    tipoTransacao: Joi.string().valid('DESPESA', 'RECEITA').required()
      .messages({ 
        'any.required': 'Tipo de transação é obrigatório',
        'any.only': 'Tipo de transação deve ser "DESPESA" ou "RECEITA"' 
      })
  })
);

// ==========================================
// ROTAS
// ==========================================
router.use(protegerRota);

router.get('/', listarCartoes);
router.post('/', criarCartaoSchema, criarCartao);
router.patch('/:id', atualizarCartaoSchema, atualizarCartao);
router.patch('/:id/saldo', atualizarSaldoSchema, atualizarSaldo);
router.delete('/:id', deletarCartao);

module.exports = router;
