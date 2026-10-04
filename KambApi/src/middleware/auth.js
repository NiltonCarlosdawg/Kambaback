// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const AppError = require('./AppError');

// ==========================================
// SECRETS – CORREÇÃO: Agora definidos do process.env
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// Validação crítica: não inicia sem secrets configurados
if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET ou REFRESH_SECRET não configurados no ambiente!');
}

if (JWT_SECRET.length < 32 || REFRESH_SECRET.length < 32) {
  console.warn('⚠️ AVISO: Secrets JWT devem ter pelo menos 32 caracteres para segurança adequada!');
}

if (JWT_SECRET === REFRESH_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET e REFRESH_SECRET devem ser diferentes!');
}

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

    // 2. Verifica token usando JWT_SECRET (agora definido)
    const decoded = await verificarToken(token, JWT_SECRET);

    // 3. Busca usuário — SÓ CAMPOS QUE REALMENTE EXISTEM NO SCHEMA ATUAL
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
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: '7d' });

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
      select: { id: true, refreshToken: true }
    });

    if (!user) return next(new AppError('Token inválido.', 401));

    // Verifica se o refresh token no banco corresponde ao enviado
    const encRefresh = require('../utils/encryption');
    if (!encRefresh.compareHash(user.refreshToken, encRefresh.hash(token))) {
      return next(new AppError('Sessão inválida ou token reutilizado.', 401));
    }

    const { accessToken, refreshToken: novoRefresh } = gerarTokens(user.id);

    // Salva novo refresh token no banco (segurança máxima - rotação de tokens)
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: encRefresh.hash(novoRefresh) }
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
 * Nota: Esta função retorna o middleware configurado
 */
const rateLimitPorUsuario = (windowMs = 15 * 60 * 1000, max = 120) => {
  // Importação dinâmica para evitar dependência circular se necessário
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs,
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
};