// src/middleware/errorHandler.js
const { HTTP_STATUS, MENSAGENS_ERRO } = require('../config/constants');

// ==========================================
// CLASSE DE ERRO PERSONALIZADA
// ==========================================
class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// ==========================================
// ERROS ESPECÍFICOS
// ==========================================

// Erro de validação
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, details);
    this.name = 'ValidationError';
  }
}

// Erro de autenticação
class AuthenticationError extends AppError {
  constructor(message = MENSAGENS_ERRO.CREDENCIAIS_INVALIDAS) {
    super(message, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'AuthenticationError';
  }
}

// Erro de autorização
class AuthorizationError extends AppError {
  constructor(message = MENSAGENS_ERRO.SEM_AUTORIZACAO) {
    super(message, HTTP_STATUS.FORBIDDEN);
    this.name = 'AuthorizationError';
  }
}

// Erro de recurso não encontrado
class NotFoundError extends AppError {
  constructor(message = MENSAGENS_ERRO.RECURSO_NAO_ENCONTRADO) {
    super(message, HTTP_STATUS.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

// Erro de conflito (duplicação)
class ConflictError extends AppError {
  constructor(message = MENSAGENS_ERRO.JA_EXISTE) {
    super(message, HTTP_STATUS.CONFLICT);
    this.name = 'ConflictError';
  }
}

// Erro de negócio
class BusinessError extends AppError {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message, statusCode);
    this.name = 'BusinessError';
  }
}

// ==========================================
// HANDLER DE ERROS DO MONGOOSE
// ==========================================

// Erro de validação do Mongoose
const handleMongooseValidationError = (err) => {
  const errors = Object.values(err.errors).map(val => ({
    field: val.path,
    message: val.message
  }));
  
  const message = errors.map(e => `${e.field}: ${e.message}`).join(', ');
  return new ValidationError(message, errors);
};

// Erro de cast do Mongoose (ID inválido)
const handleMongooseCastError = (err) => {
  const message = `Valor inválido para o campo ${err.path}: ${err.value}`;
  return new ValidationError(message);
};

// Erro de duplicação (chave única)
const handleMongooseDuplicateError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} "${value}" já está em uso. Por favor, escolhe outro.`;
  return new ConflictError(message);
};

// ==========================================
// HANDLER DE ERROS JWT
// ==========================================

// Token inválido
const handleJWTError = () => {
  return new AuthenticationError(MENSAGENS_ERRO.TOKEN_INVALIDO);
};

// Token expirado
const handleJWTExpiredError = () => {
  return new AuthenticationError(MENSAGENS_ERRO.TOKEN_EXPIRADO);
};

// ==========================================
// LOGGER DE ERROS
// ==========================================
const logError = (err, req) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Informações básicas
  const errorInfo = {
    timestamp: new Date().toISOString(),
    message: err.message,
    statusCode: err.statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || 'Não autenticado'
  };

  // Em desenvolvimento: log completo
  if (isDev) {
    console.error('\n╔════════════════════════════════════════════╗');
    console.error('║              ❌  ERRO CAPTURADO  ❌         ║');
    console.error('╠════════════════════════════════════════════╣');
    console.error(`║ Timestamp: ${errorInfo.timestamp}`);
    console.error(`║ Status: ${errorInfo.statusCode || 500}`);
    console.error(`║ Rota: ${errorInfo.method} ${errorInfo.url}`);
    console.error(`║ IP: ${errorInfo.ip}`);
    console.error(`║ Usuário: ${errorInfo.userId}`);
    console.error('╠════════════════════════════════════════════╣');
    console.error(`║ Mensagem: ${err.message}`);
    console.error('╚════════════════════════════════════════════╝\n');
    
    if (err.stack) {
      console.error('Stack Trace:');
      console.error(err.stack);
      console.error('\n');
    }
  } else {
    // Em produção: log simplificado
    console.error(`[${errorInfo.timestamp}] ${errorInfo.statusCode} - ${errorInfo.method} ${errorInfo.url} - ${err.message}`);
  }

  // TODO: Integrar com serviço de log externo (Sentry, LogRocket, etc.)
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(err);
  // }
};

// ==========================================
// MIDDLEWARE PRINCIPAL DE TRATAMENTO DE ERROS
// ==========================================
const errorHandler = (err, req, res, next) => {
  // Log do erro
  logError(err, req);

  // Copiar erro para não modificar o original
  let error = { ...err };
  error.message = err.message;

  // ========================================
  // TRATAMENTO DE ERROS ESPECÍFICOS
  // ========================================

  // Erro de validação do Mongoose
  if (err.name === 'ValidationError') {
    error = handleMongooseValidationError(err);
  }

  // Erro de cast do Mongoose (ID inválido)
  if (err.name === 'CastError') {
    error = handleMongooseCastError(err);
  }

  // Erro de duplicação (código 11000)
  if (err.code === 11000) {
    error = handleMongooseDuplicateError(err);
  }

  // Erro JWT - Token inválido
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  // Erro JWT - Token expirado
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Erro de sintaxe no JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new ValidationError('JSON inválido na requisição');
  }

  // ========================================
  // CONSTRUIR RESPOSTA DE ERRO
  // ========================================
  const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_ERROR;
  const isDev = process.env.NODE_ENV === 'development';

  const response = {
    success: false,
    error: {
      message: error.message || MENSAGENS_ERRO.ERRO_SERVIDOR,
      statusCode: statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Adicionar detalhes extras se disponíveis
  if (error.details) {
    response.error.details = error.details;
  }

  // Adicionar informações adicionais em desenvolvimento
  if (isDev) {
    response.error.stack = err.stack;
    response.error.name = err.name;
    response.debug = {
      originalError: err.message,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userId: req.user?.id
    };
  }

  // Mensagens amigáveis para usuários angolanos
  const mensagensAmigaveis = {
    400: 'Dados inválidos, kamba! Verifica e tenta novamente.',
    401: 'Precisas fazer login primeiro, mano!',
    403: 'Não tens permissão para isso, kota!',
    404: 'Não encontrámos o que procuras, kamba!',
    409: 'Já existe um registo com esses dados, mano!',
    429: 'Muitas tentativas, kamba! Espera um bocado.',
    500: 'Erro no sistema, kamba! Estamos a resolver.'
  };

  // Adicionar mensagem amigável
  if (mensagensAmigaveis[statusCode]) {
    response.error.mensagemAmigavel = mensagensAmigaveis[statusCode];
  }

  // Enviar resposta
  res.status(statusCode).json(response);
};

// ==========================================
// HANDLER DE ROTAS NÃO ENCONTRADAS (404)
// ==========================================
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(
    `Rota ${req.method} ${req.originalUrl} não encontrada, kamba!`
  );
  next(error);
};

// ==========================================
// HANDLER DE ERROS ASSÍNCRONOS
// ==========================================
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ==========================================
// VALIDAÇÃO DE ERROS OPERACIONAIS
// ==========================================
const isOperationalError = (error) => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

// ==========================================
// EXPORTS
// ==========================================
// ==========================================
// EXPORTS (CORRIGIDO – APENAS UM module.exports)
// ==========================================
module.exports = {
  // Middlewares
  //errorHandler,
  notFoundHandler,
  asyncHandler,

  // Classes de erro
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessError,

  // Utility
  isOperationalError
};
module.exports = errorHandler;
