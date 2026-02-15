// src/services/notificacaoService.js
const { 
  emitirNotificacao, 
  emitirLembrete,
  emitirAlertaGasto,
  emitirProgressoObjetivo,
  isUsuarioOnline 
} = require('../websocket/socketConfig');

// Importa prisma localmente para evitar circular dependency
let prisma;
const getPrisma = () => {
  if (!prisma) {
    prisma = require('../lib/prisma');
  }
  return prisma;
};

// ==========================================
// SERVIÇO DE NOTIFICAÇÕES EM TEMPO REAL
// ==========================================

/**
 * Cria e envia notificação persistente + em tempo real
 */
const criarNotificacao = async (usuarioId, tipo, titulo, mensagem, dadosExtras = {}) => {
  try {
    const p = getPrisma();
    
    // Salva no banco usando o modelo existente NotificacaoPush
    const notificacao = await p.notificacaoPush.create({
      data: {
        usuarioId,
        tipo,
        titulo,
        corpo: mensagem,
        lida: false
      }
    });

    // Envia em tempo real se usuário estiver online
    const online = isUsuarioOnline(usuarioId);
    
    if (online) {
      emitirNotificacao(usuarioId, tipo, {
        id: notificacao.id,
        titulo,
        mensagem,
        ...dadosExtras,
        createdAt: notificacao.criadoEm
      });
    }

    return {
      ...notificacao,
      enviadoEmTempoReal: online
    };
  } catch (err) {
    console.error('[NOTIFICACAO] Erro ao criar:', err.message);
    // Não lança erro para não quebrar o fluxo principal
    return null;
  }
};

/**
 * Notifica sobre novo gasto registrado
 */
const notificarNovoGasto = async (usuarioId, gasto) => {
  return criarNotificacao(
    usuarioId,
    'NOVO_GASTO',
    '💸 Novo Gasto Registrado',
    `${gasto.descricao || 'Gasto'} de ${Number(gasto.valor).toLocaleString('pt-AO')} Kz`,
    {
      gastoId: gasto.id,
      valor: Number(gasto.valor),
      categoria: gasto.categoria?.nome,
      cartao: gasto.cartao?.nome
    }
  );
};

/**
 * Notifica sobre nova receita
 */
const notificarNovaReceita = async (usuarioId, receita) => {
  return criarNotificacao(
    usuarioId,
    'NOVA_RECEITA',
    '💰 Receita Registrada',
    `${receita.descricao || 'Receita'} de ${Number(receita.valor).toLocaleString('pt-AO')} Kz`,
    {
      receitaId: receita.id,
      valor: Number(receita.valor),
      cartao: receita.cartao?.nome
    }
  );
};

/**
 * Notifica alerta de gasto alto (acima de 80% da renda)
 */
const notificarGastoAlto = async (usuarioId, percentual, totalGasto) => {
  const notificacao = await criarNotificacao(
    usuarioId,
    'ALERTA_GASTO_ALTO',
    '⚠️ Alerta de Gasto Elevado',
    `Já gastaste ${percentual}% da tua renda este mês (${totalGasto.toLocaleString('pt-AO')} Kz)`,
    {
      percentual,
      totalGasto,
      acao: 'Controlar gastos'
    }
  );

  // Emite também via WebSocket para alerta imediato
  emitirAlertaGasto(usuarioId, {
    percentual,
    totalGasto,
    mensagem: `⚠️ Alerta, kamba! Já gastaste ${percentual}% da tua renda!`
  });

  return notificacao;
};

/**
 * Notifica sobre meta próxima do vencimento
 */
const notificarMetaProxima = async (usuarioId, objetivo, progresso) => {
  const notificacao = await criarNotificacao(
    usuarioId,
    'META_PROXIMA',
    '⏰ Meta Próxima do Vencimento',
    `"${objetivo.titulo}" vence em breve e está ${progresso}% completa`,
    {
      objetivoId: objetivo.id,
      titulo: objetivo.titulo,
      progresso,
      valorFaltante: Number(objetivo.valorAlvo) - Number(objetivo.valorAtual),
      dataPrevista: objetivo.dataPrevista
    }
  );

  emitirProgressoObjetivo(usuarioId, {
    objetivoId: objetivo.id,
    titulo: objetivo.titulo,
    progresso,
    tipo: 'proxima_vencimento'
  });

  return notificacao;
};

/**
 * Notifica progresso de objetivo atingido
 */
const notificarProgressoObjetivo = async (usuarioId, objetivo, progressoAnterior, progressoAtual) => {
  // Só notifica se cruzou uma marca importante (25%, 50%, 75%, 100%)
  const marcas = [25, 50, 75, 100];
  const marcaAtingida = marcas.find(m => progressoAnterior < m && progressoAtual >= m);

  if (!marcaAtingida) return null;

  const mensagens = {
    25: '🚀 Começaste bem! 25% da meta atingida',
    50: '⭐ Metade lá! 50% da meta concluída',
    75: '🔥 Quase lá! 75% da meta atingida',
    100: '🎉 PARABÉNS! Meta completamente atingida!'
  };

  const notificacao = await criarNotificacao(
    usuarioId,
    'PROGRESSO_META',
    mensagens[marcaAtingida],
    `"${objetivo.titulo}": ${Number(objetivo.valorAtual).toLocaleString('pt-AO')} Kz de ${Number(objetivo.valorAlvo).toLocaleString('pt-AO')} Kz`,
    {
      objetivoId: objetivo.id,
      titulo: objetivo.titulo,
      progresso: progressoAtual,
      marca: marcaAtingida
    }
  );

  emitirProgressoObjetivo(usuarioId, {
    objetivoId: objetivo.id,
    titulo: objetivo.titulo,
    progresso: progressoAtual,
    marca: marcaAtingida,
    tipo: 'progresso'
  });

  return notificacao;
};

/**
 * Notifica sobre fundo de emergência baixo
 */
const notificarFundoEmergenciaBaixo = async (usuarioId, mesesCobertos) => {
  return criarNotificacao(
    usuarioId,
    'FUNDO_EMERGENCIA_BAIXO',
    '🛡️ Fundo de Emergência Baixo',
    `Tua reserva cobre apenas ${mesesCobertos.toFixed(1)} meses. Ideal é 6 meses!`,
    {
      mesesCobertos,
      recomendado: 6,
      acao: 'Reforçar reserva'
    }
  );
};

/**
 * Notifica distribuição automática de poupança
 */
const notificarDistribuicaoPoupanca = async (usuarioId, valorTotal, distribuicoes) => {
  const resumo = distribuicoes.map(d => 
    `• ${d.titulo}: ${d.valor.toLocaleString('pt-AO')} Kz`
  ).join('\n');

  return criarNotificacao(
    usuarioId,
    'DISTRIBUICAO_POUPANCA',
    '💰 Poupança Distribuída Automaticamente',
    `${valorTotal.toLocaleString('pt-AO')} Kz distribuídos em ${distribuicoes.length} objetivos`,
    {
      valorTotal,
      distribuicoes,
      resumo
    }
  );
};

/**
 * Notifica atualização de saldo de cartão
 */
const notificarAtualizacaoSaldo = async (usuarioId, cartao, tipoTransacao, valor) => {
  const io = require('../websocket/socketConfig');
  
  io.emitirAtualizacaoSaldo(usuarioId, {
    cartaoId: cartao.id,
    nome: cartao.nome,
    tipo: tipoTransacao,
    valor: Number(valor),
    saldoAtual: Number(cartao.saldoAtual),
    saldoDisponivel: Number(cartao.saldoDisponivel),
    timestamp: new Date().toISOString()
  });

  // Também cria notificação persistente para histórico
  return criarNotificacao(
    usuarioId,
    'ATUALIZACAO_SALDO',
    tipoTransacao === 'RECEITA' ? '💰 Saldo Atualizado' : '💸 Saldo Atualizado',
    `${cartao.nome}: ${Number(cartao.saldoAtual).toLocaleString('pt-AO')} Kz`,
    {
      cartaoId: cartao.id,
      cartaoNome: cartao.nome,
      tipoTransacao,
      valor,
      saldoAtual: Number(cartao.saldoAtual)
    }
  );
};

/**
 * Marca notificação como lida
 */
const marcarComoLida = async (notificacaoId, usuarioId) => {
  try {
    const p = getPrisma();
    const notificacao = await p.notificacaoPush.updateMany({
      where: {
        id: notificacaoId,
        usuarioId
      },
      data: {
        lida: true
      }
    });

    return notificacao.count > 0;
  } catch (err) {
    console.error('[NOTIFICACAO] Erro ao marcar como lida:', err.message);
    return false;
  }
};

/**
 * Busca notificações não lidas do usuário
 */
const buscarNaoLidas = async (usuarioId, limite = 20) => {
  try {
    const p = getPrisma();
    return await p.notificacaoPush.findMany({
      where: {
        usuarioId,
        lida: false
      },
      orderBy: { criadoEm: 'desc' },
      take: limite
    });
  } catch (err) {
    console.error('[NOTIFICACAO] Erro ao buscar:', err.message);
    return [];
  }
};

/**
 * Busca histórico de notificações
 */
const buscarHistorico = async (usuarioId, { pagina = 1, limite = 20, apenasNaoLidas = false }) => {
  try {
    const p = getPrisma();
    const skip = (pagina - 1) * limite;
    
    const where = {
      usuarioId,
      ...(apenasNaoLidas && { lida: false })
    };

    const [notificacoes, total] = await Promise.all([
      p.notificacaoPush.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limite
      }),
      p.notificacaoPush.count({ where })
    ]);

    return {
      notificacoes,
      paginacao: {
        total,
        pagina,
        paginas: Math.ceil(total / limite),
        limite
      }
    };
  } catch (err) {
    console.error('[NOTIFICACAO] Erro ao buscar histórico:', err.message);
    return { notificacoes: [], paginacao: { total: 0, pagina: 1, paginas: 0, limite } };
  }
};

module.exports = {
  criarNotificacao,
  notificarNovoGasto,
  notificarNovaReceita,
  notificarGastoAlto,
  notificarMetaProxima,
  notificarProgressoObjetivo,
  notificarFundoEmergenciaBaixo,
  notificarDistribuicaoPoupanca,
  notificarAtualizacaoSaldo,
  marcarComoLida,
  buscarNaoLidas,
  buscarHistorico
};