const bcrypt = require('bcryptjs');
const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { sendOTPEmail } = require('../../../services/emailService');

const gerarOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.passwordResetToken.updateMany({
      where: { userId: usuario.id, used: false },
      data: { used: true },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: usuario.id,
        otp,
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

    const token = await prisma.passwordResetToken.findFirst({
      where: {
        userId: usuario.id,
        otp,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { criadoEm: 'desc' },
    });

    if (!token) {
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
