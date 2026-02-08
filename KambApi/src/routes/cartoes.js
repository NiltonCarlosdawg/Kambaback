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
// SCHEMAS DE VALIDAÇÃO JOI (ATUALIZADOS)
// ==========================================

const criarCartaoSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(100).required()
      .messages({ 'any.required': 'Nome do cartão é obrigatório' }),

    // ATUALIZADO: Apenas Enums válidos do schema Prisma
    tipo: Joi.string()
      .valid('DEBITO', 'CREDITO', 'POUPANCA')
      .required()
      .messages({ 
        'any.required': 'Tipo de cartão é obrigatório',
        'any.only': 'Tipo deve ser: DEBITO, CREDITO ou POUPANCA'
      }),

    banco: Joi.string().max(100).allow('', null).optional(),

    numero: Joi.string()
      .max(50)
      .allow('', null)
      .optional(),

    // Decimal do Prisma aceita number, mas garantimos que é positivo
    saldoAtual: Joi.number().min(0).default(0),
    limiteCredito: Joi.number().min(0).default(0),

    cor: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .default('#6366f1')
      .messages({ 'string.pattern.base': 'Cor inválida (use formato hexadecimal)' }),

    icone: Joi.string().max(50).default('credit-card'),
    
    // NOVO CAMPO: Distribuição automática de receitas
    distribuirParaObjetivos: Joi.boolean().default(false)
  })
);

const atualizarCartaoSchema = validar(
  Joi.object({
    nome: Joi.string().min(2).max(100),
    banco: Joi.string().max(100).allow('', null),
    cor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    icone: Joi.string().max(50),
    ativo: Joi.boolean(),
    limiteCredito: Joi.number().min(0),
    // REMOVIDO: bloqueado (não existe no schema Cartao)
    // ADICIONADO: distribuirParaObjetivos
    distribuirParaObjetivos: Joi.boolean()
  })
  .min(1)
  .messages({ 'object.min': 'Pelo menos um campo deve ser enviado para atualização' })
);

const atualizarSaldoSchema = validar(
  Joi.object({
    valor: Joi.number().positive().required()
      .messages({ 'number.positive': 'O valor deve ser positivo' }),
    // ATUALIZADO: Enums maiúsculos conforme schema
    tipoTransacao: Joi.string().valid('DESPESA', 'RECEITA').required()
      .messages({ 'any.only': 'Tipo de transação deve ser "DESPESA" ou "RECEITA"' })
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