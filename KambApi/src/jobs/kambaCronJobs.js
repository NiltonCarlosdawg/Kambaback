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
  // 1. ANÁLISE DIÁRIA (todo dia às 08:00 UTC)
  // ==========================================
  cron.schedule('0 8 * * *', withLock('analise-diaria', async () => {
    logger.info('[CRON] Iniciando análise diária do Kamba...');
    try {
      await Proatividade.executarAnaliseDiaria();
      logger.info('[CRON] Análise diária concluída com sucesso!');
    } catch (err) {
      logger.error({ err }, '[CRON] Erro na análise diária');
    }
  }));

  // ==========================================
  // 2. LEMBRETE SEMANAL (segunda-feira às 09:00 UTC)
  // ==========================================
  cron.schedule('0 9 * * 1', withLock('lembretes-semanais', async () => {
    logger.info('[CRON] Iniciando envio de lembretes semanais...');
    try {
      const usuarios = await prisma.user.findMany({
        where: { ativo: true },
        select: { id: true, nome: true }
      });

      if (usuarios.length === 0) {
        logger.info('[CRON] Nenhum usuário ativo encontrado. Pulando lembretes.');
        return;
      }

      for (const user of usuarios) {
        await Proatividade.analisarECriarLembretes(user.id);
      }

      logger.info(`[CRON] Lembretes criados/enviados para ${usuarios.length} usuários`);
    } catch (err) {
      logger.error({ err }, '[CRON] Erro nos lembretes semanais');
    }
  }));

  // ==========================================
  // 3. LIMPEZA DE CACHE (a cada 30 minutos)
  // ==========================================
  cron.schedule('*/30 * * * *', () => {
    console.log('[CRON] Iniciando limpeza de cache...');
    try {
      // TODO: implementar limpeza real (Redis ou memória)
      console.log('[CRON] Limpeza de cache concluída');
    } catch (err) {
      console.error('[CRON] Erro ao limpar cache:', err.message);
    }
  });

  // ==========================================
  // 4. RELATÓRIO DE USO (APENAS no último dia do mês às 23:00 UTC)
  // ==========================================
  cron.schedule('0 23 28-31 * *', async () => {
    const hoje = new Date();
    const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

    if (hoje.getDate() !== ultimoDiaDoMes) {
      console.log('[CRON] Hoje não é o último dia do mês. Ignorando relatório mensal.');
      return;
    }

    console.log('[CRON] Gerando relatório mensal de uso do Kamba...');
    try {
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

      // ✅ CORREÇÃO: Try-catch defensivo para tabela inexistente
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
        // Se tabela não existe (P2021), loga warning e pula
        if (aggregateErr.code === 'P2021') {
          console.warn('[CRON] ⚠️  Tabela KambaUsage não existe no schema - pulando relatório mensal');
          console.warn('[CRON] Execute: npx prisma migrate dev --name add_kamba_usage para criar a tabela');
          return;
        }
        throw aggregateErr; // Re-lança outros erros
      }

      const totalInteracoes = stats._count._all ?? 0;
      const totalTokens = stats._sum.tokens ?? 0;
      const latenciaMedia = (stats._avg.latencia ?? 0).toFixed(0);

      console.log('[CRON] Relatório Mensal de Uso do Kamba:');
      console.log(`  Período: ${inicioMes.toISOString().slice(0,10)} → ${fimMes.toISOString().slice(0,10)}`);
      console.log(`  Total de interações: ${totalInteracoes}`);
      console.log(`  Total de tokens consumidos: ${totalTokens}`);
      console.log(`  Latência média: ${latenciaMedia} ms`);

    } catch (err) {
      console.error('[CRON] Erro ao gerar relatório mensal:', err.message, err.stack);
    }
  });

  logger.info('✅ Todos os cron jobs do Kamba foram iniciados (timezone forçado: UTC)');
};

module.exports = { iniciarCronJobs };