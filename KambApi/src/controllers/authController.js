// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

// ==========================================
// SECRETS - CORRIGIDO: SEM FALLBACK INSEGURO
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// Validação em runtime (defesa adicional)
if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET ou REFRESH_SECRET não configurados! Aplicação não pode iniciar.');
}

// ==========================================
// REGISTRO
// ==========================================
const registrar = async (req, res, next) => {
  const { nome, email, telefone, senha, dataNascimento, sexo, morada, rendaMensalMedia } = req.body;

  try {
    // Verifica duplicidade
    const existe = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { telefone: telefone || undefined }
        ]
      }
    });

    if (existe) {
      const msg = existe.email === email.toLowerCase()
        ? 'Este email já está registrado'
        : 'Este telefone já está registrado';
      return next(new AppError(msg, 409));
    }

    // Hash senha com 12 rounds (seguro)
    const senhaHash = await bcrypt.hash(senha, 12);

    // Cria usuário
    const usuario = await prisma.user.create({
      data: {
        nome: nome.trim(),
        email: email.toLowerCase(),
        telefone,
        senha: senhaHash,
        dataNascimento: new Date(dataNascimento),
        sexo,
        morada,
        rendaMensalMedia: rendaMensalMedia ? parseFloat(rendaMensalMedia) : 0,
        role: 'user',
        ativo: true
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        dataNascimento: true,
        sexo: true,
        morada: true,
        role: true,
        criadoEm: true
      }
    });

    // Gera tokens
    const accessToken = jwt.sign(
      { id: usuario.id },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: usuario.id },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Salva refresh token no banco
    await prisma.user.update({
      where: { id: usuario.id },
      data: { refreshToken }
    });

    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso! Bem-vindo ao KambaPro 🇦🇴',
      user: usuario,
      accessToken,
      refreshToken
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// LOGIN
// ==========================================
const login = async (req, res, next) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return next(new AppError('Email e senha são obrigatórios', 400));
  }

  try {
    const usuario = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return next(new AppError('Email ou senha incorretos', 401));
    }

    if (!usuario.ativo) {
      return next(new AppError('Conta desativada. Contacta o suporte.', 403));
    }

    if (usuario.bloqueado) {
      return next(new AppError('Conta bloqueada temporariamente.', 403));
    }

    // Gera novos tokens
    const accessToken = jwt.sign(
      { id: usuario.id },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: usuario.id },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Atualiza último login + refresh token
    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        refreshToken,
        ultimoLogin: new Date()
      }
    });

    const dadosUsuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      role: usuario.role
    };

    // Cookie seguro para refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    });

    res.json({
      success: true,
      message: `Bem-vindo de volta, ${usuario.nome.split(' ')[0]}!`,
      user: dadosUsuario,
      accessToken
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// REFRESH TOKEN
// ==========================================
const refresh = async (req, res, next) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;

  if (!token) {
    return next(new AppError('Refresh token não fornecido', 401));
  }

  try {
    const decoded = jwt.verify(token, REFRESH_SECRET);

    const usuario = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, refreshToken: true, ativo: true, bloqueado: true }
    });

    if (!usuario) {
      return next(new AppError('Token inválido', 403));
    }

    if (!usuario.ativo || usuario.bloqueado) {
      return next(new AppError('Conta inativa ou bloqueada', 403));
    }

    // Valida se o token bate com o armazenado (previne replay attacks)
    if (usuario.refreshToken !== token) {
      return next(new AppError('Token inválido ou já foi revogado', 403));
    }

    // Gera novo access token
    const novoAccessToken = jwt.sign(
      { id: usuario.id },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      message: 'Token renovado',
      accessToken: novoAccessToken
    });

  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(new AppError('Sessão expirada. Faça login novamente.', 403));
    }
    next(err);
  }
};

// ==========================================
// PERFIL
// ==========================================
const perfil = async (req, res, next) => {
  try {
    const usuario = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        dataNascimento: true,
        sexo: true,
        morada: true,
        rendaMensalMedia: true,
        role: true,
        criadoEm: true,
        ultimoLogin: true
      }
    });

    if (!usuario) {
      return next(new AppError('Usuário não encontrado', 404));
    }

    res.json({
      success: true,
      message: 'Perfil carregado',
      user: usuario
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// ATUALIZAR PERFIL
// ==========================================
const atualizarPerfil = async (req, res, next) => {
  const camposPermitidos = ['nome', 'telefone', 'morada', 'sexo', 'rendaMensalMedia'];
  const dados = {};

  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      if (campo === 'rendaMensalMedia') {
        dados[campo] = parseFloat(req.body[campo]);
      } else {
        dados[campo] = req.body[campo];
      }
    }
  }

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nenhum dado válido para atualizar', 400));
  }

  try {
    const usuario = await prisma.user.update({
      where: { id: req.user.id },
      data: dados,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        morada: true,
        sexo: true,
        role: true
      }
    });

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      user: usuario
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return next(new AppError('Este telefone já está em uso', 409));
    }
    next(err);
  }
};

// ==========================================
// LOGOUT (REVOGA REFRESH TOKEN)
// ==========================================
const logout = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null }
    });

    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  registrar,
  login,
  refresh,
  perfil,
  atualizarPerfil,
  logout
};