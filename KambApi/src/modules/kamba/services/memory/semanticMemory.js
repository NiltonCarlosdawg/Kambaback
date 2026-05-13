const prisma = require('../../../../lib/prisma');
const { gerarEmbedding, calcularSimilaridade } = require('../ai/embeddingService');

const SIMILARIDADE_MINIMA = 0.25;
const MAX_RESULTADOS = 5;

const gerarEStorage = async (usuarioId, content, contexto, threadId = 'default') => {
  if (!content || content.trim().length < 5) return null;

  const embedding = gerarEmbedding(content);

  try {
    const record = await prisma.kambaEmbedding.create({
      data: {
        usuarioId,
        content,
        contexto,
        threadId,
        embedding
      }
    });
    return record;
  } catch (err) {
    console.error('[SEMANTIC_MEMORY] Erro ao armazenar embedding:', err.message);
    return null;
  }
};

const buscarSimilares = async (usuarioId, query, limite = MAX_RESULTADOS, threadId = null) => {
  if (!query || query.trim().length < 3) return [];

  const queryEmbedding = gerarEmbedding(query);

  const where = { usuarioId };
  if (threadId) where.threadId = threadId;

  try {
    const todos = await prisma.kambaEmbedding.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 100
    });

    const resultados = todos
      .map(record => {
        if (!record.embedding) return null;
        const similaridade = calcularSimilaridade(queryEmbedding, record.embedding);
        return { ...record, similaridade };
      })
      .filter(r => r !== null && r.similaridade >= SIMILARIDADE_MINIMA)
      .sort((a, b) => b.similaridade - a.similaridade)
      .slice(0, limite);

    return resultados;
  } catch (err) {
    console.error('[SEMANTIC_MEMORY] Erro na busca:', err.message);
    return [];
  }
};

const buscarContextoRelevante = async (usuarioId, mensagemAtual, limite = 3) => {
  const resultados = await buscarSimilares(usuarioId, mensagemAtual, limite);

  if (resultados.length === 0) return [];

  return resultados.map(r => ({
    content: r.content,
    contexto: r.contexto,
    similaridade: r.similaridade,
    criadoEm: r.criadoEm
  }));
};

const limparEmbeddings = async (usuarioId, threadId = null) => {
  const where = { usuarioId };
  if (threadId) where.threadId = threadId;

  try {
    await prisma.kambaEmbedding.deleteMany({ where });
    console.log(`[SEMANTIC_MEMORY] Embeddings limpos para ${usuarioId}${threadId ? `/${threadId}` : ''}`);
  } catch (err) {
    console.error('[SEMANTIC_MEMORY] Erro ao limpar:', err.message);
  }
};

module.exports = {
  gerarEStorage,
  buscarSimilares,
  buscarContextoRelevante,
  limparEmbeddings,
  SIMILARIDADE_MINIMA
};
