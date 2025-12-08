// src/controllers/aiConfigController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

// Salvar ou atualizar a API Key da IA
const salvarApiKey = async (req, res, next) => {
  const { apiKey, provider = "openai" } = req.body;

  if (!apiKey || apiKey.trim().length < 10) {
    return next(new AppError('API Key inválida', 400));
  }

  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        aiApiKey: apiKey.trim(),
        aiProvider: provider.toLowerCase()
      }
    });

    res.json({
      success: true,
      message: `API Key do ${provider.toUpperCase()} salva com sucesso! O Kamba agora tá turbo!`
    });
  } catch (err) {
    next(err);
  }
};

// Buscar configuração atual (opcional)
const obterConfig = async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { aiProvider: true }
  });

  res.json({
    success: true,
    configurado: !!user?.aiProvider,
    provider: user?.aiProvider || null
  });
};

module.exports = { salvarApiKey, obterConfig };