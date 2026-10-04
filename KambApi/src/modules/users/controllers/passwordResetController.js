const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { sendOTPEmail } = require('../../../services/emailService');

// F-020: OTP criptograficamente seguro (crypto.randomInt) e na BD fica APENAS
// o hash sha256(salt:otp) — um vazar da BD não revela códigos válidos.
const LIMITE_TENTATIVAS = 5; // bloqueio por conta a partir de 5 tentativas erradas

const gerarOTP = () => crypto.randomInt(100000, 1000000).toString();
const gerarSalt = () => crypto.randomBytes(16).toString('hex');
const hashOTP = (otp, salt) =>
  crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');

const otpCorresponde = (otp, token) => {
  try {
    const esperado = Buffer.from(token.otp, 'hex');
    const calculado = Buffer.from(hashOTP(otp, token.salt || ''), 'hex');
    // linhas antigas (OTP em texto claro) têm comprimento diferente → false
    return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
  } catch {
    return false;
  }
};

const esqueciSenha = async (req, res, next) => {
  const { email } = req.body;

  try {
    const usuario = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, nome: true, email: true, senha: true },
    });

    if (!usuario || !usuario.senha) {
      return res.json({
        success: true,
        message: 'Se este email existir, receberás um código OTP.',
      });
    }

    const otp = gerarOTP();
    const salt = gerarSalt();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.passwordResetToken.updateMany({
      where: { userId: usuario.id, used: false },
      data: { used: true },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: usuario.id,
        otp: hashOTP(otp, salt),
        salt,
        tentativas: 0,
        expiresAt,
      },
    });

    try {
      await sendOTPEmail(usuario.email, otp, usuario.nome);
    } catch (emailErr) {
      console.error('[EMAIL] Falha ao enviar OTP:', emailErr.message);
      return next(new AppError('Erro ao enviar email. Tenta novamente mais tarde.', 500));
    }

    res.json({
      success: true,
      message: 'Se este email existir, receberás um código OTP.',
    });
  } catch (err) {
    next(err);
  }
};

const redefinirSenha = async (req, res, next) => {
  const { email, otp, novaSenha } = req.body;

  try {
    const usuario = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, nome: true, email: true },
    });

    if (!usuario) {
      return next(new AppError('Código OTP inválido ou expirado.', 400));
    }

    // F-020: procura o token ativo por utilizador e compara por hash
    // (a BD nunca armazena nem indexa o OTP em texto claro)
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        userId: usuario.id,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { criadoEm: 'desc' },
    });

    if (!token) {
      return next(new AppError('Código OTP inválido ou expirado.', 400));
    }

    if (!otpCorresponde(otp, token)) {
      // F-020: contador de tentativas POR CONTA — ao 5.º erro o token morre
      // (mensagens idênticas em todos os caminhos de falha: sem oráculo)
      const tentativas = (token.tentativas || 0) + 1;
      await prisma.passwordResetToken.update({
        where: { id: token.id },
        data: tentativas >= LIMITE_TENTATIVAS
          ? { tentativas, used: true, usadoEm: new Date() }
          : { tentativas },
      });
      return next(new AppError('Código OTP inválido ou expirado.', 400));
    }

    const senhaHash = await bcrypt.hash(novaSenha, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: usuario.id },
        data: { senha: senhaHash, senhaAlteradaEm: new Date() },
      }),
      prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { used: true, usadoEm: new Date() },
      }),
      prisma.user.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      }),
    ]);

    res.json({
      success: true,
      message: 'Palavra-passe redefinida com sucesso!',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { esqueciSenha, redefinirSenha };
