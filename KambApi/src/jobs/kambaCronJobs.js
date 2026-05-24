process.env.TZ = 'UTC';

const cron = require('node-cron');
const Proatividade = require('../modules/kamba/services/kambaProatividadeService');
const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

/**
 * Configura todas as tarefas agendadas do Kamba
 */
const runningJobs = new Set();

const withLock = (name, fn) => {
  return async () => {
    if (runningJobs.has(name)) {
      console.log(`[CRON] Job ${name} já em execução. Ignorando...`);
      return;
    }
    runningJobs.add(name);
    try {
      await fn();
    } finally {
      runningJobs.delete(name);
    }
  };
};

const iniciarCronJobs = () => {

  // ==========================================
  // 1. ANÁLISE PROATIVA (todo dia às 08:00 UTC)
  // Inclui análise diária e balanço semanal (segundas)
  // ==========================================
  cron.schedule('0 8 * * *', withLock('analise-proativa', async () => {
    logger.info('[CRON] Iniciando análise proativa do Kamba...');
    try {
      await Proatividade.executarAnaliseDiaria();
      logger.info('[CRON] Análise proativa concluída com sucesso!');
    } catch (err) {
      logger.error({ err }, '[CRON] Erro na análise proativa');
    }
  }));

  // ==========================================
  // 2. LIMPEZA DE CACHE (a cada 30 minutos)
  // ==========================================
  cron.schedule('*/30 * * * *', async () => {
    try {
      // O cacheService baseado em Redis/Memory já gere TTL,
      // este job serve para limpezas manuais se necessário futuramente.
      const cacheService = require('../modules/kamba/services/core/cacheService');
      if (typeof cacheService.limparExpirados === 'function') {
        await cacheService.limparExpirados();
        logger.info('[CRON] Limpeza de cache expirado concluída');
      }
    } catch (err) {
      logger.error('[CRON] Erro ao limpar cache:', err.message);
    }
  });

  // ==========================================
  // 3. RELATÓRIO DE USO (APENAS no último dia do mês às 23:00 UTC)
  // ==========================================
  cron.schedule('0 23 28-31 * *', async () => {
    const hoje = new Date();
    const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

    if (hoje.getDate() !== ultimoDiaDoMes) {
      return;
    }

    logger.info('[CRON] Gerando relatório mensal de uso do Kamba...');
    try {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

      let stats;
      try {
        stats = await prisma.kambaUsage.aggregate({
          where: {
            criadoEm: { gte: inicioMes, lte: fimMes }
          },
          _sum: { tokens: true },
          _avg: { latencia: true },
          _count: { _all: true }
        });
      } catch (aggregateErr) {
        if (aggregateErr.code === 'P2021') {
          logger.warn('[CRON] Tabela KambaUsage não existe no schema - pulando relatório');
          return;
        }
        throw aggregateErr;
      }

      const totalInteracoes = stats._count._all ?? 0;
      const totalTokens = stats._sum.tokens ?? 0;
      const latenciaMedia = (stats._avg.latencia ?? 0).toFixed(0);

      logger.info({
        periodo: `${inicioMes.toISOString().slice(0, 10)} -> ${fimMes.toISOString().slice(0, 10)}`,
        interacoes: totalInteracoes,
        tokens: totalTokens,
        latenciaMedia: `${latenciaMedia}ms`
      }, '[CRON] Relatório Mensal de Uso concluído');

    } catch (err) {
      logger.error({ err }, '[CRON] Erro ao gerar relatório mensal');
    }
  });

  logger.info('✅ Todos os cron jobs do Kamba foram iniciados (timezone forçado: UTC)');
};

module.exports = { iniciarCronJobs };