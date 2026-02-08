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
        excluido: false,
        dataPrevista: {  // CORRIGIDO: era 'dataFinal', agora é 'dataPrevista'
          gte: agora,
          lte: new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 dias
        }
      }
    });

    for (const obj of objetivosProximos) {
      const progresso = (Number(obj.valorAtual) / Number(obj.valorAlvo)) * 100;
      if (progresso < 80) {
        await criarLembrete(usuarioId, 'objetivo_perto',
          `⏰ Meta "${obj.titulo}" vence em breve e tá ${progresso.toFixed(0)}%! Faltam ${(Number(obj.valorAlvo) - Number(obj.valorAtual)).toLocaleString('pt-AO')} Kz. Bora acelerar? 🚀`
        );
      }
    }

    // 3. VERIFICA FUNDO DE EMERGÊNCIA
    const cartoes = await prisma.cartao.findMany({
      where: { 
        usuarioId, 
        ativo: true,
        excluido: false,
        OR: [
          { tipo: 'POUPANCA' },  // CORRIGIDO: 'investimento' → 'POUPANCA'
          { nome: { contains: 'Reserva', mode: 'insensitive' } },
          { nome: { contains: 'Emergência', mode: 'insensitive' } }
        ]
      }
    });

    const reservaTotal = cartoes.reduce((acc, c) => acc + Number(c.saldoAtual), 0);
    
    // Evitar divisão por zero
    const diasNoMes = new Date().getDate();
    const gastoMedioDiario = totalGasto / (diasNoMes > 0 ? diasNoMes : 1);
    const mesesReserva = gastoMedioDiario > 0 ? reservaTotal / (gastoMedioDiario * 30) : 0;

    if (mesesReserva < 3 && reservaTotal > 0) {
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
 * Helper para gerar título baseado no tipo de lembrete
 */
const getTituloPorTipo = (tipo) => {
  const titulos = {
    'gasto_alto': '⚠️ Gasto Elevado',
    'objetivo_perto': '⏰ Meta Próxima',
    'fundo_baixo': '🛡️ Fundo de Emergência Baixo',
    'balanco_semanal': '📊 Balanço Semanal',
    'dica_economia': '💡 Dica de Economia'
  };
  return titulos[tipo] || '📢 Notificação';
};

/**
 * Cria lembrete no banco - CORRIGIDO
 */
const criarLembrete = async (usuarioId, tipo, mensagem) => {
  try {
    // Verifica se já existe lembrete similar não enviado nas últimas 24h
    const jaExiste = await prisma.kambaLembrete.findFirst({
      where: {
        usuarioId,
        tipo,
        enviado: false,
        dataHora: {  // CORRIGIDO: era 'agendadoPara', agora é 'dataHora'
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
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
        titulo: getTituloPorTipo(tipo),  // CORRIGIDO: campo obrigatório adicionado
        mensagem,
        dataHora: new Date(),  // CORRIGIDO: era 'agendadoPara', agora é 'dataHora'
        enviado: false,        // CORRIGIDO: campo adicionado
        lido: false            // CORRIGIDO: campo adicionado
      }
    });

    console.log(`[LEMBRETE] Criado: ${tipo} para user ${usuarioId}`);
  } catch (err) {
    console.error('[LEMBRETE] Erro ao criar:', err.message);
  }
};

/**
 * Busca lembretes pendentes de um usuário - CORRIGIDO
 */
const buscarLembretesPendentes = async (usuarioId) => {
  try {
    const lembretes = await prisma.kambaLembrete.findMany({
      where: {
        usuarioId,
        enviado: false,  // CORRIGIDO: campo correto
        dataHora: {      // CORRIGIDO: era 'agendadoPara', agora é 'dataHora'
          lte: new Date()
        }
      },
      orderBy: { 
        dataHora: 'asc'  // CORRIGIDO: era 'agendadoPara', agora é 'dataHora'
      },
      take: 3 // Máximo 3 lembretes por vez
    });

    return lembretes;
  } catch (err) {
    console.error('[LEMBRETE] Erro ao buscar:', err.message);
    return [];
  }
};

/**
 * Marca lembrete como enviado - CORRIGIDO
 */
const marcarLembreteEnviado = async (lembreteId) => {
  try {
    await prisma.kambaLembrete.update({
      where: { id: lembreteId },
      data: { 
        enviado: true  // CORRIGIDO: campo correto
      }
    });
  } catch (err) {
    console.error('[LEMBRETE] Erro ao marcar enviado:', err.message);
  }
};

/**
 * Marca lembrete como lido - NOVO
 */
const marcarLembreteLido = async (lembreteId) => {
  try {
    await prisma.kambaLembrete.update({
      where: { id: lembreteId },
      data: { 
        lido: true  // NOVO: marca como lido pelo usuário
      }
    });
  } catch (err) {
    console.error('[LEMBRETE] Erro ao marcar lido:', err.message);
  }
};

/**
 * Adiciona lembretes à resposta do Kamba
 */
const adicionarLembretesNaResposta = async (usuarioId, respostaOriginal) => {
  try {
    const lembretes = await buscarLembretesPendentes(usuarioId);
    
    if (lembretes.length === 0) {
      return respostaOriginal;
    }

    let respostaComLembretes = respostaOriginal + '\n\n---\n\n';
    
    for (const lembrete of lembretes) {
      respostaComLembretes += `🔔 **${lembrete.titulo}**\n${lembrete.mensagem}\n\n`;
      await marcarLembreteEnviado(lembrete.id);
    }

    return respostaComLembretes;
  } catch (err) {
    console.error('[LEMBRETE] Erro ao adicionar na resposta:', err.message);
    return respostaOriginal;
  }
};

/**
 * Cron Job - Executar análise diária
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

// ==========================================
// EXPORTAÇÕES
// ==========================================
module.exports = {
  analisarECriarLembretes,
  buscarLembretesPendentes,
  marcarLembreteEnviado,
  marcarLembreteLido,        // NOVO: exportado
  adicionarLembretesNaResposta,
  executarAnaliseDiaria,
  gerarDicaProativa
};