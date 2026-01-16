// src/services/kambaProatividadeService.js

const prisma = require('../lib/prisma');

// ==========================================
// SISTEMA DE PROATIVIDADE DO KAMBA
// ==========================================

/**
 * Analisa situação financeira e cria lembretes proativos
 */
const analisarECriarLembretes = async (usuarioId) => {
  try {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    // 1. VERIFICA GASTOS ALTOS
    const gastosDoMes = await prisma.gasto.findMany({
      where: {
        usuarioId,
        data: { gte: inicioMes },
        excluido: false
      }
    });

    const totalGasto = gastosDoMes.reduce((acc, g) => acc + Number(g.valor), 0);
    
    const user = await prisma.user.findUnique({
      where: { id: usuarioId },
      select: { rendaMensalMedia: true }
    });

    // Se gastou mais de 80% da renda
    if (totalGasto > (user.rendaMensalMedia * 0.8)) {
      await criarLembrete(usuarioId, 'gasto_alto', 
        `⚠️ Alerta, kamba! Já gastaste ${totalGasto.toLocaleString('pt-AO')} Kz este mês (${Math.round(totalGasto/user.rendaMensalMedia*100)}% da tua renda). Controla os gastos! 💸`
      );
    }

    // 2. VERIFICA OBJETIVOS PRÓXIMOS
    const objetivosProximos = await prisma.objetivo.findMany({
      where: {
        usuarioId,
        concluido: false,
        prazo: {
          gte: agora,
          lte: new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 dias
        }
      }
    });

    for (const obj of objetivosProximos) {
      const progresso = (Number(obj.valorAtual) / Number(obj.valorAlvo)) * 100;
      if (progresso < 80) {
        await criarLembrete(usuarioId, 'objetivo_perto',
          `⏰ Meta "${obj.nome}" vence em breve e tá ${progresso.toFixed(0)}%! Faltam ${(Number(obj.valorAlvo) - Number(obj.valorAtual)).toLocaleString('pt-AO')} Kz. Bora acelerar? 🚀`
        );
      }
    }

    // 3. VERIFICA FUNDO DE EMERGÊNCIA
    const cartoes = await prisma.cartao.findMany({
      where: { usuarioId, ativo: true, tipo: 'RESERVA' }
    });

    const reservaTotal = cartoes.reduce((acc, c) => acc + Number(c.saldoAtual), 0);
    const mesesReserva = reservaTotal / (totalGasto / new Date().getDate());

    if (mesesReserva < 3) {
      await criarLembrete(usuarioId, 'fundo_baixo',
        `🛡️ Teu fundo de emergência cobre apenas ${mesesReserva.toFixed(1)} meses. Ideal é 6 meses! Bora reforçar, kamba? 💪`
      );
    }

    // 4. LEMBRETE SEMANAL DE BALANÇO
    const diaSemanais = agora.getDay();
    if (diaSemanais === 1) { // Segunda-feira
      await criarLembrete(usuarioId, 'balanco_semanal',
        `📊 Bom dia, kamba! Como foi a semana passada? Já registaste todos os gastos? Mantém tudo atualizado! 👊`
      );
    }

    console.log(`[PROATIVIDADE] Análise concluída para user ${usuarioId}`);
  } catch (err) {
    console.error('[PROATIVIDADE] Erro:', err.message);
  }
};

/**
 * Cria lembrete no banco
 */
const criarLembrete = async (usuarioId, tipo, mensagem) => {
  try {
    // Verifica se já existe lembrete similar não enviado
    const jaExiste = await prisma.kambaLembrete.findFirst({
      where: {
        usuarioId,
        tipo,
        enviado: false,
        agendadoPara: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // últimas 24h
        }
      }
    });

    if (jaExiste) {
      console.log(`[LEMBRETE] Já existe lembrete ${tipo} para user ${usuarioId}`);
      return;
    }

    await prisma.kambaLembrete.create({
      data: {
        usuarioId,
        tipo,
        mensagem,
        agendadoPara: new Date(),
        enviado: false
      }
    });

    console.log(`[LEMBRETE] Criado: ${tipo} para user ${usuarioId}`);
  } catch (err) {
    console.error('[LEMBRETE] Erro ao criar:', err.message);
  }
};

/**
 * Busca lembretes pendentes de um usuário
 */
const buscarLembretesPendentes = async (usuarioId) => {
  try {
    const lembretes = await prisma.kambaLembrete.findMany({
      where: {
        usuarioId,
        enviado: false,
        agendadoPara: { lte: new Date() }
      },
      orderBy: { agendadoPara: 'asc' },
      take: 3 // Máximo 3 lembretes por vez
    });

    return lembretes;
  } catch (err) {
    console.error('[LEMBRETE] Erro ao buscar:', err.message);
    return [];
  }
};

/**
 * Marca lembrete como enviado
 */
const marcarLembreteEnviado = async (lembreteId) => {
  try {
    await prisma.kambaLembrete.update({
      where: { id: lembreteId },
      data: { enviado: true }
    });
  } catch (err) {
    console.error('[LEMBRETE] Erro ao marcar:', err.message);
  }
};

/**
 * Adiciona lembretes à resposta do Kamba
 */
const adicionarLembretesNaResposta = async (usuarioId, respostaOriginal) => {
  const lembretes = await buscarLembretesPendentes(usuarioId);
  
  if (lembretes.length === 0) {
    return respostaOriginal;
  }

  let respostaComLembretes = respostaOriginal + '\n\n---\n\n';
  
  for (const lembrete of lembretes) {
    respostaComLembretes += lembrete.mensagem + '\n\n';
    await marcarLembreteEnviado(lembrete.id);
  }

  return respostaComLembretes;
};

/**
 * Cron Job - Executar análise diária (integrar com node-cron ou similar)
 */
const executarAnaliseDiaria = async () => {
  try {
    console.log('[CRON] Iniciando análise proativa...');
    
    // Busca todos os usuários ativos
    const usuarios = await prisma.user.findMany({
      where: { ativo: true },
      select: { id: true }
    });

    for (const user of usuarios) {
      await analisarECriarLembretes(user.id);
      // Delay para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[CRON] Análise concluída para ${usuarios.length} usuários`);
  } catch (err) {
    console.error('[CRON] Erro:', err.message);
  }
};

/**
 * Dicas proativas baseadas em padrões
 */
const gerarDicaProativa = async (usuarioId) => {
  try {
    const agora = new Date();
    const mes30DiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Busca padrões de gastos
    const gastos = await prisma.gasto.findMany({
      where: {
        usuarioId,
        data: { gte: mes30DiasAtras },
        excluido: false
      },
      include: { categoria: true }
    });

    // Agrupa por categoria
    const porCategoria = gastos.reduce((acc, g) => {
      const cat = g.categoria?.nome || 'Geral';
      if (!acc[cat]) {
        acc[cat] = { total: 0, count: 0 };
      }
      acc[cat].total += Number(g.valor);
      acc[cat].count++;
      return acc;
    }, {});

    // Encontra categoria com mais gastos
    const [catMaisGasta, dados] = Object.entries(porCategoria)
      .sort((a, b) => b[1].total - a[1].total)[0] || [null, null];

    if (!catMaisGasta) {
      return null;
    }

    const dicasPorCategoria = {
      'Alimentação': `🍽️ Notei que gastas muito em Alimentação (${dados.total.toLocaleString('pt-AO')} Kz/mês). Que tal cozinhar mais em casa? Poupas até 40%! 💡`,
      'Transporte': `🚗 Transporte tá pesando, kamba (${dados.total.toLocaleString('pt-AO')} Kz/mês). Considera usar candongueiro ou partilhar Uber! 💡`,
      'Lazer': `🎉 ${dados.total.toLocaleString('pt-AO')} Kz em Lazer! Tá curtindo, mas controla pra não faltar no final do mês, yha? 💡`,
      'Saúde': `💊 Investir em Saúde é importante! Mas ${dados.total.toLocaleString('pt-AO')} Kz/mês... Considera plano de saúde? 💡`
    };

    return dicasPorCategoria[catMaisGasta] || 
      `💡 Categoria "${catMaisGasta}" já vai em ${dados.total.toLocaleString('pt-AO')} Kz este mês. Tá ok pra ti?`;

  } catch (err) {
    console.error('[DICA] Erro:', err.message);
    return null;
  }
};

module.exports = {
  analisarECriarLembretes,
  buscarLembretesPendentes,
  marcarLembreteEnviado,
  adicionarLembretesNaResposta,
  executarAnaliseDiaria,
  gerarDicaProativa
};