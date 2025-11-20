const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { validar } = require('../middleware/validator');

const {
  listarCartoes,
  criarCartao,
  atualizarCartao,
  atualizarSaldo,
  deletarCartao
} = require('../controllers/cartoesController');

const { protegerRota } = require('../middleware/auth');

// ==========================================
// TODAS AS ROTAS DE CARTÕES SÃO PROTEGIDAS
// ==========================================
router.use(protegerRota);

// ==========================================
// SCHEMAS DE VALIDAÇÃO JOI
// ==========================================
const criarCartaoSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(50).required()
      .messages({ 'any.required': 'Nome do cartão é obrigatório' }),

    tipo: Joi.string()
      .valid('multicaixa', 'conta_bancaria', 'ekwanza', 'credito', 'debito', 'investimento')
      .required()
      .messages({ 'any.required': 'Tipo de cartão é obrigatório' }),

    banco: Joi.string().max(60).allow('').optional(),

    numero: Joi.string()
      .pattern(/^\d{13,19}$/)
      .allow('')
      .optional()
      .messages({ 'string.pattern.base': 'Número do cartão deve ter entre 13 e 19 dígitos' }),

    saldoAtual: Joi.number().min(0).default(0),
    limiteCredito: Joi.number().min(0).default(0),

    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .default('#1e40af')
      .messages({ 'string.pattern.base': 'Cor inválida (use formato hexadecimal, ex: #1e40af)' }),

    icone: Joi.string().default('credit_card')
  })
);

const atualizarCartaoSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(50),
    banco: Joi.string().max(60).allow(''),
    cor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    icone: Joi.string(),
    ativo: Joi.boolean(),
    bloqueado: Joi.boolean()
  })
  .min(1)
  .messages({ 'object.min': 'Pelo menos um campo deve ser enviado para atualização' })
);

const atualizarSaldoSchema = validar(
  Joi.object({
    valor: Joi.number().positive().required()
      .messages({ 'number.positive': 'O valor deve ser positivo' }),
    tipoTransacao: Joi.string().valid('despesa', 'receita').required()
      .messages({ 'any.only': 'Tipo de transação deve ser "despesa" ou "receita"' })
  })
);

// ==========================================
// ROTAS
// ==========================================
router.get('/', listarCartoes);

router.post('/', criarCartaoSchema, criarCartao);

router.patch('/:id', atualizarCartaoSchema, atualizarCartao);

router.patch('/:id/saldo', atualizarSaldoSchema, atualizarSaldo);

router.delete('/:id', deletarCartao);

// Exportar router corretamente
module.exports = router;
