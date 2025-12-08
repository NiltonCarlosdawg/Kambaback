// src/controllers/userController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

const perfil = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, nome: true, email: true, telefone: true, criadoEm: true }
    });

    if (!user) return next(new AppError('Usuário não encontrado', 404));

    res.json({ success: true, usuario: user });
  } catch (err) {
    next(err);
  }
};

module.exports = { perfil };