// src/models/Gasto.js
const mongoose = require('mongoose');
const { 
  CATEGORIAS_GASTOS_PADRAO, 
  TIPOS_TRANSACAO, 
  PERIODOS_FILTRO 
} = require('../config/constants');

/**
 * ==========================================
 * SCHEMA DO GASTO / TRANSAÇÃO
 * ==========================================
 */
const gastoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Todo gasto precisa de um usuário'],
    index: true
  },

  cartao: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cartao',
    required: [true, 'Todo gasto precisa estar ligado a um cartão/conta'],
    index: true
  },

  tipo: {
    type: String,
    enum: TIPOS_TRANSACAO, // 'despesa' | 'receita' | 'transferencia'
    required: [true, 'Tipo de transação é obrigatório'],
    default: 'despesa'
  },

  valor: {
    type: Number,
    required: [true, 'O valor é obrigatório'],
    min: [0.01, 'O valor mínimo é 0.01 AOA'],
    validate: {
      validator: Number.isFinite,
      message: 'Valor deve ser um número válido'
    }
  },

  descricao: {
    type: String,
    trim: true,
    maxlength: [150, 'Descrição muito longa (máx 150 caracteres)'],
    default: ''
  },

  categoria: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    enum: [
      ...CATEGORIAS_GASTOS_PADRAO.map(c => c.chave),
      // As categorias personalizadas serão validadas no controller/service
    ]
  },

  categoriaPersonalizada: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Categoria',
    default: null
  },

  data: {
    type: Date,
    required: [true, 'Data da transação é obrigatória'],
    default: Date.now,
    index: true
  },

  local: {
    type: String,
    trim: true,
    maxlength: [100, 'Local muito longo']
  },

  parcelado: {
    totalParcelas: { type: Number, min: 1, default: 1 },
    parcelaAtual: { type: Number, min: 1, default: 1 },
    recorrencia: { type: String, enum: ['unica', 'mensal', 'anual'], default: 'unica' }
  },

  // Para transferências entre cartões
  cartaoDestino: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cartao',
    default: null
  },

  // Ligação com objetivo (opcional)
  objetivo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Objetivo',
    default: null
  },

  // Tags livres (ex: "viagem luanda", "presente mana")
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 30
  }],

  // Metadados
  criadoEm: {
    type: Date,
    default: Date.now
  },

  atualizadoEm: {
    type: Date,
    default: Date.now
  },

  // Controle de exclusão lógica
  excluido: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * ==========================================
 * ÍNDICES OTIMIZADOS (extremamente importantes!)
 * ==========================================
 */
gastoSchema.index({ usuario: 1, data: -1 });
gastoSchema.index({ usuario: 1, cartao: 1, data: -1 });
gastoSchema.index({ usuario: 1, categoria: 1 });
gastoSchema.index({ usuario: 1, tipo: 1 });
gastoSchema.index({ data: -1 });
gastoSchema.index({ excluido: 1 });

/// Índice composto para relatórios mensais rápidos
gastoSchema.index({ usuario: 1, 'data': 1, tipo: 1, excluido: 1 });

/**
 * ==========================================
 * MIDDLEWARES
 * ==========================================
 */
gastoSchema.pre('save', function(next) {
  this.atualizadoEm = Date.now();
  
  // Se for parcela, valida lógica
  if (this.parcelado && this.parcelado.totalParcelas > 1) {
    if (this.parcelado.parcelaAtual > this.parcelado.totalParcelas) {
      return next(new Error('Parcela atual não pode ser maior que total'));
    }
  }
  next();
});

/**
 * ==========================================
 * MÉTODOS DE INSTÂNCIA
 * ==========================================
 */

// Marcar como excluído (soft delete)
gastoSchema.methods.softDelete = async function() {
  this.excluido = true;
  return this.save();
};

// Verificar se é a última parcela
gastoSchema.methods.ehUltimaParcela = function() {
  if (!this.parcelado) return true;
  return this.parcelado.parcelaAtual === this.parcelado.totalParcelas;
};

// Formatar para resposta amigável
gastoSchema.methods.toResponse = function() {
  const obj = this.toObject();
  
  // Formata data bonita
  obj.dataFormatada = new Date(obj.data).toLocaleDateString('pt-AO');
  
  // Valor formatado em Kwanza
  obj.valorFormatado = obj.valor.toLocaleString('pt-AO', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }) + ' AOA';

  return obj;
};

/**
 * ==========================================
 * MÉTODOS ESTÁTICOS
 * ==========================================
 */
gastoSchema.statics.getResumoMensal = function(usuarioId, ano, mes) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  return this.aggregate([
    { $match: { 
      usuario: mongoose.Types.ObjectId(usuarioId),
      data: { $gte: inicio, $lte: fim },
      excluido: false 
    }},
    { $group: {
      _id: '$tipo',
      total: { $sum: '$valor' },
      quantidade: { $sum: 1 }
    }}
  ]);
};

module.exports = mongoose.model('Gasto', gastoSchema);