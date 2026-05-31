/**
 * NOTA ARQUITECTURAL: Este embedding é baseado em n-grams + hash determinístico.
 * NÃO é semântico — apenas detecta similaridade lexical (palavras parecidas).
 * Para similaridade semântica real, substituir pela API de embeddings do Groq/OpenAI:
 *   POST /openai/v1/embeddings (model: text-embedding-ada-002 ou equivalent)
 *
 * TODO: Migrar para API embeddings quando latência de rede Angola → API for aceitável.
 * SIMILARIDADE_MINIMA deve ser aumentada de 0.25 para 0.7 após migração.
 */
const DIMENSIONS = 384;

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
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "para",
  "com",
  "um",
  "uma",
  "uns",
  "umas",
  "o",
  "a",
  "os",
  "as",
  "é",
  "e",
  "que",
  "se",
  "por",
  "ao",
  "aos",
  "à",
  "às",
  "tem",
  "têm",
  "ser",
  "mais",
  "mas",
  "foi",
  "são",
  "está",
  "estão",
  "como",
  "já",
  "muito",
  "pode",
  "vai",
  "ter",
  "meu",
  "minha",
  "teu",
  "tua",
  "seu",
  "sua",
  "isso",
  "isto",
  "aquele",
  "aquela",
  "quem",
  "quando",
  "onde",
  "porque",
  "só",
  "sim",
  "não",
  "pra",
  "pro",
  "tudo",
  "saber",
  "fazer",
  "dizer",
  "querer",
  "entre",
  "depois",
  "antes",
  "sempre",
  "nunca",
  "aqui",
  "ali",
  "lá",
  "cá",
  "também",
  "ainda",
  "bem",
  "mal",
  "até",
]);

const gerarEmbedding = (texto) => {
  if (!texto || texto.trim().length === 0) {
    return new Array(DIMENSIONS).fill(0);
  }

  const vector = new Float64Array(DIMENSIONS);
  const tokens = tokenizar(texto);

  for (const token of tokens) {
    for (let n = 2; n <= 3; n++) {
      if (token.length < n) continue;
      for (let i = 0; i <= token.length - n; i++) {
        const gram = token.substring(i, i + n);
        const idx = hashString(gram) % DIMENSIONS;
        vector[idx] += 1;
      }
    }
  }

  // Aplicar IDF aproximado: penalizar tokens muito comuns
  for (const token of tokens) {
    const idx = hashString(token) % DIMENSIONS;
    vector[idx] *= 1.5;
  }

  // Normalizar (L2)
  let magnitude = 0;
  for (let i = 0; i < DIMENSIONS; i++) {
    magnitude += vector[i] * vector[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < DIMENSIONS; i++) {
      vector[i] /= magnitude;
    }
  }

  return Array.from(vector);
};

const calcularSimilaridade = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
};

module.exports = {
  gerarEmbedding,
  calcularSimilaridade,
  DIMENSIONS,
};
