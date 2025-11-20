// src/controllers/authController.js
const User = require('../models/User');
const { gerarTokens } = require('../middleware/auth');
const { AppError, AuthenticationError } = require('../middleware/errorHandler');
const { successResponse, authResponse } = require('../utils/responseFormatter');

/**
 * ==========================================
 * REGISTRO DE NOVO USUÁRIO
 * ==========================================
 */
const registrar = async (req, res, next) => {
  try {
    const { nome, email, telefone, senha } = req.body;

    // Verifica se já existe email ou telefone
    const existe = await User.findOne({
      $or: [{ email }, { telefone }]
    });

    if (existe) {
      if (existe.email === email) {
        return next(new AppError('Este email já está registrado', 409));
      }
      if (existe.telefone === telefone) {
        return next(new AppError('Este telefone já está registrado', 409));
      }
    }

    // Cria usuário
    const usuario = await User.create({
      nome,
      email,
      telefone,
      senha
    });

    // Gera tokens
    const { accessToken, refreshToken } = gerarTokens(usuario._id);

    // Resposta limpa (nunca retorna senha)
    const dadosUsuario = usuario.getDadosPublicos();

    return authResponse(res, 201, {
      mensagem: 'Conta criada com sucesso! Bem-vindo ao Kamba 🇦🇴',
      usuario: dadosUsuario,
      accessToken,
      refreshToken
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * LOGIN
 * ==========================================
 */
const login = async (req, res, next) => {
  try {
    const { email, senha } = req.body;

    // Busca usuário
    const usuario = await User.findOne({ email }).select('+senha');
    if (!usuario) {
      return next(new AuthenticationError('Email ou senha incorretos'));
    }

    // Verifica se está bloqueado
    if (usuario.estaBloqueado()) {
      const tempoRestante = Math.ceil((usuario.bloqueadoAte - Date.now()) / 60000);
      return next(new AuthenticationError(`Conta bloqueada. Tente novamente em ${tempoRestante} minutos.`));
    }

    // Verifica senha
    const senhaCorreta = await usuario.compararSenha(senha);
    if (!senhaCorreta) {
      await usuario.incrementarTentativasLogin();
      return next(new AuthenticationError('Email ou senha incorretos'));
    }

    // Login bem-sucedido → reseta tentativas
    usuario.tentativasLogin = 0;
    usuario.ultimoLogin = new Date();
    await usuario.save({ validateBeforeSave: false });

    // Gera tokens
    const { accessToken, refreshToken } = gerarTokens(usuario._id);
    const dadosUsuario = usuario.getDadosPublicos();

    return authResponse(res, 200, {
      mensagem: `Bem-vindo de volta, ${usuario.nome.split(' ')[0]}! 💸`,
      usuario: dadosUsuario,
      accessToken,
      refreshToken
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * REFRESH TOKEN
 * ==========================================
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AuthenticationError('Refresh token não fornecido'));
    }

    // Verifica refresh token
    const decoded = await require('../middleware/auth').verificarToken(refreshToken, process.env.REFRESH_SECRET);
    const usuario = await User.findById(decoded.id);

    if (!usuario) {
      return next(new AuthenticationError('Token inválido'));
    }

    const { accessToken: novoAccessToken, refreshToken: novoRefreshToken } = gerarTokens(usuario._id);

    return successResponse(res, {
      mensagem: 'Token renovado com sucesso',
      accessToken: novoAccessToken,
      refreshToken: novoRefreshToken
    });

  } catch (err) {
    next(new AuthenticationError('Sessão expirada. Faça login novamente.'));
  }
};

/**
 * ==========================================
 * PERFIL DO USUÁRIO
 * ==========================================
 */
const perfil = async (req, res, next) => {
  try {
    const usuario = await User.findById(req.usuarioId);
    if (!usuario) {
      return next(new AppError('Usuário não encontrado', 404));
    }

    return successResponse(res, {
      mensagem: 'Perfil carregado',
      usuario: usuario.getDadosPublicos()
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * ATUALIZAR PERFIL
 * ==========================================
 */
const atualizarPerfil = async (req, res, next) => {
  try {
    const camposPermitidos = ['nome', 'telefone', 'preferencias'];
    const atualizacoes = {};

    Object.keys(req.body).forEach(campo => {
      if (camposPermitidos.includes(campo)) {
        atualizacoes[campo] = req.body[campo];
      }
    });

    if (Object.keys(atualizacoes).length === 0) {
      return next(new AppError('Nenhum dado válido para atualizar', 400));
    }

    const usuario = await User.findByIdAndUpdate(
      req.usuarioId,
      atualizacoes,
      { new: true, runValidators: true }
    );

    return successResponse(res, {
      mensagem: 'Perfil atualizado com sucesso!',
      usuario: usuario.getDadosPublicos()
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