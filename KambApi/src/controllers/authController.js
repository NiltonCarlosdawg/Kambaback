// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { gerarTokens } = require('../middleware/auth');
const AppError = require('../middleware/AppError');

/**
 * REGISTRO DE NOVA CONTA
 */
const registrar = async (req, res, next) => {
  const { nome, email, telefone, senha } = req.body;

  if (!nome || !email || !telefone || !senha) {
    return next(new AppError('Todos os campos são obrigatórios', 400));
  }

  try {
    // Verifica duplicidade
    const existe = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { telefone }
        ]
      }
    });

    if (existe) {
      const msg = existe.email === email.toLowerCase()
        ? 'Este email já está registrado'
        : 'Este telefone já está registrado';
      return next(new AppError(msg, 409));
    }

    // Criptografa senha
    const senhaHash = await bcrypt.hash(senha, 12);

    // Cria usuário — apenas campos que existem no schema atual
    const user = await prisma.user.create({
      data: {
        nome: nome.trim(),
        email: email.toLowerCase(),
        telefone,
        senha: senhaHash
        // role → @default("user") no schema
        // ativo → @default(true)
        // criadoEm → @default(now())
        // ultimoLogin → será atualizado no login
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        role: true,
        criadoEm: true
      }
    });

    const { accessToken, refreshToken } = gerarTokens(user.id);

    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso! Bem-vindo ao KambaPro, kamba!',
      user,
      accessToken,
      refreshToken
    });

  } catch (err) {
    next(err);
  }
};

/**
 * LOGIN
 */
const login = async (req, res, next) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return next(new AppError('Email e senha são obrigatórios', 400));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        senha: true,
        role: true,
        ativo: true,
        bloqueado: true
      }
    });

    // Conta inativa ou bloqueada
    if (!user) {
      return next(new AppError('Email ou senha incorretos', 401));
    }
    if (!user.ativo) {
      return next(new AppError('Conta desativada. Contacta o suporte.', 403));
    }
    if (user.bloqueado) {
      return next(new AppError('Conta bloqueada temporariamente.', 403));
    }

    // Verifica senha
    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return next(new AppError('Email ou senha incorretos', 401));
    }

    // Atualiza último login
    await prisma.user.update({
      where: { id: user.id },
      data: { ultimoLogin: new Date() }
    });

    const { accessToken, refreshToken } = gerarTokens(user.id);

    const userPublic = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      telefone: user.telefone,
      role: user.role
    };

    // Cookie seguro (opcional — recomendado)
    res.cookie('kamba_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: `Bem-vindo de volta, ${user.nome.split(' ')[0]}!`,
      user: userPublic,
      accessToken,
      refreshToken
    });

  } catch (err) {
    next(err);
  }
};

/**
 * REFRESH TOKEN
 */
const refresh = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token não fornecido', 401));
  }

  try {
    const { verificarToken } = require('../middleware/auth');
    const decoded = await verificarToken(refreshToken, process.env.REFRESH_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true }
    });

    if (!user) {
      return next(new AppError('Token inválido', 401));
    }

    const { accessToken, refreshToken: novoRefresh } = gerarTokens(user.id);

    // Salva novo refresh no banco (segurança máxima)
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
    next(new AppError('Sessão expirada. Faça login novamente.', 401));
  }
};

/**
 * PERFIL DO USUÁRIO
 */
const perfil = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        role: true,
        criadoEm: true,
        ultimoLogin: true
      }
    });

    res.json({
      success: true,
      message: 'Perfil carregado',
      user
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ATUALIZAR PERFIL
 */
const atualizarPerfil = async (req, res, next) => {
  const camposPermitidos = ['nome', 'telefone'];
  const dados = {};

  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined && req.body[campo] !== '') {
      dados[campo] = req.body[campo];
    }
  }

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nada para atualizar', 400));
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: dados,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        role: true
      }
    });

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      user
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return next(new AppError('Este telefone já está em uso', 409));
    }
    next(err);
  }
};

module.exports = {
  registrar,
  login,
  refresh,
  perfil,
  atualizarPerfil
};