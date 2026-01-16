process.env.TZ = 'UTC'; 

const cron = require('node-cron');
const Proatividade = require('../services/kambaProatividadeService');
const prisma = require('../lib/prisma'); // import estático (melhor prática)

/**
 * Configura todas as tarefas agendadas do Kamba
 */
const iniciarCronJobs = () => {
  
  // ==========================================
  // 1. ANÁLISE DIÁRIA (todo dia às 08:00 UTC)
  // ==========================================
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Iniciando análise diária do Kamba...');
    try {
      await Proatividade.executarAnaliseDiaria();
      console.log('[CRON] Análise diária concluída com sucesso!');
    } catch (err) {
      console.error('[CRON] Erro na análise diária:', err.message, err.stack);
    }
  });

  // ==========================================
  // 2. LEMBRETE SEMANAL (segunda-feira às 09:00 UTC)
  // ==========================================
  cron.schedule('0 9 * * 1', async () => {
    console.log('[CRON] Iniciando envio de lembretes semanais...');
    try {
      const usuarios = await prisma.user.findMany({
        where: { ativo: true },
        select: { id: true, nome: true }
      });

      if (usuarios.length === 0) {
        console.log('[CRON] Nenhum usuário ativo encontrado. Pulando lembretes.');
        return;
      }

      for (const user of usuarios) {
        await Proatividade.analisarECriarLembretes(user.id);
      }

      console.log(`[CRON] Lembretes criados/enviados para ${usuarios.length} usuários`);
    } catch (err) {
      console.error('[CRON] Erro nos lembretes semanais:', err.message, err.stack);
    }
  });

  // ==========================================
  // 3. LIMPEZA DE CACHE (a cada 30 minutos)
  // ==========================================
  cron.schedule('*/30 * * * *', () => {
    console.log('[CRON] Iniciando limpeza de cache...');
    try {
      // TODO: implementar limpeza real (Redis ou memória)
      // Exemplo:
      // const { clearCache } = require('../utils/cache');
      // clearCache();
      
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

      const stats = await prisma.kambaUsage.aggregate({
        where: {
          timestamp: { gte: inicioMes, lte: fimMes }
        },
        _sum: { tokens: true },
        _avg: { latencia: true },
        _count: { _all: true }
      });

      const totalInteracoes = stats._count._all ?? 0;
      const totalTokens = stats._sum.tokens ?? 0;
      const latenciaMedia = (stats._avg.latencia ?? 0).toFixed(0);

      console.log('[CRON] Relatório Mensal de Uso do Kamba:');
      console.log(`  Período: ${inicioMes.toISOString().slice(0,10)} → ${fimMes.toISOString().slice(0,10)}`);
      console.log(`  Total de interações: ${totalInteracoes}`);
      console.log(`  Total de tokens consumidos: ${totalTokens}`);
      console.log(`  Latência média: ${latenciaMedia} ms`);

      // TODO: aqui podes adicionar envio por email, slack, ou salvar em tabela de relatórios

    } catch (err) {
      console.error('[CRON] Erro ao gerar relatório mensal:', err.message, err.stack);
    }
  });

  console.log('✅ Todos os cron jobs do Kamba foram iniciados (timezone forçado: UTC)');
};

module.exports = { iniciarCronJobs };