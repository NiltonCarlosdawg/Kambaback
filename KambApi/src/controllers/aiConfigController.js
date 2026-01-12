const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');
const { encrypt, decrypt, maskSensitiveData } = require('../utils/encryption');

/**
 * ==========================================
 * SALVAR API KEY (AGORA CRIPTOGRAFADA!)
 * ==========================================
 */
const salvarApiKey = async (req, res, next) => {
  const { apiKey, provider = "openai" } = req.body;

  if (!apiKey || apiKey.trim().length < 10) {
    return next(new AppError('API Key inválida', 400));
  }

  try {
    // CRIPTOGRAFA a API key antes de salvar
    const apiKeyEncrypted = encrypt(apiKey.trim());

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        aiApiKey: apiKeyEncrypted,  // Salva criptografado
        aiProvider: provider.toLowerCase()
      }
    });

    // Log seguro (sem expor a key)
    console.log(`[SEGURANÇA] API Key do ${provider} salva para usuário ${req.user.id} (mascarada: ${maskSensitiveData(apiKey)})`);

    res.json({
      success: true,
      message: `API Key do ${provider.toUpperCase()} salva com sucesso! O Kamba agora tá turbo!`,
      provider: provider.toLowerCase(),
      keyPreview: maskSensitiveData(apiKey, 6) // Mostra apenas os últimos 6 caracteres
    });

  } catch (err) {
    console.error('[ERRO] Falha ao salvar API Key:', err.message);
    next(new AppError('Erro ao salvar configuração de IA', 500));
  }
};

/**
 * ==========================================
 * OBTER CONFIGURAÇÃO (SEM EXPOR A KEY)
 * ==========================================
 */
const obterConfig = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { aiProvider: true, aiApiKey: true }
    });

    const configurado = !!(user?.aiApiKey);

    // Se tem key, descriptografa apenas para mascarar (não envia a key real!)
    let keyPreview = null;
    if (configurado) {
      try {
        const decryptedKey = decrypt(user.aiApiKey);
        keyPreview = maskSensitiveData(decryptedKey, 6);
      } catch (err) {
        console.error('[ERRO] Falha ao descriptografar API Key:', err.message);
        // Key pode estar corrompida - força reconfiguração
        return res.json({
          success: true,
          configurado: false,
          provider: null,
          error: 'API Key corrompida - configure novamente'
        });
      }
    }

    res.json({
      success: true,
      configurado,
      provider: user?.aiProvider || null,
      keyPreview // Apenas últimos 6 caracteres mascarados
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * OBTER API KEY DESCRIPTOGRAFADA (USO INTERNO)
 * Nunca expõe via API - apenas para uso no backend
 * ==========================================
 */
const obterApiKeyDescriptografada = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { aiApiKey: true }
    });

    if (!user?.aiApiKey) {
      return null;
    }

    // Descriptografa e retorna
    return decrypt(user.aiApiKey);

  } catch (err) {
    console.error('[ERRO] Falha ao obter API Key:', err.message);
    return null;
  }
};

/**
 * ==========================================
 * REMOVER API KEY
 * ==========================================
 */
const removerApiKey = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        aiApiKey: null,
        aiProvider: null
      }
    });

    console.log(`[SEGURANÇA] API Key removida para usuário ${req.user.id}`);

    res.json({
      success: true,
      message: 'Configuração de IA removida com sucesso'
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * VALIDAR API KEY (testa se funciona)
 * ==========================================
 */
const validarApiKey = async (req, res, next) => {
  try {
    const apiKey = await obterApiKeyDescriptografada(req.user.id);

    if (!apiKey) {
      return next(new AppError('API Key não configurada', 404));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { aiProvider: true }
    });

    // Testa a key fazendo uma chamada simples
    const baseUrl = user.aiProvider === 'openai' 
      ? 'https://api.openai.com/v1'
      : process.env.KAMBA_AI_BASE_URL;

    const testResponse = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      return res.json({
        success: false,
        message: 'API Key inválida ou sem permissões',
        statusCode: testResponse.status
      });
    }

    res.json({
      success: true,
      message: 'API Key válida e funcionando!',
      provider: user.aiProvider
    });

  } catch (err) {
    console.error('[ERRO] Falha ao validar API Key:', err.message);
    next(new AppError('Erro ao validar API Key', 500));
  }
};

module.exports = {
  salvarApiKey,
  obterConfig,
  removerApiKey,
  validarApiKey,
  obterApiKeyDescriptografada // Exporta para uso interno (kambaController)
};