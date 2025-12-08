// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const AppError = require('./AppError');

const {
  JWT_SECRET = 'kamba_pro_jwt_secret_2025_angola',
  REFRESH_SECRET = 'kamba_pro_refresh_secret_2025_angola',
  JWT_EXPIRES_IN = '15m',
  REFRESH_EXPIRES_IN = '7d'
} = process.env;

/**
 * VERIFICA TOKEN (access ou refresh)
 */
const verificarToken = (token, secret) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError')
          return reject(new AppError('Token expirado. Faça login novamente.', 401));
        if (err.name === 'JsonWebTokenError')
          return reject(new AppError('Token inválido.', 401));
        reject(new AppError('Erro de autenticação.', 401));
      }
      resolve(decoded);
    });
  });
};

/**
 * MIDDLEWARE PRINCIPAL – PROTEGE TODAS AS ROTAS PRIVADAS
 */
const protegerRota = async (req, res, next) => {
  try {
    let token;

    // 1. Busca token no header Bearer
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Acesso negado. Token não fornecido.', 401));
    }

    // 2. Verifica token
    const decoded = await verificarToken(token, JWT_SECRET);

    // 3. Busca usuário — SÓ CAMPOS QUE REALMENTE EXISTEM NO TEU SCHEMA ATUAL
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        role: true,
        ativo: true,
        bloqueado: true,
        senhaAlteradaEm: true
        // aiApiKey e aiProvider foram removidos (IA agora é global)
      }
    });

    if (!user) {
      return next(new AppError('Usuário não existe mais.', 401));
    }

    if (!user.ativo) {
      return next(new AppError('Conta desativada. Contacta o suporte.', 403));
    }

    if (user.bloqueado) {
      return next(new AppError('Conta bloqueada temporariamente.', 403));
    }

    // Verifica se senha foi alterada após emissão do token
    if (user.senhaAlteradaEm && decoded.iat * 1000 < new Date(user.senhaAlteradaEm).getTime()) {
      return next(new AppError('Senha alterada recentemente. Faça login novamente.', 401));
    }

    // Tudo perfeito → adiciona ao request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * GERAR PAR DE TOKENS
 */
const gerarTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });

  return { accessToken, refreshToken };
};

/**
 * ENDPOINT DE REFRESH TOKEN
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return next(new AppError('Refresh token não fornecido.', 401));

    const decoded = await verificarToken(token, REFRESH_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true }
    });

    if (!user) return next(new AppError('Token inválido.', 401));

    const { accessToken, refreshToken: novoRefresh } = gerarTokens(user.id);

    // Salva novo refresh token no banco (segurança máxima)
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: novoRefresh }
    });

    res.json({
      success: true,
      accessToken,
      refreshToken: novoRefresh
    });
  } catch (err) {
    next(err);
  }
};

/**
 * RESTRINGIR POR ROLE (admin, premium, etc.)
 */
const restringirA = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Você não tem permissão para esta ação.', 403));
    }
    next();
  };
};

/**
 * RATE LIMIT POR USUÁRIO
 */
const rateLimit = require('express-rate-limit');

const rateLimitPorUsuario = (janelaMs = 15 * 60 * 1000, max = 120) => {
  return rateLimit({
    windowMs: janelaMs,
    max,
    keyGenerator: (req) => req.user?.id || req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Muitas requisições, kamba! Espera um pouco'
    }
  });
};

module.exports = {
  protegerRota,
  gerarTokens,
  refreshToken,
  restringirA,
  rateLimitPorUsuario,
  verificarToken
};