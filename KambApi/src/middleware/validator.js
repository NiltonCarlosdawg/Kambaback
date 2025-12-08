// src/middleware/validator.js
const Joi = require('joi');
const AppError = require('./AppError');

/**
 * VALIDADOR GENÉRICO – JOI + AppError (funciona com o errorHandler)
 */
const validar = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,     // mostra todos os erros de uma vez
      stripUnknown: true,    // remove campos extras
      convert: true
    });

    if (error) {
      const erros = error.details.map(d => ({
        campo: d.context.key || d.context.label,
        mensagem: d.message.replace(/['"]/g, '') // limpa as aspas do Joi
      }));

      return next(new AppError('Dados inválidos', 400, 'VALIDATION_ERROR', erros));
    }

    // Substitui o body pelos dados já validados e limpos
    req.body = value;
    next();
  };
};

/**
 * ==========================================
 * SCHEMAS DE VALIDAÇÃO – 100% ANGOLA READY
 * ==========================================
 */

// REGISTRO
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
    .trim()
    .lowercase()
    .required()
    .messages({
      'string.email': 'Email inválido',
      'any.required': 'Email é obrigatório'
    }),

  telefone: Joi.string()
    .pattern(/^9[1-9]\d{7}$/)
    .required()
    .messages({
      'string.pattern.base': 'Telefone angolano inválido (ex: 923456789)',
      'any.required': 'Telefone é obrigatório'
    }),

  senha: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Senha deve ter no mínimo 8 caracteres',
      'string.pattern.base': 'Senha fraca: precisa de maiúscula, número e símbolo',
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

// LOGIN
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
}).messages({
  'object.missing': 'Email e senha são obrigatórios'
});

// OUTROS SCHEMAS (podes adicionar mais depois)
const atualizarPerfilSchema = Joi.object({
  nome: Joi.string().min(2).max(50).trim().optional(),
  telefone: Joi.string().pattern(/^9[1-9]\d{7}$/).optional()
}).min(1); // pelo menos 1 campo

module.exports = {
  validar,
  registroSchema,
  loginSchema,
  atualizarPerfilSchema
};