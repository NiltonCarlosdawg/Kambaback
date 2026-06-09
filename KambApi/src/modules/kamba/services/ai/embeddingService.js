const DIMENSIONS_LEXICAL = 384;

const API_KEY = process.env.KAMBA_AI_API_KEY;
const BASE_URL = process.env.KAMBA_AI_BASE_URL || 'https://api.groq.com/openai/v1';
const EMBEDDING_MODEL = process.env.KAMBA_EMBEDDING_MODEL;
const MODO_SEMANTICO = !!API_KEY && !!EMBEDDING_MODEL;

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const tokenizar = (texto) => {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
};

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "para", "com",
  "um", "uma", "uns", "umas", "o", "a", "os", "as", "é", "e",
  "que", "se", "por", "ao", "aos", "à", "às", "tem", "têm", "ser",
  "mais", "mas", "foi", "são", "está", "estão", "como", "já", "muito",
  "pode", "vai", "ter", "meu", "minha", "teu", "tua", "seu", "sua",
  "isso", "isto", "aquele", "aquela", "quem", "quando", "onde", "porque",
  "só", "sim", "não", "pra", "pro", "tudo", "saber", "fazer", "dizer",
  "querer", "entre", "depois", "antes", "sempre", "nunca", "aqui", "ali",
  "lá", "cá", "também", "ainda", "bem", "mal", "até",
]);

const gerarEmbeddingLexical = (texto) => {
  if (!texto || texto.trim().length === 0) {
    return new Array(DIMENSIONS_LEXICAL).fill(0);
  }

  const vector = new Float64Array(DIMENSIONS_LEXICAL);
  const tokens = tokenizar(texto);

  for (const token of tokens) {
    for (let n = 2; n <= 3; n++) {
      if (token.length < n) continue;
      for (let i = 0; i <= token.length - n; i++) {
        const gram = token.substring(i, i + n);
        const idx = hashString(gram) % DIMENSIONS_LEXICAL;
        vector[idx] += 1;
      }
    }
  }

  for (const token of tokens) {
    const idx = hashString(token) % DIMENSIONS_LEXICAL;
    vector[idx] *= 1.5;
  }

  let magnitude = 0;
  for (let i = 0; i < DIMENSIONS_LEXICAL; i++) {
    magnitude += vector[i] * vector[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < DIMENSIONS_LEXICAL; i++) {
      vector[i] /= magnitude;
    }
  }

  return Array.from(vector);
};

let openaiClient = null;

const getOpenAIClient = () => {
  if (!openaiClient && API_KEY) {
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL, timeout: 10000 });
  }
  return openaiClient;
};

const gerarEmbeddingSemantico = async (texto) => {
  const client = getOpenAIClient();
  if (!client || !EMBEDDING_MODEL) throw new Error('Cliente ou modelo não configurado');

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texto.trim()
  });
  return response.data[0].embedding;
};

const gerarEmbedding = (texto) => {
  return gerarEmbeddingLexical(texto);
};

const gerarEmbeddingAsync = async (texto) => {
  if (MODO_SEMANTICO) {
    try {
      return await gerarEmbeddingSemantico(texto);
    } catch (err) {
      console.warn('[EMBEDDING] API falhou, usando lexical:', err.message);
    }
  }
  return gerarEmbeddingLexical(texto);
};

const calcularSimilaridade = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
};

const SIMILARIDADE_MINIMA = MODO_SEMANTICO ? 0.70 : 0.25;

module.exports = {
  gerarEmbedding,
  gerarEmbeddingAsync,
  gerarEmbeddingLexical,
  calcularSimilaridade,
  DIMENSIONS: MODO_SEMANTICO ? 1536 : DIMENSIONS_LEXICAL,
  SIMILARIDADE_MINIMA,
  MODO_SEMANTICO,
};
