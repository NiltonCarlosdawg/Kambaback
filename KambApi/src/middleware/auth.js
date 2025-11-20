// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { AppError, AuthenticationError, AuthorizationError } = require('./errorHandler');
const { JWT_SECRET, JWT_EXPIRES_IN, REFRESH_SECRET, REFRESH_EXPIRES_IN } = process.env;
const User = require('../models/User');

/**
 * ==========================================
 * VERIFICA TOKEN DE ACESSO (JWT)
 * ==========================================
 */
const verificarToken = (token, secret) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return reject(new AuthenticationError('Token expirado. Faça login novamente.'));
        }
        if (err.name === 'JsonWebTokenError') {
          return reject(new AuthenticationError('Token inválido.'));
        }
        reject(new AuthenticationError('Erro de autenticação.'));
      }
      resolve(decoded);
    });
  });
};

/**
 * ==========================================
 * MIDDLEWARE PRINCIPAL DE AUTENTICAÇÃO
 * ==========================================
 */
const protegerRota = async (req, res, next) => {
  try {
    let token;

    // 1. Verifica header Authorization
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AuthenticationError('Acesso negado. Token não fornecido.'));
    }

    // 2. Verifica token de acesso
    const decoded = await verificarToken(token, JWT_SECRET);

    // 3. Busca usuário (bloqueado, deletado, etc.)
    const usuario = await User.findById(decoded.id);
    if (!usuario) {
      return next(new AuthenticationError('Usuário não existe mais.'));
    }

    if (usuario.estaBloqueado()) {
      return next(new AuthenticationError('Conta bloqueada temporariamente. Tente mais tarde.'));
    }

    if (usuario.senhaMudadaApos && decoded.iat * 1000 < usuario.senhaMudadaApos) {
      return next(new AuthenticationError('Senha alterada recentemente. Faça login novamente.'));
    }

    // 4. Tudo ok → adiciona usuário na requisição
    req.usuario = usuario;
    req.usuarioId = usuario._id;

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * GERAR PAIR DE TOKENS
 * ==========================================
 */
const gerarTokens = (usuarioId) => {
  const accessToken = jwt.sign(
    { id: usuarioId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: usuarioId },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

/**
 * ==========================================
 * VERIFICAR PERMISSÃO (opcional - para admin, etc.)
 * ==========================================
 */
const restringirA = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.role)) {
      return next(new AuthorizationError('Você não tem permissão para esta ação.'));
    }
    next();
  };
};

module.exports = {
  protegerRota,
  gerarTokens,
  verificarToken,
  restringirA
};