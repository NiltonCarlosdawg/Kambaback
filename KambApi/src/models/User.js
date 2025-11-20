// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { REGEX, ROLES_ARRAY, MENSAGENS_ERRO } = require('../config/constants');

// ==========================================
// SCHEMA DO USUÁRIO
// ==========================================
const userSchema = new mongoose.Schema(
  {
    // Informações pessoais
    nome: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
      minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
      maxlength: [50, 'Nome deve ter no máximo 50 caracteres']
    },

    email: {
      type: String,
      required: [true, 'Email é obrigatório'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(value) {
          return REGEX.EMAIL.test(value);
        },
        message: 'Email inválido'
      }
    },

    telefone: {
      type: String,
      trim: true,
      validate: {
        validator: function(value) {
          if (!value) return true; // Telefone é opcional
          return REGEX.TELEFONE_ANGOLA.test(value);
        },
        message: 'Número de telefone angolano inválido'
      }
    },

    senha: {
      type: String,
      required: [true, 'Senha é obrigatória'],
      minlength: [8, 'Senha deve ter pelo menos 8 caracteres'],
      select: false // Não retorna senha por padrão nas queries
    },

    // Avatar/Foto de perfil
    avatar: {
      type: String,
      default: null
    },

    // Localização
    localizacao: {
      cidade: {
        type: String,
        default: 'Luanda'
      },
      provincia: {
        type: String,
        default: 'Luanda'
      }
    },

    // Role/Permissão
    role: {
      type: String,
      enum: ROLES_ARRAY,
      default: 'user'
    },

    // Preferências do usuário
    preferencias: {
      moeda: {
        type: String,
        default: 'AOA'
      },
      idioma: {
        type: String,
        default: 'pt-AO'
      },
      notificacoes: {
        email: {
          type: Boolean,
          default: true
        },
        push: {
          type: Boolean,
          default: true
        },
        alertaGasto: {
          type: Boolean,
          default: true
        },
        alertaObjetivo: {
          type: Boolean,
          default: true
        }
      },
      tema: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'dark'
      }
    },

    // Controle de segurança
    seguranca: {
      tentativasLogin: {
        type: Number,
        default: 0
      },
      bloqueadoAte: {
        type: Date,
        default: null
      },
      ultimoLogin: {
        type: Date,
        default: null
      },
      ultimoIP: {
        type: String,
        default: null
      }
    },

    // Reset de senha
    resetSenha: {
      token: String,
      expiraEm: Date
    },

    // Verificação de email
    emailVerificado: {
      type: Boolean,
      default: false
    },

    verificacaoEmail: {
      token: String,
      expiraEm: Date
    },

    // Status da conta
    ativo: {
      type: Boolean,
      default: true
    },

    // Onboarding
    primeiroAcesso: {
      type: Boolean,
      default: true
    },

    tutorialConcluido: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true, // createdAt e updatedAt automáticos
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ==========================================
// ÍNDICES PARA PERFORMANCE
// ==========================================
userSchema.index({ email: 1 });
userSchema.index({ telefone: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'seguranca.ultimoLogin': -1 });

// ==========================================
// VIRTUALS - RELACIONAMENTOS
// ==========================================

// Cartões do usuário
userSchema.virtual('cartoes', {
  ref: 'Cartao',
  localField: '_id',
  foreignField: 'usuario'
});

// Gastos do usuário
userSchema.virtual('gastos', {
  ref: 'Gasto',
  localField: '_id',
  foreignField: 'usuario'
});

// Objetivos do usuário
userSchema.virtual('objetivos', {
  ref: 'Objetivo',
  localField: '_id',
  foreignField: 'usuario'
});

// Categorias personalizadas
userSchema.virtual('categoriasPersonalizadas', {
  ref: 'Categoria',
  localField: '_id',
  foreignField: 'usuario'
});

// ==========================================
// MIDDLEWARE - PRE SAVE
// ==========================================

// Hash da senha antes de salvar
userSchema.pre('save', async function(next) {
  // Só faz hash se a senha foi modificada
  if (!this.isModified('senha')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
    this.senha = await bcrypt.hash(this.senha, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Atualizar updatedAt em cada save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ==========================================
// MÉTODOS DE INSTÂNCIA
// ==========================================

// Comparar senha
userSchema.methods.compararSenha = async function(senhaFornecida) {
  return await bcrypt.compare(senhaFornecida, this.senha);
};

// Gerar token JWT
userSchema.methods.gerarToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      email: this.email,
      role: this.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Gerar refresh token
userSchema.methods.gerarRefreshToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      tipo: 'refresh' 
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

// Gerar token de reset de senha
userSchema.methods.gerarTokenResetSenha = function() {
  const resetToken = jwt.sign(
    { id: this._id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Salvar hash do token no banco
  this.resetSenha = {
    token: resetToken,
    expiraEm: Date.now() + 3600000 // 1 hora
  };

  return resetToken;
};

// Gerar token de verificação de email
userSchema.methods.gerarTokenVerificacaoEmail = function() {
  const verificacaoToken = jwt.sign(
    { id: this._id },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  this.verificacaoEmail = {
    token: verificacaoToken,
    expiraEm: Date.now() + 86400000 // 24 horas
  };

  return verificacaoToken;
};

// Verificar se conta está bloqueada
userSchema.methods.estaBloqueado = function() {
  if (this.seguranca.bloqueadoAte && this.seguranca.bloqueadoAte > Date.now()) {
    return true;
  }
  return false;
};

// Incrementar tentativas de login
userSchema.methods.incrementarTentativasLogin = async function() {
  this.seguranca.tentativasLogin += 1;

  const maxTentativas = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  
  if (this.seguranca.tentativasLogin >= maxTentativas) {
    const lockTime = parseInt(process.env.LOCK_TIME) || 900000; // 15 min
    this.seguranca.bloqueadoAte = Date.now() + lockTime;
  }

  await this.save();
};

// Resetar tentativas de login
userSchema.methods.resetarTentativasLogin = async function() {
  this.seguranca.tentativasLogin = 0;
  this.seguranca.bloqueadoAte = null;
  await this.save();
};

// Atualizar último login
userSchema.methods.atualizarUltimoLogin = async function(ip) {
  this.seguranca.ultimoLogin = Date.now();
  this.seguranca.ultimoIP = ip;
  await this.save();
};

// Obter dados públicos do usuário (sem informações sensíveis)
userSchema.methods.getDadosPublicos = function() {
  return {
    id: this._id,
    nome: this.nome,
    email: this.email,
    telefone: this.telefone,
    avatar: this.avatar,
    localizacao: this.localizacao,
    role: this.role,
    emailVerificado: this.emailVerificado,
    ativo: this.ativo,
    primeiroAcesso: this.primeiroAcesso,
    tutorialConcluido: this.tutorialConcluido,
    createdAt: this.createdAt
  };
};

// ==========================================
// MÉTODOS ESTÁTICOS
// ==========================================

// Buscar usuário por email
userSchema.statics.buscarPorEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Buscar usuário por email com senha
userSchema.statics.buscarPorEmailComSenha = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+senha');
};

// Verificar se email já existe
userSchema.statics.emailExiste = async function(email) {
  const usuario = await this.findOne({ email: email.toLowerCase() });
  return !!usuario;
};

// Buscar usuários ativos
userSchema.statics.buscarAtivos = function() {
  return this.find({ ativo: true });
};

// Estatísticas de usuários
userSchema.statics.obterEstatisticas = async function() {
  const total = await this.countDocuments();
  const ativos = await this.countDocuments({ ativo: true });
  const verificados = await this.countDocuments({ emailVerificado: true });
  const novos = await this.countDocuments({
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });

  return {
    total,
    ativos,
    inativos: total - ativos,
    verificados,
    naoVerificados: total - verificados,
    novosUltimaSemana: novos
  };
};

// ==========================================
// MIDDLEWARE - POST
// ==========================================

// Log após criar usuário
userSchema.post('save', function(doc) {
  if (doc.isNew) {
    console.log(`✅ Novo usuário criado: ${doc.email}`);
  }
});

// ==========================================
// EXPORTAR MODEL
// ==========================================
const User = mongoose.model('User', userSchema);

module.exports = User;