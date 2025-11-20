// src/controllers/authController.js
const User = require('../models/User');
const { gerarTokens } = require('../middleware/auth');
const { AppError, AuthenticationError } = require('../middleware/errorHandler');
const { successResponse, authResponse } = require('../utils/responseFormatter');

/**
 * REGISTRO
 */
const registrar = async (req, res, next) => {
  try {
    const { nome, email, telefone, senha } = req.body;

    const existe = await User.findOne({ $or: [{ email }, { telefone }] });
    if (existe) {
      return next(new AppError(existe.email === email 
        ? 'Este email já está registrado' 
        : 'Este telefone já está registrado', 409));
    }

    const usuario = await User.create({ nome, email, telefone, senha });
    const { accessToken, refreshToken } = gerarTokens(usuario._id);

    return authResponse(res, 201, {
      mensagem: 'Conta criada com sucesso! Bem-vindo ao Kwanza',
      usuario: usuario.getDadosPublicos(),
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
  try {
    const { email, senha } = req.body;
    const usuario = await User.findOne({ email }).select('+senha');

    if (!usuario || !await usuario.compararSenha(senha)) {
      if (usuario) await usuario.incrementarTentativasLogin();
      return next(new AuthenticationError('Email ou senha incorretos'));
    }

    if (usuario.estaBloqueado()) {
      const minutos = Math.ceil((usuario.bloqueadoAte - Date.now()) / 60000);
      return next(new AuthenticationError(`Conta bloqueada. Tenta em ${minutos} minutos`));
    }

    usuario.tentativasLogin = 0;
    usuario.ultimoLogin = new Date();
    await usuario.save({ validateBeforeSave: false });

    const { accessToken, refreshToken } = gerarTokens(usuario._id);

    return authResponse(res, 200, {
      mensagem: `Bem-vindo de volta, ${usuario.nome.split(' ')[0]}!`,
      usuario: usuario.getDadosPublicos(),
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
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AuthenticationError('Token não fornecido');

    const decoded = await require('../middleware/auth').verificarToken(refreshToken, process.env.REFRESH_SECRET);
    const usuario = await User.findById(decoded.id);
    if (!usuario) throw new AuthenticationError('Token inválido');

    const { accessToken, refreshToken: novoRefresh } = gerarTokens(usuario._id);

    return successResponse(res, {
      accessToken,
      refreshToken: novoRefresh
    });

  } catch (err) {
    next(new AuthenticationError('Sessão expirada. Faça login novamente.'));
  }
};

/**
 * PERFIL & ATUALIZAR
 */
const perfil = async (req, res, next) => {
  try {
    const usuario = await User.findById(req.usuarioId);
    return successResponse(res, { usuario: usuario.getDadosPublicos() });
  } catch (err) {
    next(err);
  }
};

const atualizarPerfil = async (req, res, next) => {
  try {
    const campos = ['nome', 'telefone', 'preferencias'];
    const updates = {};
    campos.forEach(c => { if (req.body[c] !== undefined) updates[c] = req.body[c]; });

    if (Object.keys(updates).length === 0) {
      return next(new AppError('Nada para atualizar', 400));
    }

    const usuario = await User.findByIdAndUpdate(req.usuarioId, updates, { new: true });
    return successResponse(res, { usuario: usuario.getDadosPublicos() });
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