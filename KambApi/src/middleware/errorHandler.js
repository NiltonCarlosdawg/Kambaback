// src/middleware/errorHandler.js
const { HTTP_STATUS } = require('../config/constants');
const AppError = require('./AppError'); // ✅ IMPORTAR EM VEZ DE DUPLICAR

// ==========================================
// ERROS ESPECÍFICOS (herdam de AppError)
// ==========================================

class ValidationError extends AppError {
  constructor(message, errors = null) {
    super(message, HTTP_STATUS.BAD_REQUEST, 'VALIDATION_ERROR', errors);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Credenciais inválidas') {
    super(message, HTTP_STATUS.UNAUTHORIZED, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Sem autorização') {
    super(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN_ERROR');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Recurso já existe') {
    super(message, HTTP_STATUS.CONFLICT, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

class BusinessError extends AppError {
  constructor(message, statusCode = HTTP_STATUS.BAD_REQUEST) {
    super(message, statusCode, 'BUSINESS_ERROR');
    this.name = 'BusinessError';
  }
}

// ==========================================
// HANDLERS DE ERROS PRISMA
// ==========================================

const handlePrismaUniqueConstraintError = (err) => {
  const field = err.meta?.target?.[0] || 'campo';
  return new ConflictError(`${field} já está em uso. Por favor, escolhe outro.`);
};

const handlePrismaForeignKeyError = () => {
  return new ValidationError('Registro relacionado não encontrado');
};

// ==========================================
// UTILITÁRIOS
// ==========================================

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const isOperationalError = (error) => error instanceof AppError && error.isOperational;

// ==========================================
// LOGGER DE ERROS
// ==========================================

const logError = (err, req) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  const errorInfo = {
    timestamp: new Date().toISOString(),
    message: err.message,
    code: err.code || 'INTERNAL_ERROR',
    statusCode: err.statusCode || 500,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user?.id || 'Não autenticado'
  };

  if (isDev) {
    console.error('\n╔═══════════════════════════════════════════╗');
    console.error('║              ❌ ERRO CAPTURADO            ║');
    console.error('╠═══════════════════════════════════════════╣');
    console.error(`║ Timestamp: ${errorInfo.timestamp}`);
    console.error(`║ Code: ${errorInfo.code}`);
    console.error(`║ Status: ${errorInfo.statusCode}`);
    console.error(`║ Rota: ${errorInfo.method} ${errorInfo.url}`);
    console.error(`║ Usuário: ${errorInfo.userId}`);
    console.error('╠═══════════════════════════════════════════╣');
    console.error(`║ Mensagem: ${err.message}`);
    if (err.errors) console.error(`║ Errors: ${JSON.stringify(err.errors)}`);
    console.error('╚═══════════════════════════════════════════╝\n');
    
    if (err.stack) console.error('Stack:', err.stack, '\n');
  } else {
    console.error(`[${errorInfo.timestamp}] ${errorInfo.code} ${errorInfo.statusCode} - ${errorInfo.method} ${errorInfo.url} - User:${errorInfo.userId} - ${err.message}`);
  }
};

// ==========================================
// MIDDLEWARE PRINCIPAL
// ==========================================

const errorHandler = (err, req, res, next) => {
  logError(err, req);

  let error = err;

  // Tratamento Prisma
  if (err.code === 'P2002') error = handlePrismaUniqueConstraintError(err);
  if (err.code === 'P2003') error = handlePrismaForeignKeyError();
  if (err.code === 'P2025') error = new NotFoundError('Registro não encontrado');
  if (err.code === 'P2021') error = new BusinessError('Tabela não existe - funcionalidade indisponível', 503);
  if (err.name === 'PrismaClientValidationError') error = new ValidationError('Dados inválidos para o banco');

  // Tratamento JWT
  if (err.name === 'JsonWebTokenError') error = new AuthenticationError('Token inválido');
  if (err.name === 'TokenExpiredError') error = new AuthenticationError('Token expirado. Faça login novamente.');

  // JSON inválido
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new ValidationError('JSON inválido na requisição');
  }

  const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_ERROR;
  const isDev = process.env.NODE_ENV === 'development';

  const response = {
    success: false,
    error: {
      message: error.message || 'Erro interno do servidor',
      code: error.code || 'INTERNAL_ERROR',
      statusCode: statusCode
    }
  };

  if (error.errors) response.error.errors = error.errors;

  if (isDev) {
    response.error.stack = err.stack;
    response.debug = {
      originalError: err.message,
      prismaCode: err.code,
      method: req.method,
      url: req.originalUrl
    };
  }

  // Mensagens amigáveis para angolanos
  const mensagensAmigaveis = {
    400: 'Dados inválidos, kamba! Verifica e tenta novamente.',
    401: 'Precisas fazer login primeiro, mano!',
    403: 'Não tens permissão para isso, kota!',
    404: 'Não encontrámos o que procuras, kamba!',
    409: 'Já existe um registo com esses dados, mano!',
    429: 'Muitas tentativas, kamba! Espera um bocado.',
    500: 'Erro no sistema, kamba! Estamos a resolver.',
    503: 'Serviço temporariamente indisponível, kamba.'
  };

  if (mensagensAmigaveis[statusCode]) {
    response.error.mensagemAmigavel = mensagensAmigaveis[statusCode];
  }

  res.status(statusCode).json(response);
};

const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Rota ${req.method} ${req.originalUrl} não encontrada, kamba!`));
};

// ==========================================
// EXPORTS
// ==========================================
module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  isOperationalError,
  // Classes re-exportadas para conveniência
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessError
};