// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma'); // ← PRISMA + POSTGRES
const AppError = require('../middleware/AppError');

// Secrets (garante que tens no .env)
const JWT_SECRET = process.env.JWT_SECRET || 'kwanza_angola_2025_super_secreto';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'kwanza_refresh_angola_2025_muito_secreto';

// ==========================================
// REGISTRO
// ==========================================
const registrar = async (req, res, next) => {
  const { nome, email, telefone, senha } = req.body;

  try {
    // Verifica se já existe email ou telefone
    const existe = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { telefone }
        ]
      }
    });

    if (existe) {
      if (existe.email === email.toLowerCase()) {
        return next(new AppError('Este email já está registrado', 409));
      }
      return next(new AppError('Este telefone já está registrado', 409));
    }

    // Cria usuário com senha hasheada
    const senhaHash = await bcrypt.hash(senha, 12);

    const usuario = await prisma.user.create({
      data: {
        nome,
        email: email.toLowerCase(),
        telefone,
        senha: senhaHash,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        ativo: true,
        verificado: true,
        criadoEm: true
      }
    });

    // Gera tokens
    const accessToken = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: usuario.id }, REFRESH_SECRET, { expiresIn: '7d' });

    // Salva refresh token no banco
    await prisma.user.update({
      where: { id: usuario.id },
      data: { refreshToken }
    });

    return res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso! Bem-vindo ao Kamba 🇦🇴',
      usuario,
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

    // Gera tokens
    const accessToken = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: usuario.id }, REFRESH_SECRET, { expiresIn: '7d' });

    // Atualiza refresh token + último login
    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        refreshToken,
        ultimoLogin: new Date()
      }
    });

    // Dados públicos do usuário
    const dadosUsuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      verificado: usuario.verificado
    };

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: `Bem-vindo de volta, ${usuario.nome.split(' ')[0]}!`,
      usuario: dadosUsuario,
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

  if (!token) return next(new AppError('Refresh token não fornecido', 401));

  try {
    const decoded = jwt.verify(token, REFRESH_SECRET);
    const usuario = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!usuario || usuario.refreshToken !== token) {
      return next(new AppError('Token inválido', 403));
    }

    const novoAccessToken = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '15m' });

    return res.json({
      success: true,
      message: 'Token renovado',
      accessToken: novoAccessToken
    });

  } catch (err) {
    return next(new AppError('Sessão expirada. Faça login novamente.', 403));
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
        ativo: true,
        verificado: true,
        criadoEm: true,
        ultimoLogin: true
      }
    });

    if (!usuario) return next(new AppError('Usuário não encontrado', 404));

    return res.json({
      success: true,
      message: 'Perfil carregado',
      usuario
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// ATUALIZAR PERFIL
// ==========================================
const atualizarPerfil = async (req, res, next) => {
  const camposPermitidos = ['nome', 'telefone'];
  const dados = {};

  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      dados[campo] = req.body[campo];
    }
  }

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nenhum dado válido para atualizar', 400));
  }

  try {
    const usuario = await prisma.user.update({
      where: { id: req.user.id },
      data: dados,
      select: { id: true, nome: true, email: true, telefone: true }
    });

    return res.json({
      success: true,
      message: 'Perfil atualizado com sucesso!',
      usuario
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
  atualizarPerfil
};