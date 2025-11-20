// src/models/Categoria.js
const mongoose = require('mongoose');
const { 
  TIPOS_CARTOES, 
  CATEGORIAS_OBJETIVOS, 
  CATEGORIAS_GASTOS_PADRAO 
} = require('../config/constants');
const { ICONES_CATEGORIAS } = require('../constants/icons');

/**
 * ==========================================
 * SCHEMA DE CATEGORIA PERSONALIZADA
 * ==========================================
 */
const categoriaSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Categoria precisa estar vinculada a um usuário'],
    index: true
  },

  nome: {
    type: String,
    required: [true, 'Nome da categoria é obrigatório'],
    trim: true,
    maxlength: [40, 'Nome muito longo (máx. 40 caracteres)'],
    minlength: [2, 'Nome muito curto']
  },

  chave: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true, // garante unicidade global (evita conflito com padrão)
    sparse: true,
    match: [/^[a-z0-9_]+$/, 'Chave só pode conter letras minúsculas, números e underscore']
  },

  tipo: {
    type: String,
    enum: ['despesa', 'receita'],
    required: [true, 'Tipo (despesa ou receita) é obrigatório']
  },

  cor: {
    type: String,
    default: function() {
      // Cicla entre cores padrão se não for informada
      const cores = Object.values(CORES_CATEGORIAS);
      return cores[Math.floor(Math.random() * cores.length)];
    },
    match: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
  },

  icone: {
    type: String,
    default: 'category',
    enum: ICONES_CATEGORIAS // lista controlada de ícones Material
  },

  ativa: {
    type: Boolean,
    default: true
  },

  // Ordem de exibição no app
  ordem: {
    type: Number,
    default: 999
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
categoriaSchema.index({ usuario: 1, tipo: 1, ativa: 1 });
categoriaSchema.index({ chave: 1 }, { unique: true, sparse: true });
categoriaSchema.index({ ordem: 1 });

/**
 * ==========================================
 * MIDDLEWARES
 * ==========================================
 */
categoriaSchema.pre('save', function(next) {
  this.atualizadoEm = Date.now();

  // Gera chave automática se não existir
  if (!this.chave) {
    const base = this.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .trim();
    
    this.chave = `${base}_${Date.now().toString(36)}`;
  }

  next();
});

/**
 * ==========================================
 * MÉTODOS DE INSTÂNCIA
 * ==========================================
 */
categoriaSchema.methods.toResponse = function() {
  const cat = this.toObject();
  cat.id = cat._id;
  
  // Adiciona label amigável para o frontend
  cat.label = this.nome;
  cat.value = this.chave || this._id.toString();

  return cat;
};

/**
 * ==========================================
 * MÉTODOS ESTÁTICOS
 * ==========================================
 */
// Retorna TODAS as categorias (padrão + personalizadas do usuário)
categoriaSchema.statics.getAllByUsuario = async function(usuarioId) {
  const personalizadas = await this.find({ 
    usuario: usuarioId, 
    ativa: true 
  }).sort({ ordem: 1, nome: 1 });

  const padraoDespesas = CATEGORIAS_GASTOS_PADRAO.map(c => ({
    ...c,
    _id: `padrao_despesa_${c.chave}`,
    tipo: 'despesa',
    isPadrao: true
  }));

  const padraoReceitas = CATEGORIAS_RECEITAS_PADRAO.map(c => ({
    ...c,
    _id: `padrao_receita_${c.chave}`,
    tipo: 'receita',
    isPadrao: true
  }));

  return {
    despesas: [...padraoDespesas, ...personalizadas.filter(p => p.tipo === 'despesa')],
    receitas: [...padraoReceitas, ...personalizadas.filter(p => p.tipo === 'receita')]
  };
};

module.exports = mongoose.model('Categoria', categoriaSchema);