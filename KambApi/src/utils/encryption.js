// src/utils/encryption.js
const crypto = require('crypto');

/**
 * ==========================================
 * UTILITÁRIO DE CRIPTOGRAFIA AES-256-GCM
 * Para proteger API keys e dados sensíveis no banco
 * ==========================================
 */

function getKey() {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY não configurada no .env! Use: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }

  // Converte hex string para buffer (32 bytes para AES-256)
  const KEY = Buffer.from(ENCRYPTION_KEY, 'hex');

  if (KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY deve ter exatamente 32 bytes (64 caracteres hex)');
  }

  return KEY;
}

/**
 * Criptografa texto usando AES-256-GCM
 * @param {string} text - Texto a ser criptografado
 * @returns {string} - Texto criptografado no formato: iv:authTag:encrypted
 */
const encrypt = (text) => {
  if (!text) return null;

  try {
    // Gera IV aleatório (12 bytes recomendado para GCM)
    const iv = crypto.randomBytes(12);

    // Cria cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);

    // Criptografa
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Obtém authentication tag
    const authTag = cipher.getAuthTag().toString('hex');

    // Retorna: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;

  } catch (error) {
    console.error('Erro ao criptografar:', error.message);
    throw new Error('Falha na criptografia');
  }
};

/**
 * Descriptografa texto usando AES-256-GCM
 * @param {string} encryptedData - Dados no formato iv:authTag:encrypted
 * @returns {string} - Texto original
 */
const decrypt = (encryptedData) => {
  if (!encryptedData) return null;

  try {
    // Separa componentes
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Formato inválido de dados criptografados');
    }

    // Converte de hex para buffer
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Cria decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);

    // Descriptografa
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

  } catch (error) {
    console.error('Erro ao descriptografar:', error.message);
    throw new Error('Falha na descriptografia - dados podem estar corrompidos');
  }
};

/**
 * Hash one-way para senhas (bcrypt é melhor, mas isso serve para comparações)
 * @param {string} text - Texto a ser hasheado
 * @returns {string} - Hash SHA-256
 */
const hash = (text) => {
  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
};

/**
 * Gera token aleatório seguro
 * @param {number} bytes - Número de bytes (padrão 32)
 * @returns {string} - Token em hexadecimal
 */
const generateToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Compara hash de forma segura (timing-safe)
 * @param {string} a - Primeiro hash
 * @param {string} b - Segundo hash
 * @returns {boolean}
 */
const compareHash = (a, b) => {
  if (!a || !b) return false;
  
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  
  if (bufferA.length !== bufferB.length) return false;
  
  return crypto.timingSafeEqual(bufferA, bufferB);
};

/**
 * Mascara dados sensíveis para logs (mostra apenas 4 últimos caracteres)
 * @param {string} text - Texto a mascarar
 * @param {number} visible - Caracteres visíveis (padrão 4)
 * @returns {string}
 */
const maskSensitiveData = (text, visible = 4) => {
  if (!text || text.length <= visible) return '***';
  return '*'.repeat(text.length - visible) + text.slice(-visible);
};

/**
 * Valida se dados estão criptografados (formato correto)
 * @param {string} data - Dados a validar
 * @returns {boolean}
 */
const isEncrypted = (data) => {
  if (!data || typeof data !== 'string') return false;
  const parts = data.split(':');
  return parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p));
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateToken,
  compareHash,
  maskSensitiveData,
  isEncrypted
};