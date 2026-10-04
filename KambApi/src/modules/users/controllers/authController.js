// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { definirCookieRefresh, limparCookieRefresh } = require('../../../utils/refreshCookie');

// ==========================================
// SECRETS
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET ou REFRESH_SECRET não configurados!');
}

// ==========================================
// HELPERS – Validação de Enums
// ==========================================

// Mapeamento flexível: aceita "Masculino" ou "MASCULINO"
const mapSexo = (sexo) => {
  if (!sexo) return 'PREFIRO_NAO_DIZER';
  
  const map = {
    'masculino': 'MASCULINO',
    'feminino': 'FEMININO',
    'outro': 'OUTRO',
    'prefiro_nao_dizer': 'PREFIRO_NAO_DIZER',
    'prefiro não dizer': 'PREFIRO_NAO_DIZER',
    // Já em maiúsculo (caso frontend envie correto)
    'MASCULINO': 'MASCULINO',
    'FEMININO': 'FEMININO',
    'OUTRO': 'OUTRO',
    'PREFIRO_NAO_DIZER': 'PREFIRO_NAO_DIZER'
  };
  
  return map[sexo.toString().toLowerCase().replace(/\s+/g, '_')] || 'PREFIRO_NAO_DIZER';
};

const validarSexo = (sexo) => {
  const valoresValidos = ['MASCULINO', 'FEMININO', 'OUTRO', 'PREFIRO_NAO_DIZER'];
  const valorMapeado = mapSexo(sexo);
  
  if (!valoresValidos.includes(valorMapeado)) {
    throw new AppError('Sexo inválido. Use: masculino, feminino, outro ou prefiro_nao_dizer', 400);
  }
  return valorMapeado;
};

// ==========================================
// GERAR TOKENS
// ==========================================
// F-033: refresh tokens guardados como sha256 (hex) na BD — comparação
// timing-safe via compareHash. `hash`/`compareHash` vêm do encryption.js.
const { hash: hashRefreshToken, compareHash: compararRefresh } = require('../../../utils/encryption');
const gerarTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

// ==========================================
// REGISTRO
// ==========================================
const registrar = async (req, res, next) => {
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

  try {
    // Validação doEnum Sexo
    let sexoValidado;
    try {
      sexoValidado = validarSexo(sexo);
    } catch (err) {
      return next(err);
    }

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
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        telefone: telefone?.trim() || null,
        senha: senhaHash,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : undefined,
        sexo: sexoValidado, // ⚡ Enum válido: MASCULINO, FEMININO, etc.
        morada: morada?.trim() || null,
        rendaMensalMedia: rendaMensalMedia ? parseFloat(rendaMensalMedia) : 0,
        // role e perfilDeRisco usam defaults do schema (USER, MOD_ERADO)
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

    // Salva refresh token no banco (F-033: guarda sha256 hex, não o JWT)
    await prisma.user.update({
      where: { id: usuario.id },
      data: { refreshToken: hashRefreshToken(refreshToken) }
    });

    // F-019: refresh token também em cookie httpOnly (o frontend já não o guarda)
    definirCookieRefresh(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso!',
      user: {
        ...usuario,
        rendaMensalMedia: Number(usuario.rendaMensalMedia) // Decimal → Number
      },
      usuario: {
        ...usuario,
        rendaMensalMedia: Number(usuario.rendaMensalMedia) // Decimal → Number
      },
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

    // F-018: verifica estado da conta e evita oráculo de enumeração —
    // para contas OAuth (senha null) o bcrypt.compare lançava exceção -> 500
    // (confirmando que a conta existe) e contas bloqueadas/inactivas
    // conseguiam login. Todos os caminhos devolvem o MESMO 401.
    if (
      !usuario ||
      !usuario.senha ||
      !usuario.ativo ||
      usuario.bloqueado ||
      !(await bcrypt.compare(senha, usuario.senha))
    ) {
      return next(new AppError('Credenciais inválidas', 401));
    }

    const { accessToken, refreshToken } = gerarTokens(usuario.id);

    await prisma.user.update({
      where: { id: usuario.id },
      data: { refreshToken: hashRefreshToken(refreshToken), ultimoLogin: new Date() }
    });

    // F-019: refresh token também em cookie httpOnly (o frontend já não o guarda)
    definirCookieRefresh(res, refreshToken);

    res.json({
      success: true,
      message: 'Login realizado',
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        rendaMensalMedia: Number(usuario.rendaMensalMedia), // ⚡ Converte Decimal
        sexo: usuario.sexo,
        role: usuario.role,
        perfilDeRisco: usuario.perfilDeRisco
      },
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        rendaMensalMedia: Number(usuario.rendaMensalMedia), // ⚡ Converte Decimal
        sexo: usuario.sexo,
        role: usuario.role,
        perfilDeRisco: usuario.perfilDeRisco
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
  // F-019: lê do cookie httpOnly; o corpo continua aceite como fallback de
  // transição para clientes antigos que ainda mandam o token no body
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

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

    if (!user || !compararRefresh(user.refreshToken, hashRefreshToken(refreshToken))) {
      return next(new AppError('Sessão inválida', 401));
    }

    const { accessToken, refreshToken: novoRefresh } = gerarTokens(user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashRefreshToken(novoRefresh) }
    });

    // F-019: renova o cookie httpOnly com o refresh token rotacionado
    definirCookieRefresh(res, novoRefresh);

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
        perfilDeRisco: true,
        role: true,
        ativo: true,
        verificado: true,
        criadoEm: true,
        ultimoLogin: true
      }
    });

    if (!usuario) return next(new AppError('Usuário não encontrado', 404));

    res.json({
      success: true,
      message: 'Perfil carregado',
      user: {
        ...usuario,
        rendaMensalMedia: Number(usuario.rendaMensalMedia) // ⚡ Converte Decimal
      },
      usuario: {
        ...usuario,
        rendaMensalMedia: Number(usuario.rendaMensalMedia) // ⚡ Converte Decimal
      }
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// ATUALIZAR PERFIL
// ==========================================
const atualizarPerfil = async (req, res, next) => {
  const camposPermitidos = ['nome', 'telefone', 'morada', 'sexo', 'rendaMensalMedia', 'perfilDeRisco'];
  const dados = {};

  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      if (campo === 'rendaMensalMedia') {
        dados[campo] = parseFloat(req.body[campo]);
      } else if (campo === 'sexo') {
        try {
          dados[campo] = validarSexo(req.body[campo]);
        } catch (err) {
          return next(err);
        }
      } else if (campo === 'perfilDeRisco') {
        // Validar enum PerfilRisco
        const perfisValidos = ['CONSERVADOR', 'MOD_ERADO', 'ARROJADO'];
        const perfil = req.body[campo]?.toUpperCase();
        if (!perfisValidos.includes(perfil)) {
          return next(new AppError('Perfil de risco inválido. Use: conservador, moderado ou arrojado', 400));
        }
        dados[campo] = perfil;
      } else {
        dados[campo] = req.body[campo]?.trim?.() || req.body[campo];
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
        rendaMensalMedia: true,
        perfilDeRisco: true
      }
    });

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      user: {
        ...usuario,
        rendaMensalMedia: Number(usuario.rendaMensalMedia)
      },
      usuario: {
        ...usuario,
        rendaMensalMedia: Number(usuario.rendaMensalMedia)
      }
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

    limparCookieRefresh(res);

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });

  } catch (err) {
    next(err);
  }
};

// ==========================================
// ALTERAR SENHA
// ==========================================
const alterarSenha = async (req, res, next) => {
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual || !novaSenha) {
    return next(new AppError('Senha atual e nova senha são obrigatórias', 400));
  }

  if (novaSenha.length < 8) {
    return next(new AppError('Nova senha deve ter pelo menos 8 caracteres', 400));
  }

  try {
    const usuario = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, senha: true }
    });

    if (!usuario) {
      return next(new AppError('Usuário não encontrado', 404));
    }

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaValida) {
      return next(new AppError('Senha atual incorreta', 401));
    }

    const novoHash = await bcrypt.hash(novaSenha, 12);
    // F-006: senhaAlteradaEm invalida access tokens antigos (verificado em
    // middleware/auth.js:91) e refreshToken null revoga a sessão no servidor —
    // senão um token roubado continuaria válido mesmo após a mudança de senha
    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        senha: novoHash,
        senhaAlteradaEm: new Date(),
        refreshToken: null
      }
    });

    limparCookieRefresh(res);
    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
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
  logout,
  alterarSenha
};
