// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

// ==========================================
// SECRETS – sem fallback inseguro
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET ou REFRESH_SECRET não configurados!');
}

// ==========================================
// GERAR TOKENS
// ==========================================
const gerarTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

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

    const senhaHash = await bcrypt.hash(senha, 12);

    const usuario = await prisma.user.create({
      data: {
        nome,
        email: email.toLowerCase(),
        telefone,
        senha: senhaHash,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : undefined,
        sexo,
        morada,
        rendaMensalMedia: rendaMensalMedia ? parseFloat(rendaMensalMedia) : 0,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        dataNascimento: true,
        sexo: true,
        morada: true,
        rendaMensalMedia: true,
        criadoEm: true
      }
    });

    const { accessToken, refreshToken } = gerarTokens(usuario.id);

    // Salva refresh token no banco
    await prisma.user.update({
      where: { id: usuario.id },
      data: { refreshToken }
    });

    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso!',
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
      return next(new AppError('Credenciais inválidas', 401));
    }

    const { accessToken, refreshToken } = gerarTokens(usuario.id);

    await prisma.user.update({
      where: { id: usuario.id },
      data: { refreshToken, ultimoLogin: new Date() }
    });

    res.json({
      success: true,
      message: 'Login realizado',
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone
      },
      accessToken,
      refreshToken
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// REFRESH TOKEN
// ==========================================
const refresh = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return next(new AppError('Refresh token necessário', 401));

  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(refreshToken, REFRESH_SECRET, (err, dec) => {
        if (err) reject(new AppError('Refresh token inválido ou expirado', 401));
        resolve(dec);
      });
    });

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, refreshToken: true }
    });

    if (!user || user.refreshToken !== refreshToken) {
      return next(new AppError('Sessão inválida', 401));
    }

    const { accessToken, refreshToken: novoRefresh } = gerarTokens(user.id);

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
        morada: true,
        sexo: true,
        dataNascimento: true,
        rendaMensalMedia: true,
        criadoEm: true,
        ultimoLogin: true
      }
    });

    if (!usuario) return next(new AppError('Usuário não encontrado', 404));

    res.json({
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
        rendaMensalMedia: true
      }
    });

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      usuario
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return next(new AppError('Este telefone já está em uso', 409));
    }
    next(err);
  }
};

// ==========================================
// LOGOUT
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