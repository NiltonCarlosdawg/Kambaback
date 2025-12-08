// src/middleware/AppError.js
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'ERROR', errors = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.code = code;           // ex: VALIDATION_ERROR, AUTH_ERROR
    this.errors = errors;       // array de erros detalhados
    this.isOperational = true;  // erro previsível (não crash)

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;