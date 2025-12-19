// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { gerarTokens } = require('../middleware/auth');
const AppError = require('../middleware/AppError');

/**
 * REGISTRO DE NOVA CONTA (AJUSTADO PARA NOVO SCHEMA)
 */
const registrar = async (req, res, next) => {
  // Desestruturação dos novos campos obrigatórios
  const { 
    nome, 
    email, 
    telefone, 
    senha, 
    dataNascimento, 
    sexo, 
    morada,
    rendaMensalMedia 
  } = req.body;

  // 1. Validação de campos obrigatórios conforme o novo schema
  if (!nome || !email || !senha || !dataNascimento || !sexo || !morada) {
    return next(new AppError('Kamba, preenche todos os campos obrigatórios (nome, email, senha, nascimento, sexo e morada).', 400));
  }

  try {
    // 2. Verifica duplicidade (Email ou Telefone)
    const existe = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { telefone: telefone || undefined } // evita erro se telefone for null
        ]
      }
    });

    if (existe) {
      const msg = existe.email === email.toLowerCase()
        ? 'Este email já está registrado'
        : 'Este telefone já está registrado';
      return next(new AppError(msg, 409));
    }

    // 3. Criptografa senha
    const senhaHash = await bcrypt.hash(senha, 12);

    // 4. Cria usuário com os novos campos
    const user = await prisma.user.create({
      data: {
        nome: nome.trim(),
        email: email.toLowerCase(),
        telefone,
        senha: senhaHash,
        dataNascimento: new Date(dataNascimento), // Conversão para objeto Date
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
 * LOGIN (COM VERIFICAÇÃO DE BLOQUEIO E ÚLTIMO LOGIN)
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
        bloqueado: true // Campo adicionado na migração
      }
    });

    if (!user) {
      return next(new AppError('Email ou senha incorretos', 401));
    }
    
    if (!user.ativo) {
      return next(new AppError('Conta desativada. Contacta o suporte.', 403));
    }
    
    if (user.bloqueado) {
      return next(new AppError('Conta bloqueada temporariamente.', 403));
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return next(new AppError('Email ou senha incorretos', 401));
    }

    // Atualiza campo 'ultimoLogin' criado na migração
    await prisma.user.update({
      where: { id: user.id },
      data: { ultimoLogin: new Date() }
    });

    const { accessToken, refreshToken } = gerarTokens(user.id);

    const userPublic = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role
    };

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
 * PERFIL (INCLUINDO NOVOS CAMPOS NO RETORNO)
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
        dataNascimento: true, // Novo
        sexo: true,           // Novo
        morada: true,         // Novo
        rendaMensalMedia: true,
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
 * ATUALIZAR PERFIL (CAMPOS ADICIONAIS PERMITIDOS)
 */
const atualizarPerfil = async (req, res, next) => {
  const camposPermitidos = ['nome', 'telefone', 'morada', 'sexo', 'rendaMensalMedia'];
  const dados = {};

  camposPermitidos.forEach(campo => {
    if (req.body[campo] !== undefined) {
      // Garantir que renda seja um float para o Prisma
      if (campo === 'rendaMensalMedia') {
        dados[campo] = parseFloat(req.body[campo]);
      } else {
        dados[campo] = req.body[campo];
      }
    }
  });

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
        morada: true,
        sexo: true,
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

// Funções de Refresh permanecem iguais...
const refresh = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(new AppError('Refresh token não fornecido', 401));

  try {
    const { verificarToken } = require('../middleware/auth');
    const decoded = await verificarToken(refreshToken, process.env.REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) return next(new AppError('Token inválido', 401));

    const tokens = gerarTokens(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });

    res.json({ success: true, ...tokens });
  } catch (err) {
    next(new AppError('Sessão expirada. Faça login novamente.', 401));
  }
};

module.exports = { registrar, login, refresh, perfil, atualizarPerfil };