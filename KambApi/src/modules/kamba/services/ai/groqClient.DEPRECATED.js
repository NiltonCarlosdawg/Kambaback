// services/ai/groqClient.js
// Cliente para API Groq com retry, timeout e tratamento de erros

const GROQ_API_KEY = process.env.KAMBA_AI_API_KEY;
const GROQ_BASE_URL = process.env.KAMBA_AI_BASE_URL;
const GROQ_MODEL = process.env.KAMBA_AI_MODEL || 'gpt-oss-120b';
const MAX_TENTATIVAS = 4;
const TIMEOUT_MS = 25000;

/**
 * Chama a API Groq com retry automático e timeout
 * @param {Array} messages - Array de mensagens no formato OpenAI
 * @param {boolean} comTools - Se deve incluir ferramentas disponíveis
 * @param {number} tentativa - Número da tentativa actual (uso interno)
 * @returns {Promise<Object>} Resposta da API
 */
const chamarGroq = async (messages, comTools = true, tentativa = 1) => {
  const body = {
    model: GROQ_MODEL,
    messages,
    max_tokens: 2048,
    temperature: comTools ? 0.5 : 0.4,
  };

  if (comTools) {
    throw new Error('Tools devem ser passadas explicitamente no body');
  }

  try {
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (response.status === 429 && tentativa < MAX_TENTATIVAS) {
      const espera = Math.min(1000 * Math.pow(2, tentativa), 8000);
      console.log(`[GROQ] Rate limit, tentativa ${tentativa + 1}/${MAX_TENTATIVAS} em ${espera}ms`);
      await new Promise(r => setTimeout(r, espera));
      return chamarGroq(messages, comTools, tentativa + 1);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Groq HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    return await response.json();
  } catch (err) {
    if (tentativa < MAX_TENTATIVAS && err.name !== 'AbortError') {
      const espera = 500 * Math.pow(2, tentativa);
      await new Promise(r => setTimeout(r, espera));
      return chamarGroq(messages, comTools, tentativa + 1);
    }
    throw err;
  }
};

/**
 * Chama a API Groq com tools (funções)
 * @param {Array} messages - Array de mensagens
 * @param {Array} tools - Array de tool definitions no formato OpenAI
 * @param {number} tentativa - Número da tentativa actual
 * @returns {Promise<Object>} Resposta da API
 */
const chamarGroqComTools = async (messages, tools, tentativa = 1) => {
  const body = {
    model: GROQ_MODEL,
    messages,
    tools,
    tool_choice: "auto",
    max_tokens: 2048,
    temperature: 0.5,
  };

  try {
    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (response.status === 429 && tentativa < MAX_TENTATIVAS) {
      const espera = Math.min(1000 * Math.pow(2, tentativa), 8000);
      console.log(`[GROQ] Rate limit (tools), tentativa ${tentativa + 1}/${MAX_TENTATIVAS} em ${espera}ms`);
      await new Promise(r => setTimeout(r, espera));
      return chamarGroqComTools(messages, tools, tentativa + 1);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Groq HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    return await response.json();
  } catch (err) {
    if (tentativa < MAX_TENTATIVAS && err.name !== 'AbortError') {
      const espera = 500 * Math.pow(2, tentativa);
      await new Promise(r => setTimeout(r, espera));
      return chamarGroqComTools(messages, tools, tentativa + 1);
    }
    throw err;
  }
};

/**
 * Verifica se a API Groq está configurada
 * @returns {boolean}
 */
const isConfigured = () => {
  return !!GROQ_API_KEY && !!GROQ_BASE_URL;
};

module.exports = {
  chamarGroq,
  chamarGroqComTools,
  isConfigured,
  GROQ_MODEL
};
