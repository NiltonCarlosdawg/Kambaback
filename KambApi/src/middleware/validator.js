// src/middleware/validator.js
const Joi = require('joi');
const { AppError } = require('./errorHandler');

/**
 * ==========================================
 * FUNÇÃO GENÉRICA DE VALIDAÇÃO
 * ==========================================
 */
const validar = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,    // mostra todos os erros de uma vez
      stripUnknown: true,   // remove campos não esperados
      convert: true
    });

    if (error) {
      const erros = error.details.map(d => ({
        campo: d.context.key || d.context.label,
        mensagem: d.message.replace(/['"]/g, '') // limpa as aspas extras do Joi
      }));

      return next(new AppError('Dados inválidos', 400, 'VALIDATION_ERROR', erros));
    }

    // Substitui req.body pelos dados já limpos/validados
    req.body = value;
    next();
  };
};

/**
 * ==========================================
 * SCHEMAS DE VALIDAÇÃO
 * ==========================================
 */

// Registro de novo usuário
const registroSchema = Joi.object({
  nome: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .required()
    .messages({
      'string.min': 'Nome deve ter pelo menos 2 caracteres',
      'string.max': 'Nome muito longo',
      'any.required': 'Nome é obrigatório'
    }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Email inválido',
      'any.required': 'Email é obrigatório'
    }),

  telefone: Joi.string()
    .pattern(/^9[123456789]\d{7}$/)
    .required()
    .messages({
      'string.pattern.base': 'Telefone angolano inválido (ex: 923456789)',
      'any.required': 'Telefone é obrigatório'
    }),

  senha: Joi.string()
    .min(8)
    .max(50)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Senha deve ter no mínimo 8 caracteres',
      'string.pattern.base': 'Senha fraca: use maiúscula, número e símbolo',
      'any.required': 'Senha é obrigatória'
    }),

  confirmarSenha: Joi.any()
    .valid(Joi.ref('senha'))
    .required()
    .messages({
      'any.only': 'As senhas não coincidem',
      'any.required': 'Confirmação de senha é obrigatória'
    })
});

// Login
const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Email inválido',
      'any.required': 'Email é obrigatório'
    }),

  senha: Joi.string()
    .required()
    .messages({
      'any.required': 'Senha é obrigatória'
    })
});

// Refresh Token
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token é obrigatório'
    })
});

// Atualizar perfil (opcional)
const atualizarPerfilSchema = Joi.object({
  nome: Joi.string().min(2).max(50).trim(),
  telefone: Joi.string().pattern(/^9[123456789]\d{7}$/).messages({
    'string.pattern.base': 'Telefone angolano inválido'
  }),
  preferencias: Joi.object({
    moeda: Joi.string().valid('AOA', 'USD', 'EUR'),
    tema: Joi.string().valid('light', 'dark', 'auto'),
    notificacoes: Joi.boolean()
  })
}).min(1); // pelo menos um campo para atualizar

module.exports = {
  validar,
  registroSchema,
  loginSchema,
  refreshTokenSchema,
  atualizarPerfilSchema
};