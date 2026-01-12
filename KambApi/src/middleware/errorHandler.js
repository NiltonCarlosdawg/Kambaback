// src/middleware/errorHandler.js
const { HTTP_STATUS } = require('../config/constants');

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

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, details);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Credenciais inválidas') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Sem autorização') {
    super(message, HTTP_STATUS.FORBIDDEN);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, HTTP_STATUS.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Recurso já existe') {
    super(message, HTTP_STATUS.CONFLICT);
    this.name = 'ConflictError';
  }
}

class BusinessError extends AppError {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message, statusCode);
    this.name = 'BusinessError';
  }
}

// ==========================================
// HANDLERS DE ERROS ESPECÍFICOS
// ==========================================

const handlePrismaValidationError = (err) => {
  const message = err.message || 'Erro de validação no banco de dados';
  return new ValidationError(message);
};

const handlePrismaUniqueConstraintError = (err) => {
  const field = err.meta?.target?.[0] || 'campo';
  const message = `${field} já está em uso. Por favor, escolhe outro.`;
  return new ConflictError(message);
};

const handlePrismaForeignKeyError = (err) => {
  const message = 'Registro relacionado não encontrado';
  return new ValidationError(message);
};

const handleJWTError = () => {
  return new AuthenticationError('Token inválido');
};

const handleJWTExpiredError = () => {
  return new AuthenticationError('Token expirado. Faça login novamente.');
};

// ==========================================
// LOGGER DE ERROS
// ==========================================
const logError = (err, req) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  const errorInfo = {
    timestamp: new Date().toISOString(),
    message: err.message,
    statusCode: err.statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || 'Não autenticado'
  };

  if (isDev) {
    console.error('\n╔═══════════════════════════════════════════╗');
    console.error('║              ❌ ERRO CAPTURADO  ❌         ║');
    console.error('╠═══════════════════════════════════════════╣');
    console.error(`║ Timestamp: ${errorInfo.timestamp}`);
    console.error(`║ Status: ${errorInfo.statusCode || 500}`);
    console.error(`║ Rota: ${errorInfo.method} ${errorInfo.url}`);
    console.error(`║ IP: ${errorInfo.ip}`);
    console.error(`║ Usuário: ${errorInfo.userId}`);
    console.error('╠═══════════════════════════════════════════╣');
    console.error(`║ Mensagem: ${err.message}`);
    console.error('╚═══════════════════════════════════════════╝\n');
    
    if (err.stack) {
      console.error('Stack Trace:');
      console.error(err.stack);
      console.error('\n');
    }
  } else {
    console.error(`[${errorInfo.timestamp}] ${errorInfo.statusCode} - ${errorInfo.method} ${errorInfo.url} - ${err.message}`);
  }
};

// ==========================================
// MIDDLEWARE PRINCIPAL DE TRATAMENTO DE ERROS
// ==========================================
const errorHandler = (err, req, res, next) => {
  logError(err, req);

  let error = { ...err };
  error.message = err.message;

  // ========================================
  // TRATAMENTO DE ERROS PRISMA
  // ========================================
  
  // P2002: Unique constraint violation
  if (err.code === 'P2002') {
    error = handlePrismaUniqueConstraintError(err);
  }

  // P2003: Foreign key constraint violation
  if (err.code === 'P2003') {
    error = handlePrismaForeignKeyError(err);
  }

  // P2025: Record not found
  if (err.code === 'P2025') {
    error = new NotFoundError('Registro não encontrado');
  }

  // Prisma validation error
  if (err.name === 'PrismaClientValidationError') {
    error = handlePrismaValidationError(err);
  }

  // ========================================
  // TRATAMENTO DE ERROS JWT
  // ========================================
  
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // ========================================
  // TRATAMENTO DE ERROS DE SINTAXE JSON
  // ========================================
  
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
      message: error.message || 'Erro interno do servidor',
      statusCode: statusCode,
      timestamp: new Date().toISOString()
    }
  };

  if (error.details) {
    response.error.details = error.details;
  }

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

  if (mensagensAmigaveis[statusCode]) {
    response.error.mensagemAmigavel = mensagensAmigaveis[statusCode];
  }

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
// EXPORTS - CORRIGIDO (APENAS UM EXPORT)
// ==========================================
module.exports = {
  // Middleware principal
  errorHandler,
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