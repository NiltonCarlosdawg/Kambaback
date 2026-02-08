/**
 * ==========================================
 * VALIDADOR DE VARIÁVEIS DE AMBIENTE
 * Garante que a aplicação NÃO inicia sem configuração crítica
 * ==========================================
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REFRESH_SECRET',
  'NODE_ENV'
];

const optionalEnvVars = {
  'KAMBA_AI_API_KEY': 'IA conversacional não funcionará',
  'KAMBA_AI_BASE_URL': 'Usando URL padrão da API de IA',
  'GNEWS_API_KEY': 'Notícias usarão fallback offline',
  'PORT': 'Usando porta padrão 3000',
  'REDIS_URL': 'Cache em memória (não recomendado para produção)'
};

/**
 * Valida se todas as variáveis obrigatórias existem
 */
const validateRequiredEnv = () => {
  const missing = [];
  
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ ERRO CRÍTICO: Variáveis de ambiente obrigatórias não configuradas!\n');
    console.error('╔═══════════════════════════════════════════════════════════╗');
    console.error('║          🚨 CONFIGURAÇÃO INCOMPLETA 🚨                    ║');
    console.error('╠═══════════════════════════════════════════════════════════╣');
    
    missing.forEach(varName => {
      console.error(`║  ❌ ${varName.padEnd(50)} ║`);
    });
    
    console.error('╠═══════════════════════════════════════════════════════════╣');
    console.error('║  Cria um arquivo .env com essas variáveis antes de       ║');
    console.error('║  iniciar a aplicação!                                     ║');
    console.error('╚═══════════════════════════════════════════════════════════╝\n');
    
    process.exit(1);
  }
};

/**
 * ✅ CORRIGIDO: Validação de entropia (força do secret) ao invés de substring
 */
const hasGoodEntropy = (secret) => {
  if (!secret || secret.length < 32) return false;
  
  // Verifica variedade de caracteres
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasNumber = /[0-9]/.test(secret);
  const hasSpecial = /[^a-zA-Z0-9]/.test(secret);
  
  const varietyScore = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  return varietyScore >= 3; // Pelo menos 3 tipos de caracteres
};

/**
 * ✅ CORRIGIDO: Validação de secrets JWT
 */
const validateJWTSecrets = () => {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.REFRESH_SECRET;
  const warnings = [];
  const errors = [];

  // Verifica existência (já validado em validateRequiredEnv, mas double-check)
  if (!jwtSecret || !refreshSecret) {
    errors.push('JWT_SECRET e REFRESH_SECRET são obrigatórios');
    return { errors, warnings };
  }

  // Verifica tamanho mínimo
  if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET deve ter pelo menos 32 caracteres');
  }
  if (refreshSecret.length < 32) {
    errors.push('REFRESH_SECRET deve ter pelo menos 32 caracteres');
  }

  // Verifica se são diferentes
  if (jwtSecret === refreshSecret) {
    errors.push('JWT_SECRET e REFRESH_SECRET devem ser diferentes!');
  }

  // ✅ CORRIGIDO: Validação por igualdade exata (não substring)
  // Apenas avisa se for EXATAMENTE um desses valores
  const defaultSecrets = [
    'secret',
    'mysecret',
    'kamba',  // Apenas a palavra exata
    'kwanza',
    'angola',
    'kamba_pro_jwt_secret_2025_angola',
    'kamba_pro_refresh_secret_2025_angola',
    'kwanza_angola_2025_super_secreto'
  ];

  if (defaultSecrets.includes(jwtSecret.toLowerCase())) {
    warnings.push('⚠️  JWT_SECRET é um valor padrão conhecido - ALTERE IMEDIATAMENTE!');
  }

  if (defaultSecrets.includes(refreshSecret.toLowerCase())) {
    warnings.push('⚠️  REFRESH_SECRET é um valor padrão conhecido - ALTERE IMEDIATAMENTE!');
  }

  // ✅ NOVO: Validação de entropia (força real do secret)
  if (!hasGoodEntropy(jwtSecret)) {
    warnings.push('⚠️  JWT_SECRET tem baixa entropia - use letras maiúsculas, minúsculas, números e símbolos');
  }

  if (!hasGoodEntropy(refreshSecret)) {
    warnings.push('⚠️  REFRESH_SECRET tem baixa entropia - misture diferentes tipos de caracteres');
  }

  return { errors, warnings };
};

/**
 * Verifica variáveis opcionais e avisa
 */
const checkOptionalEnv = () => {
  const missing = [];

  for (const [varName, message] of Object.entries(optionalEnvVars)) {
    if (!process.env[varName]) {
      missing.push({ varName, message });
    }
  }

  if (missing.length > 0) {
    console.warn('\n⚠️  Variáveis opcionais não configuradas:\n');
    missing.forEach(({ varName, message }) => {
      console.warn(`   - ${varName}: ${message}`);
    });
    console.warn('');
  }
};

/**
 * Valida configuração de ambiente específica
 */
const validateNodeEnv = () => {
  const validEnvs = ['development', 'production', 'test'];
  const nodeEnv = process.env.NODE_ENV;

  if (!validEnvs.includes(nodeEnv)) {
    console.warn(`\n⚠️  NODE_ENV="${nodeEnv}" inválido. Valores aceitos: ${validEnvs.join(', ')}\n`);
    console.warn('   Usando "development" como padrão.\n');
    process.env.NODE_ENV = 'development';
  }
};

/**
 * ✅ CORRIGIDO: Validação completa - REMOVIDO código solto que crashava
 */
const validateEnvironment = () => {
  console.log('\n🔍 Validando configuração do ambiente...\n');

  validateNodeEnv();
  validateRequiredEnv();
  
  const { errors, warnings } = validateJWTSecrets();
  
  // Trata erros críticos
  if (errors.length > 0) {
    console.error('\n❌ ERROS CRÍTICOS DE SEGURANÇA:\n');
    errors.forEach(e => console.error(`   ✖ ${e}`));
    console.error('\nAplicação não pode iniciar com secrets inválidos.\n');
    process.exit(1);
  }
  
  // Mostra avisos
  if (warnings.length > 0) {
    console.warn('\n⚠️  AVISOS DE SEGURANÇA:\n');
    warnings.forEach(w => console.warn(`   ${w}`));
    console.warn('\n   Gere secrets fortes usando:');
    console.warn('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n');
    
    // Em produção, avisos se tornam erros
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ BLOQUEADO: Ajuste os warnings acima antes de deploy em produção!\n');
      process.exit(1);
    }
  }
  
  checkOptionalEnv();

  console.log('✅ Validação de ambiente concluída!\n');
};

/**
 * Gera secrets seguros (helper)
 */
const generateSecureSecret = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Exibe exemplo de .env
 */
const showEnvExample = () => {
  console.log('\n📄 Exemplo de arquivo .env:\n');
  console.log('# ===== BANCO DE DADOS =====');
  console.log('DATABASE_URL="postgresql://user:password@localhost:5432/kambapro"');
  console.log('');
  console.log('# ===== SEGURANÇA (GERE VALORES ÚNICOS!) =====');
  console.log(`JWT_SECRET="${generateSecureSecret()}"`);
  console.log(`REFRESH_SECRET="${generateSecureSecret()}"`);
  console.log('');
  console.log('# ===== AMBIENTE =====');
  console.log('NODE_ENV="development"');
  console.log('PORT=3000');
  console.log('');
  console.log('# ===== IA CONVERSACIONAL (OPCIONAL) =====');
  console.log('KAMBA_AI_API_KEY="sua_api_key_aqui"');
  console.log('KAMBA_AI_BASE_URL="https://api.groq.com/openai/v1"');
  console.log('KAMBA_AI_MODEL="llama-3.3-70b-versatile"');
  console.log('');
  console.log('# ===== NOTÍCIAS (OPCIONAL) =====');
  console.log('GNEWS_API_KEY="sua_gnews_key_aqui"');
  console.log('');
};

module.exports = {
  validateEnvironment,
  validateRequiredEnv,
  validateJWTSecrets,
  generateSecureSecret,
  showEnvExample
};