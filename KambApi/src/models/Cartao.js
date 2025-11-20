// src/models/Cartao.js
const mongoose = require('mongoose');
const { 
  TIPOS_CARTOES, 
  CATEGORIAS_OBJETIVOS, 
  CATEGORIAS_GASTOS_PADRAO 
} = require('../config/constants');

/**
 * ==========================================
 * SCHEMA DO CARTÃO / CONTA BANCÁRIA
 * ==========================================
 */
const cartaoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Todo cartão precisa estar associado a um usuário'],
    index: true
  },

  nome: {
    type: String,
    required: [true, 'O nome do cartão é obrigatório'],
    trim: true,
    maxlength: [50, 'O nome não pode ter mais de 50 caracteres']
  },

  tipo: {
    type: String,
    enum: TIPOS_CARTOES.map(t => t.valor), // Ex: 'multicaixa', 'conta_bancaria', 'ekwanza', etc.
    required: [true, 'O tipo de cartão é obrigatório']
  },

  banco: {
    type: String,
    trim: true,
    maxlength: [60, 'Nome do banco muito longo'],
    default: null
  },

  numero: {
    type: String,
    trim: true,
    sparse: true, // permite null/undefined sem conflito de índice único
    validate: {
      validator: function(v) {
        if (!v) return true; // opcional
        return /^\d{13,19}$/.test(v.replace(/\s/g, '')); // aceita com ou sem espaços
      },
      message: 'Número de cartão inválido (13 a 19 dígitos)'
    }
  },

  saldoAtual: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'O saldo não pode ser negativo']
  },

  limiteCredito: {
    type: Number,
    default: 0,
    min: 0
  },

  moeda: {
    type: String,
    enum: ['AOA', 'USD', 'EUR'],
    default: 'AOA'
  },

  cor: {
    type: String,
    default: '#1e40af', // azul padrão bonito
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },

  icone: {
    type: String,
    default: 'credit_card'
  },

  ativo: {
    type: Boolean,
    default: true
  },

  bloqueado: {
    type: Boolean,
    default: false
  },

  dataCorte: {
    type: Number, // dia do mês (1-31)
    min: 1,
    max: 31,
    default: null
  },

  dataVencimentoFatura: {
    type: Number, // dia do mês
    min: 1,
    max: 31,
    default: null
  },

  // Metadados
  criadoEm: {
    type: Date,
    default: Date.now
  },

  atualizadoEm: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false, // já estamos definindo manualmente
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * ==========================================
 * ÍNDICES PARA PERFORMANCE
 * ==========================================
 */
cartaoSchema.index({ usuario: 1, ativo: 1 });
cartaoSchema.index({ tipo: 1 });
cartaoSchema.index({ criadoEm: -1 });

/**
 * ==========================================
 * MIDDLEWARES
 * ==========================================
 */
cartaoSchema.pre('save', function(next) {
  this.atualizadoEm = Date.now();
  next();
});

/**
 * ==========================================
 * MÉTODOS DE INSTÂNCIA
 * ==========================================
 */

// Atualizar saldo (usado internamente pelos gastos)
cartaoSchema.methods.atualizarSaldo = function(valor, tipoTransacao) {
  if (tipoTransacao === 'despesa') {
    this.saldoAtual -= Math.abs(valor);
  } else if (tipoTransacao === 'receita') {
    this.saldoAtual += Math.abs(valor);
  }
  // Garante que saldo nunca fique negativo (exceto crédito)
  if (this.saldoAtual < 0 && this.limiteCredito === 0) {
    this.saldoAtual = 0;
  }
  return this.save();
};

// Verificar se pode fazer um gasto
cartaoSchema.methods.podeGastar = function(valor) {
  const disponivel = this.saldoAtual + this.limiteCredito;
  return disponivel >= valor;
};

// Retornar dados públicos/sanitizados
cartaoSchema.methods.toPublic = function() {
  const cartao = this.toObject();
  delete cartao.numero; // nunca expor número completo
  return cartao;
};

/**
 * ==========================================
 * VIRTUALS
 * ==========================================
 */
// Total disponível (saldo + limite de crédito)
cartaoSchema.virtual('disponivel').get(function() {
  return this.saldoAtual + this.limiteCredito;
});

// Quantidade de gastos associados (populado no controller quando necessário)
cartaoSchema.virtual('totalGastos', {
  ref: 'Gasto',
  localField: '_id',
  foreignField: 'cartao',
  count: true
});

module.exports = mongoose.model('Cartao', cartaoSchema);