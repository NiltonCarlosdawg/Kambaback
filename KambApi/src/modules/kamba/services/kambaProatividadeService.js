// src/services/kambaProatividadeService.js

const prisma = require("../../../lib/prisma");
const { emitirLembrete } = require("../../../websocket/socketConfig");
const NotificacaoService = require("../../users/services/notificacaoService");
const { detectarPadroes } = require("./ai/patternDetectionService");
const { gerarPrevisoes } = require("./ai/predictionService");
const {
  getConceitoAleatorio,
  getDicaDiaria,
  getDesafioMensal,
  buscarConceito,
} = require("./ai/educacaoFinanceira");

// ==========================================
// SISTEMA DE PROATIVIDADE DO KAMBA
// ==========================================

/**
 * Helper: retorna título legível por tipo de lembrete
 */
const getTituloPorTipo = (tipo) => {
  const titulos = {
    gasto_alto: "⚠️ Gasto Elevado",
    objetivo_perto: "⏰ Meta Próxima",
    fundo_baixo: "🛡️ Fundo de Emergência Baixo",
    balanco_semanal: "📊 Balanço Semanal",
    dica_economia: "💡 Dica de Economia",
  };
  return titulos[tipo] || "🔔 Notificação";
};

/**
 * Cria lembrete no banco com operação atómica.
 * Emissão WebSocket e notificação persistente são feitas após
 * confirmar gravação no BD (evita inconsistência).
 */
const criarLembrete = async (usuarioId, tipo, mensagem) => {
  try {
    // Verifica duplicado nas últimas 24h
    const jaExiste = await prisma.kambaLembrete.findFirst({
      where: {
        usuarioId,
        tipo,
        enviado: false,
        dataHora: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (jaExiste) {
      console.log(
        `[LEMBRETE] Já existe lembrete '${tipo}' para user ${usuarioId} nas últimas 24h`,
      );
      return null;
    }

    const titulo = getTituloPorTipo(tipo);

    // Salva no BD primeiro - fonte de verdade
    const lembrete = await prisma.kambaLembrete.create({
      data: {
        usuarioId,
        tipo,
        titulo,
        mensagem,
        dataHora: new Date(),
        enviado: false,
        lido: false,
      },
    });

    // Emissões secundárias (não-críticas): falhas aqui não afectam o lembrete criado
    const payload = {
      id: lembrete.id,
      tipo: lembrete.tipo,
      titulo: lembrete.titulo,
      mensagem: lembrete.mensagem,
      dataHora: lembrete.dataHora,
    };

    // Emite WebSocket (fire-and-forget seguro)
    Promise.resolve()
      .then(() => emitirLembrete(usuarioId, payload))
      .catch((err) =>
        console.error("[LEMBRETE] Erro no WebSocket:", err.message),
      );

    // Cria notificação persistente (fire-and-forget seguro)
    Promise.resolve()
      .then(() =>
        NotificacaoService.criarNotificacao(
          usuarioId,
          `LEMBRETE_${tipo.toUpperCase()}`,
          titulo,
          mensagem,
          { lembreteId: lembrete.id },
        ),
      )
      .catch((err) =>
        console.error("[LEMBRETE] Erro ao criar notificação:", err.message),
      );

    console.log(`[LEMBRETE] Criado: ${tipo} para user ${usuarioId}`);
    return lembrete;
  } catch (err) {
    console.error("[LEMBRETE] Erro ao criar:", err.message);
    return null;
  }
};

/**
 * Analisa situação financeira do utilizador e cria lembretes proativos
 */
const analisarECriarLembretes = async (usuarioId) => {
  try {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    // Busca dados em paralelo para eficiência
    const [gastosDoMes, user] = await Promise.all([
      prisma.gasto.findMany({
        where: {
          usuarioId,
          data: { gte: inicioMes },
          excluido: false,
          tipo: "DESPESA",
        },
        select: { valor: true },
      }),
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { rendaMensalMedia: true },
      }),
    ]);

    if (!user) {
      console.warn(`[PROATIVIDADE] User ${usuarioId} não encontrado`);
      return;
    }

    const totalGasto = gastosDoMes.reduce((acc, g) => acc + Number(g.valor), 0);
    const renda = Number(user.rendaMensalMedia) || 0;

    // 1. ALERTA DE GASTOS ALTOS (>80% da renda)
    if (renda > 0 && totalGasto > renda * 0.8) {
      const percentual = Math.round((totalGasto / renda) * 100);
      await criarLembrete(
        usuarioId,
        "gasto_alto",
        `⚠️ Atenção, kamba! Já gastaste ${totalGasto.toLocaleString("pt-AO")} AOA este mês (${percentual}% da tua renda). Controla o kumbú! 💸`,
      );
    }

    // 2. OBJETIVOS PRÓXIMOS DO PRAZO (7 dias)
    const objetivosProximos = await prisma.objetivo.findMany({
      where: {
        usuarioId,
        concluido: false,
        excluido: false,
        dataPrevista: {
          gte: agora,
          lte: new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    for (const obj of objetivosProximos) {
      const valorAtual = Number(obj.valorAtual);
      const valorAlvo = Number(obj.valorAlvo);
      if (valorAlvo <= 0) continue;

      const progresso = (valorAtual / valorAlvo) * 100;
      if (progresso < 80) {
        const falta = (valorAlvo - valorAtual).toLocaleString("pt-AO");
        await criarLembrete(
          usuarioId,
          "objetivo_perto",
          `⏰ Meta "${obj.titulo}" vence em breve com apenas ${progresso.toFixed(0)}% concluído! Faltam ${falta} AOA. Bora acelerar? 🚀`,
        );
      }
    }

    // 3. FUNDO DE EMERGÊNCIA BAIXO
    const cartoes = await prisma.cartao.findMany({
      where: {
        usuarioId,
        ativo: true,
        excluido: false,
        OR: [
          { tipo: "POUPANCA" },
          { nome: { contains: "Reserva", mode: "insensitive" } },
          { nome: { contains: "Emergência", mode: "insensitive" } },
          { nome: { contains: "Emergencia", mode: "insensitive" } },
        ],
      },
      select: { saldoAtual: true },
    });

    const reservaTotal = cartoes.reduce(
      (acc, c) => acc + Number(c.saldoAtual),
      0,
    );

    if (reservaTotal > 0) {
      const diasNoMes = Math.max(agora.getDate(), 1);
      const gastoMedioDiario = totalGasto / diasNoMes;
      const mesesReserva =
        gastoMedioDiario > 0 ? reservaTotal / (gastoMedioDiario * 30) : 0;

      if (mesesReserva < 3) {
        await criarLembrete(
          usuarioId,
          "fundo_baixo",
          `🛡️ O teu fundo de emergência cobre apenas ${mesesReserva.toFixed(1)} meses. O ideal são 6 meses! Bora reforçar, kamba? 💪`,
        );
      }
    }

    // 4. BALANÇO SEMANAL (às segundas-feiras)
    if (agora.getDay() === 1) {
      await criarLembrete(
        usuarioId,
        "balanco_semanal",
        `📊 Bom dia, kamba! Nova semana, nova oportunidade. Já registaste todos os gastos da semana passada? Mantém tudo actualizado! 👊`,
      );
    }

    // 5. PADRÕES RECORRENTES
    try {
      const { padroes, insights } = await detectarPadroes(usuarioId);
      for (const insight of insights) {
        if (insight.tipo === "velocidade_alta") {
          await criarLembrete(usuarioId, "velocidade_alta", insight.mensagem);
        }
        if (insight.tipo === "gasto_crescente") {
          await criarLembrete(usuarioId, "gasto_crescente", insight.mensagem);
        }
      }
    } catch (err) {
      console.error(`[PROATIVIDADE] Erro na detecção de padrões:`, err.message);
    }

    // 6. PREVISÕES
    try {
      const previsoes = await gerarPrevisoes(usuarioId);
      for (const pv of previsoes) {
        if (pv.tipo === "bater_parede" || pv.tipo === "ja_bateu") {
          await criarLembrete(usuarioId, "previsao_bater_parede", pv.mensagem);
        }
        if (pv.tipo === "categoria_acima") {
          await criarLembrete(usuarioId, "categoria_acima", pv.mensagem);
        }
      }
    } catch (err) {
      console.error(`[PROATIVIDADE] Erro nas previsões:`, err.message);
    }

    console.log(`[PROATIVIDADE] Análise concluída para user ${usuarioId}`);
  } catch (err) {
    console.error(`[PROATIVIDADE] Erro para user ${usuarioId}:`, err.message);
  }
};

/**
 * Busca lembretes pendentes para entregar ao utilizador
 */
const buscarLembretesPendentes = async (usuarioId) => {
  try {
    return await prisma.kambaLembrete.findMany({
      where: {
        usuarioId,
        enviado: false,
        dataHora: { lte: new Date() },
      },
      orderBy: { dataHora: "asc" },
      take: 3,
    });
  } catch (err) {
    console.error("[LEMBRETE] Erro ao buscar pendentes:", err.message);
    return [];
  }
};

/**
 * Marca lembrete como enviado (foi incluído numa resposta)
 */
const marcarLembreteEnviado = async (lembreteId, usuarioId) => {
  try {
    const resultado = await prisma.kambaLembrete.updateMany({
      where: { id: lembreteId, usuarioId },
      data: { enviado: true },
    });
    if (resultado.count === 0) {
      console.warn(
        `[LEMBRETE] Tentativa de marcar lembrete ${lembreteId} sem ownership (user ${usuarioId})`,
      );
    }
  } catch (err) {
    console.error("[LEMBRETE] Erro ao marcar enviado:", err.message);
  }
};

/**
 * Marca lembrete como lido pelo utilizador
 */
const marcarLembreteLido = async (lembreteId, usuarioId) => {
  // F-017: sem usuarioId o Prisma descartaria o filtro (undefined) e o
  // updateMany marcaria lembretes de qualquer utilizador — recusa sem ownership.
  if (!lembreteId || !usuarioId) {
    console.warn(
      `[LEMBRETE] marcarLembreteLido recusado sem id ou utilizador (id=${lembreteId}, user=${usuarioId})`,
    );
    return 0;
  }
  try {
    const resultado = await prisma.kambaLembrete.updateMany({
      where: { id: lembreteId, usuarioId },
      data: { lido: true },
    });
    if (resultado.count === 0) {
      console.warn(
        `[LEMBRETE] Tentativa de marcar lembrete ${lembreteId} sem ownership (user ${usuarioId})`,
      );
    }
    return resultado.count;
  } catch (err) {
    console.error("[LEMBRETE] Erro ao marcar lido:", err.message);
    return 0;
  }
};

/**
 * Adiciona lembretes pendentes ao final de uma resposta do Kamba
 */
const adicionarLembretesNaResposta = async (usuarioId, respostaOriginal) => {
  try {
    const lembretes = await buscarLembretesPendentes(usuarioId);

    if (lembretes.length === 0) {
      return respostaOriginal;
    }

    let respostaComLembretes = respostaOriginal + "\n\n---\n";

    for (const lembrete of lembretes) {
      respostaComLembretes += `\n${lembrete.titulo}\n${lembrete.mensagem}\n`;
      // Marca como enviado de forma assíncrona (não bloqueia a resposta)
      marcarLembreteEnviado(lembrete.id, usuarioId).catch(() => {});
    }

    return respostaComLembretes;
  } catch (err) {
    console.error("[LEMBRETE] Erro ao adicionar na resposta:", err.message);
    return respostaOriginal; // Retorna original em caso de erro (nunca falha a resposta)
  }
};

/**
 * Cron Job: análise diária para todos os utilizadores activos
 */
const executarAnaliseDiaria = async () => {
  try {
    console.log("[CRON] Iniciando análise proativa diária...");

    const usuarios = await prisma.user.findMany({
      where: { ativo: true },
      select: { id: true },
    });

    let processados = 0;
    let erros = 0;

    for (const user of usuarios) {
      try {
        await analisarECriarLembretes(user.id);
        processados++;
      } catch (err) {
        erros++;
        console.error(`[CRON] Erro para user ${user.id}:`, err.message);
      }
      // Delay entre processamentos para não sobrecarregar o BD
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(
      `[CRON] Análise concluída: ${processados} OK, ${erros} erros de ${usuarios.length} users`,
    );
  } catch (err) {
    console.error("[CRON] Erro crítico:", err.message);
  }
};

/**
 * Gera dica proativa baseada no maior gasto do mês
 */
const gerarDicaProativa = async (usuarioId) => {
  try {
    const mes30DiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const gastos = await prisma.gasto.findMany({
      where: {
        usuarioId,
        data: { gte: mes30DiasAtras },
        excluido: false,
        tipo: "DESPESA",
      },
      include: { categoria: { select: { nome: true } } },
    });

    if (gastos.length === 0) return null;

    // Agrupa por categoria
    const porCategoria = gastos.reduce((acc, g) => {
      const cat = g.categoria?.nome || "Geral";
      if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
      acc[cat].total += Number(g.valor);
      acc[cat].count++;
      return acc;
    }, {});

    const topEntry = Object.entries(porCategoria).sort(
      (a, b) => b[1].total - a[1].total,
    )[0];

    if (!topEntry) return null;

    const [catMaisGasta, dados] = topEntry;
    const valorFmt = dados.total.toLocaleString("pt-AO");

    const dicasPorCategoria = {
      Alimentação: `💡 Notei que gastas muito em Alimentação (${valorFmt} AOA/mês). Que tal cozinhar mais em casa? Podes poupar até 40% desse valor!`,
      Transporte: `💡 Transporte tá a pesar, kamba (${valorFmt} AOA/mês). Considera combinar viagens com colegas ou usar o candongueiro nalgumas rotas!`,
      Lazer: `💡 ${valorFmt} AOA em Lazer! Estás a curtir, mas garante que não falta no fim do mês. Um limite mensal ajuda bastante. 🎯`,
      Saúde: `💡 Investir em Saúde é importante! ${valorFmt} AOA/mês é bastante. Já pensaste num plano de saúde ou clínica de confiança?`,
    };

    return (
      dicasPorCategoria[catMaisGasta] ||
      `💡 A categoria "${catMaisGasta}" já vai em ${valorFmt} AOA este mês. Tá dentro do teu orçamento?`
    );
  } catch (err) {
    console.error("[DICA] Erro:", err.message);
    return null;
  }
};

// ==========================================
// EXPORTAÇÕES
// ==========================================
module.exports = {
  analisarECriarLembretes,
  buscarLembretesPendentes,
  marcarLembreteEnviado,
  marcarLembreteLido,
  adicionarLembretesNaResposta,
  executarAnaliseDiaria,
  gerarDicaProativa,
  // Novas funcionalidades da Fase 6
  detectarPadroes,
  gerarPrevisoes,
  getConceitoAleatorio,
  getDicaDiaria,
  getDesafioMensal,
  buscarConceito,
};
