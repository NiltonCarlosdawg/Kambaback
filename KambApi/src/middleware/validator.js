// src/middleware/validator.js
const Joi = require('joi');
const AppError = require('./AppError');

/**
 * VALIDADOR GENÉRICO
 */
const validar = (schema, target = 'body') => {
  return (req, res, next) => {
    const source = target === 'query' ? req.query : req.body;
    const { error, value } = schema.validate(source, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const erros = error.details.map(d => ({
        campo: d.context.key || d.context.label,
        mensagem: d.message.replace(/['"]/g, '')
      }));

      return next(new AppError('Dados inválidos, kamba! Verifica e tenta novamente.', 400, 'VALIDATION_ERROR', erros));
    }

    if (target === 'query') req.query = value;
    else req.body = value;
    next();
  };
};

/**
 * ==========================================
 * SCHEMAS DE VALIDAÇÃO - AUTENTICAÇÃO
 * ==========================================
 */

// REGISTRO (100% Sincronizado com a migração add_user_details)
const registroSchema = Joi.object({
  nome: Joi.string().min(2).max(50).trim().required().messages({
    'string.min': 'Nome deve ter pelo menos 2 caracteres',
    'any.required': 'Nome é obrigatório'
  }),

  email: Joi.string().email({ tlds: { allow: false } }).trim().lowercase().required().messages({
    'string.email': 'Email inválido',
    'any.required': 'Email é obrigatório'
  }),

  telefone: Joi.string().pattern(/^9[1-9]\d{7}$/).required().messages({
    'string.pattern.base': 'Telefone angolano inválido (ex: 923456789)',
    'any.required': 'Telefone é obrigatório'
  }),

  senha: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Senha deve ter no mínimo 8 caracteres',
      'string.pattern.base': 'Senha deve conter letras maiúsculas, minúsculas e números',
      'any.required': 'Senha é obrigatória'
    }),

  // NOVOS CAMPOS OBRIGATÓRIOS
  dataNascimento: Joi.date().iso().required().messages({
    'date.base': 'Data de nascimento inválida',
    'any.required': 'Data de nascimento é obrigatória'
  }),

  sexo: Joi.string().valid('Masculino', 'Feminino', 'Outro').required().messages({
    'any.only': 'Sexo deve ser Masculino, Feminino ou Outro',
    'any.required': 'Sexo é obrigatório'
  }),

  morada: Joi.string().min(3).trim().required().messages({
    'string.min': 'Morada deve ser mais específica (ex: Luanda)',
    'any.required': 'Morada é obrigatória'
  }),

  rendaMensalMedia: Joi.number().min(0).default(0).optional()
});

// LOGIN
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  senha: Joi.string().required()
});

// ATUALIZAR PERFIL (Incluindo novos campos opcionais)
const atualizarPerfilSchema = Joi.object({
  nome: Joi.string().min(2).max(50).trim().optional(),
  telefone: Joi.string().pattern(/^9[1-9]\d{7}$/).optional(),
  morada: Joi.string().optional(),
  sexo: Joi.string().valid('Masculino', 'Feminino', 'Outro').optional(),
  rendaMensalMedia: Joi.number().min(0).optional()
}).min(1);

/**
 * ==========================================
 * SCHEMAS DE VALIDAÇÃO - CATEGORIAS
 * ==========================================
 */

// CRIAR CATEGORIA
const criarCategoriaSchema = Joi.object({
  nome: Joi.string()
    .min(2)
    .max(40)
    .trim()
    .required()
    .messages({ 
      'string.min': 'Nome deve ter pelo menos 2 caracteres',
      'string.max': 'Nome deve ter no máximo 40 caracteres',
      'any.required': 'Nome da categoria é obrigatório' 
    }),
  
  // Tipos intuitivos em português
  tipo: Joi.string()
    .trim()
    .uppercase() // Converte para maiúsculas antes de validar
    .valid('ESSENCIAL', 'FLEXIVEL', 'POUPANCA', 'RENDIMENTO')
    .required()
    .messages({ 
      'any.required': 'Tipo é obrigatório',
      'any.only': 'Tipo deve ser: ESSENCIAL, FLEXIVEL, POUPANCA ou RENDIMENTO'
    }),
  
  cor: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({ 
      'string.pattern.base': 'Cor deve ser hexadecimal (ex: #FF6384)' 
    }),
  
  icone: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Nome do ícone deve ter no máximo 50 caracteres'
    })
});

// ATUALIZAR CATEGORIA
const atualizarCategoriaSchema = Joi.object({
  nome: Joi.string()
    .min(2)
    .max(40)
    .trim()
    .optional()
    .messages({ 
      'string.min': 'Nome deve ter pelo menos 2 caracteres',
      'string.max': 'Nome deve ter no máximo 40 caracteres'
    }),
  
  cor: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({ 
      'string.pattern.base': 'Cor deve ser hexadecimal (ex: #FF6384)' 
    }),
  
  icone: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Nome do ícone deve ter no máximo 50 caracteres'
    }),
  
  ordem: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Ordem deve ser um número positivo',
      'number.integer': 'Ordem deve ser um número inteiro'
    }),
  
  ativa: Joi.boolean()
    .optional()
})
.min(1)
.messages({ 
  'object.min': 'Pelo menos um campo deve ser enviado para atualização' 
});

const esqueciSenhaSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).trim().lowercase().required().messages({
    'string.email': 'Email inválido',
    'any.required': 'Email é obrigatório',
  }),
});

const redefinirSenhaSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).trim().lowercase().required().messages({
    'string.email': 'Email inválido',
    'any.required': 'Email é obrigatório',
  }),
  otp: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'OTP deve ter exatamente 6 dígitos',
    'string.pattern.base': 'OTP deve conter apenas números',
    'any.required': 'OTP é obrigatório',
  }),
  novaSenha: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Nova senha deve ter no mínimo 8 caracteres',
      'string.pattern.base': 'Nova senha deve conter letras maiúsculas, minúsculas e números',
      'any.required': 'Nova senha é obrigatória',
    }),
});

module.exports = {
  validar,
  registroSchema,
  loginSchema,
  atualizarPerfilSchema,
  criarCategoriaSchema,
  atualizarCategoriaSchema,
  esqueciSenhaSchema,
  redefinirSenhaSchema,
};