const prisma = require('../../../../lib/prisma');
const logger = require('../../../../utils/logger');

// ── REGISTO DE USO ──────────────────────────────────────

const registarUso = async ({
  usuarioId, tokens, latencia, modelo, sucesso,
  erro, intencao, sentimento, confianca, ferramentas, promptVersao
}) => {
  try {
    await prisma.kambaUsage.create({
      data: {
        usuarioId,
        tokens: tokens || 0,
        latencia: latencia || 0,
        modelo: modelo || 'unknown',
        sucesso: sucesso !== false,
        erro: erro?.substring(0, 500) || null,
        intencao: intencao || null,
        sentimento: sentimento || null,
        confianca: confianca || null,
        ferramentas: ferramentas || null,
        promptVersao: promptVersao || null
      }
    });
  } catch (err) {
    logger.error({ err }, '[ANALYTICS] Erro ao registar uso');
  }
};

// ── FEEDBACK ─────────────────────────────────────────────

const registarFeedback = async (usuarioId, mensagemId, avaliacao, comentario = null) => {
  const avaliacaoInt = parseInt(avaliacao);
  if (isNaN(avaliacaoInt) || avaliacaoInt < 1 || avaliacaoInt > 5) {
    return { error: 'Avaliação inválida. Use número de 1 a 5' };
  }

  try {
    const feedback = await prisma.kambaFeedback.create({
      data: {
        usuarioId,
        mensagemId: mensagemId || null,
        avaliacao: avaliacaoInt,
        comentario: comentario?.substring(0, 1000) || null
      }
    });

    // Ligar feedback ao registo de uso se mensagemId for passado
    if (mensagemId) {
      await prisma.kambaUsage.updateMany({
        where: { id: mensagemId, usuarioId },
        data: { feedbackId: feedback.id }
      });
    }

    return { success: true, id: feedback.id };
  } catch (err) {
    logger.error({ err }, '[ANALYTICS] Erro ao registar feedback');
    return { error: 'Erro ao registar feedback' };
  }
};

// ── DASHBOARD ────────────────────────────────────────────

const getDashboard = async (usuarioId, dias = 30) => {
  const dataCorte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const [
    usoAgregado,
    usoPorIntencao,
    usoPorDia,
    feedback,
    usoPorHora,
    ferramentasUsadas,
    errosComuns,
    tendenciaSemanal
  ] = await Promise.all([
    // Métricas gerais
    prisma.kambaUsage.aggregate({
      where: { usuarioId, criadoEm: { gte: dataCorte } },
      _sum: { tokens: true, latencia: true },
      _avg: { latencia: true, confianca: true },
      _count: true
    }),

    // Uso por intenção
    prisma.kambaUsage.groupBy({
      by: ['intencao'],
      where: { usuarioId, criadoEm: { gte: dataCorte }, intencao: { not: null } },
      _count: true,
      orderBy: { _count: { id: 'desc' } }
    }),

    // Conversas por dia (últimos 7 dias)
    prisma.$queryRaw`
      SELECT DATE("criadoEm") as data, COUNT(*)::int as total
      FROM "KambaUsage"
      WHERE "usuarioId" = ${usuarioId} AND "criadoEm" >= ${dataCorte}
      GROUP BY DATE("criadoEm")
      ORDER BY data ASC
    `,

    // Avaliações de feedback
    prisma.kambaFeedback.findMany({
      where: { usuarioId, criadoEm: { gte: dataCorte } },
      orderBy: { criadoEm: 'desc' },
      take: 20
    }),

    // Uso por hora do dia
    prisma.$queryRaw`
      SELECT EXTRACT(HOUR FROM "criadoEm")::int as hora, COUNT(*)::int as total
      FROM "KambaUsage"
      WHERE "usuarioId" = ${usuarioId} AND "criadoEm" >= ${dataCorte}
      GROUP BY hora
      ORDER BY hora ASC
    `,

    // Ferramentas mais usadas
    prisma.kambaUsage.findMany({
      where: { usuarioId, criadoEm: { gte: dataCorte }, ferramentas: { not: null } },
      select: { ferramentas: true },
      take: 100
    }),

    // Erros mais comuns
    prisma.kambaUsage.groupBy({
      by: ['erro'],
      where: { usuarioId, criadoEm: { gte: dataCorte }, sucesso: false, erro: { not: null } },
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 5
    }),

    // Média de sentimento por semana (últimas 4)
    prisma.$queryRaw`
      SELECT DATE_TRUNC('week', "criadoEm") as semana,
             COUNT(*)::int as total,
             AVG(CASE WHEN "sentimento" IN ('positivo') THEN 1
                      WHEN "sentimento" IN ('negativo','frustracao') THEN -1
                      ELSE 0 END) as score
      FROM "KambaUsage"
      WHERE "usuarioId" = ${usuarioId}
        AND "criadoEm" >= ${new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)}
      GROUP BY semana
      ORDER BY semana ASC
    `
  ]);

  // Processar ferramentas
  const toolCounter = {};
  for (const row of ferramentasUsadas) {
    const tools = row.ferramentas;
    if (Array.isArray(tools)) {
      for (const t of tools) {
        const nome = typeof t === 'string' ? t : t.nome;
        if (nome) toolCounter[nome] = (toolCounter[nome] || 0) + 1;
      }
    }
  }

  const ferramentasTop = Object.entries(toolCounter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, count]) => ({ nome, count }));

  // Processar feedback
  const totalFeedback = feedback.length;
  const mediaAvaliacao = totalFeedback > 0
    ? feedback.reduce((acc, f) => acc + f.avaliacao, 0) / totalFeedback
    : 0;

  const sucessos = await prisma.kambaUsage.count({
    where: { usuarioId, criadoEm: { gte: dataCorte }, sucesso: true }
  });
  const totalReqs = usoAgregado._count || 0;

  return {
    periodo: `${dias} dias`,
    resumo: {
      totalInteracoes: totalReqs,
      taxaSucesso: totalReqs > 0 ? Math.round((sucessos / totalReqs) * 100) : 0,
      totalTokens: usoAgregado._sum.tokens || 0,
      latenciaMedia: Math.round(usoAgregado._avg.latencia || 0),
      confiancaMedia: usoAgregado._avg.confianca
        ? Math.round(usoAgregado._avg.confianca * 100) / 100
        : 0,
      mediaAvaliacao: Math.round(mediaAvaliacao * 10) / 10
    },
    intencoes: usoPorIntencao.map(i => ({
      intencao: i.intencao,
      total: i._count,
      percentual: totalReqs > 0 ? Math.round((i._count / totalReqs) * 100) : 0
    })),
    conversasPorDia: usoPorDia.map(d => ({
      data: d.data,
      total: Number(d.total)
    })),
    usoPorHora: usoPorHora.map(h => ({
      hora: h.hora,
      total: Number(h.total)
    })),
    ferramentasTop,
    errosComuns: errosComuns.map(e => ({
      erro: e.erro?.substring(0, 100) || 'Erro desconhecido',
      total: e._count
    })),
    tendenciaSemanal: tendenciaSemanal.map(s => ({
      semana: s.semana,
      total: Number(s.total),
      score: Number(Number(s.score).toFixed(2))
    })),
    feedback: {
      total: totalFeedback,
      media: Math.round(mediaAvaliacao * 10) / 10,
      ultimos: feedback.slice(0, 5).map(f => ({
        avaliacao: f.avaliacao,
        comentario: f.comentario,
        data: f.criadoEm
      }))
    }
  };
};

// ── A/B TESTING ─────────────────────────────────────────

const getPromptVersao = async (usuarioId) => {
  const versoesAtivas = await prisma.kambaPromptTest.findMany({
    where: { ativo: true }
  });

  if (versoesAtivas.length === 0) return null;

  // Se o user já tem uma versão atribuída, usar a mesma
  const userHash = usuarioId.charCodeAt(usuarioId.length - 1) || 0;
  const idx = userHash % versoesAtivas.length;
  const versao = versoesAtivas[idx];

  return {
    versao: versao.versao,
    nome: versao.nome,
    promptContent: versao.promptContent
  };
};

const criarTestePrompt = async (versao, nome, promptContent, descricao = '') => {
  try {
    // Desativar versão anterior com mesmo nome
    await prisma.kambaPromptTest.updateMany({
      where: { nome, ativo: true },
      data: { ativo: false }
    });

    // Verificar se versão já existe
    const existente = await prisma.kambaPromptTest.findFirst({
      where: { versao, nome, ativo: true }
    });

    if (existente) {
      await prisma.kambaPromptTest.update({
        where: { id: existente.id },
        data: { promptContent, descricao, ativo: true }
      });
      return { success: true, id: existente.id };
    }

    const teste = await prisma.kambaPromptTest.create({
      data: { versao, nome, promptContent, descricao, ativo: true }
    });
    return { success: true, id: teste.id };
  } catch (err) {
    logger.error({ err }, '[ANALYTICS] Erro ao criar teste de prompt');
    return { error: err.message };
  }
};

const getResultadosTestes = async () => {
  const versoes = await prisma.kambaPromptTest.findMany({
    orderBy: [{ ativo: 'desc' }, { criadoEm: 'desc' }]
  });

  return versoes.map(v => ({
    id: v.id,
    versao: v.versao,
    nome: v.nome,
    descricao: v.descricao,
    ativo: v.ativo,
    usuariosAlocados: v.usuariosAlocados,
    scoreMedio: v.scoreMedio,
    totalRespostas: v.totalRespostas
  }));
};

const registarRespostaTeste = async (promptVersao, avaliacao) => {
  if (!promptVersao) return;

  try {
    const teste = await prisma.kambaPromptTest.findFirst({
      where: { versao: promptVersao, ativo: true }
    });

    if (!teste) return;

    const novoTotal = teste.totalRespostas + 1;
    const novoScore = ((teste.scoreMedio * teste.totalRespostas) + avaliacao) / novoTotal;

    await prisma.kambaPromptTest.update({
      where: { id: teste.id },
      data: {
        totalRespostas: novoTotal,
        scoreMedio: novoScore,
        usuariosAlocados: { increment: 1 }
      }
    });
  } catch (err) {
    logger.error({ err }, '[ANALYTICS] Erro ao registar resposta de teste');
  }
};

module.exports = {
  registarUso,
  registarFeedback,
  getDashboard,
  getPromptVersao,
  criarTestePrompt,
  getResultadosTestes,
  registarRespostaTeste
};
