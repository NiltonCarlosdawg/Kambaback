// src/models/Objetivo.js
const mongoose = require('mongoose');
const { 
  STATUS_OBJETIVO, 
  PRIORIDADES_OBJETIVO,
  CATEGORIAS_OBJETIVOS,
  MOEDA_PADRAO 
} = require('../config/constants');

/**
 * ==========================================
 * SCHEMA DE OBJETIVO FINANCEIRO
 * ==========================================
 */
const objetivoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Objetivo precisa de um usuário'],
    index: true
  },

  titulo: {
    type: String,
    required: [true, 'Título do objetivo é obrigatório'],
    trim: true,
    maxlength: [80, 'Título muito longo']
  },

  descricao: {
    type: String,
    trim: true,
    maxlength: [300, 'Descrição muito longa']
  },

  categoria: {
    type: String,
    required: true,
    enum: CATEGORIAS_OBJETIVOS.map(c => c.valor)
  },

  valorAlvo: {
    type: Number,
    required: [true, 'Valor alvo é obrigatório'],
    min: [1000, 'Valor mínimo: 1.000 AOA']
  },

  valorAtual: {
    type: Number,
    default: 0,
    min: 0
  },

  moeda: {
    type: String,
    enum: ['AOA', 'USD', 'EUR'],
    default: MOEDA_PADRAO
  },

  dataInicio: {
    type: Date,
    default: Date.now
  },

  dataPrevista: {
    type: Date,
    required: [true, 'Data prevista é obrigatória'],
    validate: {
      validator: function(v) {
        return v > this.dataInicio;
      },
      message: 'Data prevista deve ser maior que data de início'
    }
  },

  prioridade: {
    type: String,
    enum: PRIORIDADES_OBJETIVO.map(p => p.valor),
    default: 'media'
  },

  status: {
    type: String,
    enum: Object.keys(STATUS_OBJETIVO),
    default: 'EM_ANDAMENTO'
  },

  cor: {
    type: String,
    default: '#10b981',
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },

  icone: {
    type: String,
    default: 'target'
  },

  // Distribuição automática de poupança
  porcentagemDistribuicao: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Porcentagem deve ser número inteiro'
    }
  },

  // Controle manual/automático
  modoDistribuicao: {
    type: String,
    enum: ['automatico', 'manual'],
    default: 'automatico'
  },

  ativo: {
    type: Boolean,
    default: true
  },

  concluidoEm: {
    type: Date,
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
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * ==========================================
 * ÍNDICES
 * ==========================================
 */
objetivoSchema.index({ usuario: 1, status: 1 });
objetivoSchema.index({ usuario: 1, prioridade: -1 });
objetivoSchema.index({ usuario: 1, dataPrevista: 1 });
objetivoSchema.index({ concluidoEm: 1 });

/// Índice composto para dashboard
objetivoSchema.index({ usuario: 1, ativo: 1, status: 1, prioridade: -1 });

/**
 * ==========================================
 * VIRTUALS
 * ==========================================
 */
objetivoSchema.virtual('progressoPercentual').get(function() {
  if (this.valorAlvo === 0) return 0;
  const progresso = (this.valorAtual / this.valorAlvo) * 100;
  return Math.min(Math.round(progresso * 100) / 100, 100); // arredonda 2 casas
});

objetivoSchema.virtual('estaConcluido').get(function() {
  return this.progressoPercentual >= 100 || this.status === 'CONCLUIDO';
});

objetivoSchema.virtual('diasRestantes').get(function() {
  if (!this.dataPrevista) return null;
  const diff = new Date(this.dataPrevista) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

objetivoSchema.virtual('valorFaltante').get(function() {
  return Math.max(0, this.valorAlvo - this.valorAtual);
});

/**
 * ==========================================
 * MIDDLEWARES
 * ==========================================
 */
objetivoSchema.pre('save', function(next) {
  this.atualizadoEm = Date.now();

  // Auto-concluir se atingiu 100%
  if (this.valorAtual >= this.valorAlvo && this.status !== 'CONCLUIDO') {
    this.status = 'CONCLUIDO';
    this.concluidoEm = new Date();
  }

  // Se foi marcado como concluído manualmente
  if (this.status === 'CONCLUIDO' && !this.concluidoEm) {
    this.concluidoEm = new Date();
  }

  next();
});

/**
 * ==========================================
 * MÉTODOS DE INSTÂNCIA
 * ==========================================
 */
objetivoSchema.methods.adicionarProgresso = async function(valor) {
  this.valorAtual += valor;
  if (this.valorAtual > this.valorAlvo) {
    this.valorAtual = this.valorAlvo;
  }
  return this.save();
};

objetivoSchema.methods.toDashboard = function() {
  const obj = this.toObject();
  obj.progresso = this.progressoPercentual;
  obj.faltam = this.valorFaltante;
  obj.dias = this.diasRestantes;
  obj.concluido = this.estaConcluido;
  return obj;
};

/**
 * ==========================================
 * MÉTODOS ESTÁTICOS
 * ==========================================
 */
objetivoSchema.statics.getDashboard = async function(usuarioId) {
  const objetivos = await this.find({ 
    usuario: usuarioId, 
    ativo: true 
  }).sort({ prioridade: -1, dataPrevista: 1 });

  const ativos = objetivos.filter(o => o.status === 'EM_ANDAMENTO');
  const concluidos = objetivos.filter(o => o.status === 'CONCLUIDO');

  const totalAlvo = objetivos.reduce((acc, o) => acc + o.valorAlvo, 0);
  const totalAtual = objetivos.reduce((acc, o) => acc + o.valorAtual, 0);

  return {
    objetivos: objetivos.map(o => o.toDashboard()),
    resumo: {
      totalObjetivos: objetivos.length,
      concluidos: concluidos.length,
      emAndamento: ativos.length,
      progressoGeral: totalAlvo > 0 ? (totalAtual / totalAlvo) * 100 : 0,
      valorTotalAlvo: totalAlvo,
      valorTotalAtual: totalAtual
    }
  };
};

module.exports = mongoose.model('Objetivo', objetivoSchema);