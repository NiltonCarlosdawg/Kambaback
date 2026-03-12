// src/controllers/fundoEmergenciaController.js
const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { invalidarCacheUsuario } = require('../../insights/controllers/insightsController');
const NotificacaoService = require('../../users/services/notificacaoService');

// ==========================================
// CONSTANTES
// ==========================================
const DEPOSITO_MINIMO_ATIVACAO = 100000; // 100.000 Kz
const MESES_RECOMENDADOS = 6;

// ==========================================
// HELPERS
// ==========================================

/**
 * Calcula métricas do fundo com base nos dados actuais
 */
const calcularMetricas = async (usuarioId, saldoAtual) => {
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

  const despesasAgg = await prisma.gasto.aggregate({
    _sum: { valor: true },
    where: {
      usuarioId,
      tipo: 'DESPESA',
      excluido: false,
      data: { gte: seisMesesAtras }
    }
  });

  const totalDespesas = Number(despesasAgg._sum.valor) || 0;
  const despesaMediaMensal = totalDespesas / 6;
  const alvoEmergencia = despesaMediaMensal * MESES_RECOMENDADOS;
  const mesesCobertos = despesaMediaMensal > 0
    ? saldoAtual / despesaMediaMensal
    : 0;
  const percentualAtingido = alvoEmergencia > 0
    ? Math.min(100, Math.round((saldoAtual / alvoEmergencia) * 100))
    : 0;

  return {
    despesaMediaMensal,
    alvoEmergencia,
    mesesCobertos: parseFloat(mesesCobertos.toFixed(1)),
    percentualAtingido,
    mesesRecomendados: MESES_RECOMENDADOS
  };
};

// ==========================================
// OBTER STATUS DO FUNDO
// ==========================================

/**
 * GET /fundo-emergencia
 * Retorna o cartão de fundo de emergência do usuário (se existir) e as métricas.
 */
const obterFundo = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;

    const fundo = await prisma.cartao.findFirst({
      where: {
        usuarioId,
        isFundoEmergencia: true,
        excluido: false
      }
    });

    if (!fundo) {
      return res.json({
        success: true,
        existe: false,
        ativo: false,
        mensagem: 'Nenhum fundo de emergência configurado.',
        depositoMinimoAtivacao: DEPOSITO_MINIMO_ATIVACAO
      });
    }

    const saldo = Number(fundo.saldoAtual);
    const metricas = await calcularMetricas(usuarioId, saldo);

    res.json({
      success: true,
      existe: true,
      ativo: fundo.fundoAtivo,
      fundo: {
        id: fundo.id,
        nome: fundo.nome,
        saldoAtual: saldo,
        saldoDisponivel: Number(fundo.saldoDisponivel),
        cor: fundo.cor,
        icone: fundo.icone,
        criadoEm: fundo.criadoEm
      },
      metricas,
      depositoMinimoAtivacao: DEPOSITO_MINIMO_ATIVACAO
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// CRIAR FUNDO (sem activar ainda)
// ==========================================

/**
 * POST /fundo-emergencia
 * Cria o cartão de fundo de emergência como INACTIVO.
 * Só pode existir um por utilizador.
 */
const criarFundo = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { nome = 'Fundo de Emergência', cor = '#f59e0b', icone = 'shield' } = req.body;

    // Garante unicidade
    const jaExiste = await prisma.cartao.findFirst({
      where: { usuarioId, isFundoEmergencia: true, excluido: false }
    });

    if (jaExiste) {
      return next(new AppError('Já existe um fundo de emergência. Só pode ter um.', 409));
    }

    const fundo = await prisma.cartao.create({
      data: {
        usuarioId,
        nome: nome.trim(),
        tipo: 'POUPANCA',
        banco: 'Fundo Interno',
        saldoAtual: 0,
        saldoDisponivel: 0,
        saldoReservado: 0,
        limiteCredito: 0,
        cor,
        icone,
        isFundoEmergencia: true,
        fundoAtivo: false,        // inactivo até ao primeiro depósito
        distribuirParaObjetivos: false,
        ativo: true,
        excluido: false
      }
    });

    await NotificacaoService.criarNotificacao(
      usuarioId,
      'FUNDO_CRIADO',
      '🛡️ Fundo de Emergência Criado',
      `O teu fundo foi criado! Deposita pelo menos ${DEPOSITO_MINIMO_ATIVACAO.toLocaleString('pt-AO')} Kz para o activar.`,
      { fundoId: fundo.id }
    );

    res.status(201).json({
      success: true,
      message: `Fundo criado! Deposita pelo menos ${DEPOSITO_MINIMO_ATIVACAO.toLocaleString('pt-AO')} Kz para activar.`,
      fundo: {
        id: fundo.id,
        nome: fundo.nome,
        ativo: fundo.fundoAtivo,
        saldoAtual: 0
      },
      depositoMinimoAtivacao: DEPOSITO_MINIMO_ATIVACAO
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// DEPOSITAR NO FUNDO
// ==========================================

/**
 * POST /fundo-emergencia/depositar
 * Deposita um valor no fundo.
 * Se o saldo resultante >= 100.000 Kz e o fundo estava inactivo, activa-o automaticamente.
 * Requer: { cartaoOrigemId, valor }
 */
const depositar = async (req, res, next) => {
  const { cartaoOrigemId, valor } = req.body;
  const usuarioId = req.user.id;

  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0) {
    return next(new AppError('Valor inválido', 400));
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Buscar fundo
      const fundo = await tx.cartao.findFirst({
        where: { usuarioId, isFundoEmergencia: true, excluido: false }
      });

      if (!fundo) {
        throw new AppError('Fundo de emergência não encontrado. Cria um primeiro.', 404);
      }

      // 2. Buscar cartão de origem
      const cartaoOrigem = await tx.cartao.findFirst({
        where: { id: cartaoOrigemId, usuarioId, ativo: true, excluido: false }
      });

      if (!cartaoOrigem) {
        throw new AppError('Cartão de origem não encontrado ou inactivo', 404);
      }

      // 3. Verificar saldo disponível na origem
      const disponivelOrigem = Number(cartaoOrigem.saldoDisponivel);
      if (disponivelOrigem < valorNum) {
        throw new AppError(
          `Saldo insuficiente no cartão "${cartaoOrigem.nome}". Disponível: ${disponivelOrigem.toLocaleString('pt-AO')} Kz`,
          400
        );
      }

      // 4. Debitar da origem
      await tx.cartao.update({
        where: { id: cartaoOrigemId },
        data: {
          saldoAtual: { decrement: valorNum },
          saldoDisponivel: { decrement: valorNum }
        }
      });

      // Registar a saída como gasto na origem
      const categoriaEmergencia = await tx.categoria.findFirst({
        where: {
          OR: [
            { usuarioId, nome: { contains: 'Poupança', mode: 'insensitive' }, excluido: false },
            { padrao: true, nome: { contains: 'Poupança', mode: 'insensitive' }, excluido: false }
          ]
        }
      }) || await tx.categoria.findFirst({
        where: { padrao: true, excluido: false }
      });

      if (!categoriaEmergencia) {
        throw new AppError('Nenhuma categoria disponível. Cria uma categoria primeiro.', 400);
      }

      await tx.gasto.create({
        data: {
          tipo: 'DESPESA',
          valor: valorNum,
          descricao: `Depósito no Fundo de Emergência`,
          data: new Date(),
          usuarioId,
          cartaoId: cartaoOrigemId,
          categoriaId: categoriaEmergencia.id,
          tags: ['fundo-emergencia', 'poupanca']
        }
      });

      // 5. Creditar no fundo
      const novoSaldoFundo = Number(fundo.saldoAtual) + valorNum;

      // Lógica de activação automática
      const deveActivar = !fundo.fundoAtivo && novoSaldoFundo >= DEPOSITO_MINIMO_ATIVACAO;
      const jaEstaAtivo = fundo.fundoAtivo;

      const fundoAtualizado = await tx.cartao.update({
        where: { id: fundo.id },
        data: {
          saldoAtual: novoSaldoFundo,
          saldoDisponivel: novoSaldoFundo,
          fundoAtivo: deveActivar ? true : jaEstaAtivo
        }
      });

      return {
        fundo: fundoAtualizado,
        cartaoOrigem: { id: cartaoOrigem.id, nome: cartaoOrigem.nome },
        valorDepositado: valorNum,
        novoSaldo: novoSaldoFundo,
        acabouDeActivar: deveActivar
      };
    });

    await invalidarCacheUsuario(usuarioId);

    // Notificações fora da transação
    if (resultado.acabouDeActivar) {
      await NotificacaoService.criarNotificacao(
        usuarioId,
        'FUNDO_ACTIVADO',
        '🎉 Fundo de Emergência Activado!',
        `Parabéns, kamba! O teu fundo foi activado com ${resultado.novoSaldo.toLocaleString('pt-AO')} Kz. Continua a reforçar!`,
        { fundoId: resultado.fundo.id, saldo: resultado.novoSaldo }
      );
    } else {
      await NotificacaoService.criarNotificacao(
        usuarioId,
        'FUNDO_DEPOSITO',
        '🛡️ Depósito no Fundo',
        `${valorNum.toLocaleString('pt-AO')} Kz adicionados ao fundo de emergência.`,
        { fundoId: resultado.fundo.id, saldo: resultado.novoSaldo }
      );
    }

    const metricas = await calcularMetricas(usuarioId, resultado.novoSaldo);

    res.json({
      success: true,
      message: resultado.acabouDeActivar
        ? `🎉 Fundo activado! Depositaste ${valorNum.toLocaleString('pt-AO')} Kz.`
        : `✅ ${valorNum.toLocaleString('pt-AO')} Kz depositados no fundo.`,
      fundoActivo: resultado.fundo.fundoAtivo,
      acabouDeActivar: resultado.acabouDeActivar,
      saldoAtual: resultado.novoSaldo,
      metricas,
      // Alerta se ainda não atingiu o mínimo para activar
      ...(!resultado.fundo.fundoAtivo && {
        avisoActivacao: `Faltam ${(DEPOSITO_MINIMO_ATIVACAO - resultado.novoSaldo).toLocaleString('pt-AO')} Kz para activar o fundo.`
      })
    });
  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Erro ao depositar no fundo', 500));
  }
};

// ==========================================
// LEVANTAR DO FUNDO
// ==========================================

/**
 * POST /fundo-emergencia/levantar
 * Levanta um valor do fundo para um cartão de destino.
 * Se o saldo cair abaixo de 100.000 Kz, o fundo é automaticamente desactivado.
 * Requer: { cartaoDestinoId, valor, motivo? }
 */
const levantar = async (req, res, next) => {
  const { cartaoDestinoId, valor, motivo } = req.body;
  const usuarioId = req.user.id;

  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0) {
    return next(new AppError('Valor inválido', 400));
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Buscar fundo
      const fundo = await tx.cartao.findFirst({
        where: { usuarioId, isFundoEmergencia: true, excluido: false }
      });

      if (!fundo) {
        throw new AppError('Fundo de emergência não encontrado', 404);
      }

      if (!fundo.fundoAtivo) {
        throw new AppError('O fundo de emergência não está activo', 400);
      }

      const saldoFundo = Number(fundo.saldoAtual);
      if (saldoFundo < valorNum) {
        throw new AppError(
          `Saldo insuficiente no fundo. Disponível: ${saldoFundo.toLocaleString('pt-AO')} Kz`,
          400
        );
      }

      // 2. Buscar cartão destino
      const cartaoDestino = await tx.cartao.findFirst({
        where: { id: cartaoDestinoId, usuarioId, ativo: true, excluido: false }
      });

      if (!cartaoDestino) {
        throw new AppError('Cartão de destino não encontrado', 404);
      }

      // 3. Debitar do fundo
      const novoSaldoFundo = saldoFundo - valorNum;
      const deveDesactivar = novoSaldoFundo < DEPOSITO_MINIMO_ATIVACAO;

      const fundoAtualizado = await tx.cartao.update({
        where: { id: fundo.id },
        data: {
          saldoAtual: novoSaldoFundo,
          saldoDisponivel: novoSaldoFundo,
          fundoAtivo: deveDesactivar ? false : true
        }
      });

      // Registar saída do fundo como gasto
      const categoria = await tx.categoria.findFirst({
        where: {
          OR: [
            { usuarioId, excluido: false },
            { padrao: true, excluido: false }
          ]
        }
      });

      await tx.gasto.create({
        data: {
          tipo: 'DESPESA',
          valor: valorNum,
          descricao: motivo?.trim() || 'Levantamento do Fundo de Emergência',
          data: new Date(),
          usuarioId,
          cartaoId: fundo.id,
          categoriaId: categoria.id,
          tags: ['fundo-emergencia', 'levantamento']
        }
      });

      // 4. Creditar no destino
      await tx.cartao.update({
        where: { id: cartaoDestinoId },
        data: {
          saldoAtual: { increment: valorNum },
          saldoDisponivel: { increment: valorNum }
        }
      });

      // Registar entrada no destino como receita
      await tx.gasto.create({
        data: {
          tipo: 'RECEITA',
          valor: valorNum,
          descricao: motivo?.trim() || 'Transferência do Fundo de Emergência',
          data: new Date(),
          usuarioId,
          cartaoId: cartaoDestinoId,
          categoriaId: categoria.id,
          tags: ['fundo-emergencia', 'levantamento']
        }
      });

      return {
        fundo: fundoAtualizado,
        novoSaldoFundo,
        valorLevantado: valorNum,
        desactivou: deveDesactivar,
        cartaoDestino: { id: cartaoDestino.id, nome: cartaoDestino.nome }
      };
    });

    await invalidarCacheUsuario(usuarioId);

    // Notificações
    if (resultado.desactivou) {
      await NotificacaoService.criarNotificacao(
        usuarioId,
        'FUNDO_DESACTIVADO',
        '⚠️ Fundo de Emergência Desactivado',
        `O saldo caiu abaixo de ${DEPOSITO_MINIMO_ATIVACAO.toLocaleString('pt-AO')} Kz. Deposita para o reactivar.`,
        { fundoId: resultado.fundo.id, saldoActual: resultado.novoSaldoFundo }
      );
    }

    const metricas = await calcularMetricas(usuarioId, resultado.novoSaldoFundo);

    res.json({
      success: true,
      message: resultado.desactivou
        ? `⚠️ ${valorNum.toLocaleString('pt-AO')} Kz levantados. Fundo desactivado (saldo abaixo do mínimo).`
        : `✅ ${valorNum.toLocaleString('pt-AO')} Kz transferidos para "${resultado.cartaoDestino.nome}".`,
      fundoActivo: resultado.fundo.fundoAtivo,
      desactivou: resultado.desactivou,
      saldoAtual: resultado.novoSaldoFundo,
      metricas,
      depositoMinimoReactivacao: resultado.desactivou ? DEPOSITO_MINIMO_ATIVACAO : undefined
    });
  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Erro ao levantar do fundo', 500));
  }
};

// ==========================================
// DESACTIVAR MANUALMENTE
// ==========================================

/**
 * PATCH /fundo-emergencia/desactivar
 * Permite ao utilizador desactivar o fundo manualmente.
 * Não move o saldo — apenas marca como inactivo.
 */
const desativar = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;

    const fundo = await prisma.cartao.findFirst({
      where: { usuarioId, isFundoEmergencia: true, excluido: false }
    });

    if (!fundo) {
      return next(new AppError('Fundo de emergência não encontrado', 404));
    }

    if (!fundo.fundoAtivo) {
      return next(new AppError('O fundo já está inactivo', 400));
    }

    await prisma.cartao.update({
      where: { id: fundo.id },
      data: { fundoAtivo: false }
    });

    await NotificacaoService.criarNotificacao(
      usuarioId,
      'FUNDO_DESACTIVADO_MANUAL',
      '⏸️ Fundo de Emergência Pausado',
      `O fundo foi desactivado manualmente. O saldo de ${Number(fundo.saldoAtual).toLocaleString('pt-AO')} Kz mantém-se guardado.`,
      { fundoId: fundo.id }
    );

    res.json({
      success: true,
      message: 'Fundo desactivado. O teu saldo está mantido.',
      saldoMantido: Number(fundo.saldoAtual),
      comoReactivar: `Deposita pelo menos ${DEPOSITO_MINIMO_ATIVACAO.toLocaleString('pt-AO')} Kz para reactivar.`
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// HISTÓRICO DE MOVIMENTOS DO FUNDO
// ==========================================

/**
 * GET /fundo-emergencia/historico
 * Lista os depósitos e levantamentos do fundo.
 */
const historico = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { pagina = 1, limite = 20 } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const fundo = await prisma.cartao.findFirst({
      where: { usuarioId, isFundoEmergencia: true, excluido: false }
    });

    if (!fundo) {
      return res.json({
        success: true,
        existe: false,
        movimentos: [],
        paginacao: { total: 0, pagina: 1, paginas: 0 }
      });
    }

    // Gastos que saíram DO fundo (levantamentos)
    // + Gastos cujas tags contêm 'fundo-emergencia' no cartão de origem (depósitos)
    const [movimentos, total] = await Promise.all([
      prisma.gasto.findMany({
        where: {
          usuarioId,
          excluido: false,
          OR: [
            { cartaoId: fundo.id },                          // saídas do fundo
            { tags: { has: 'fundo-emergencia' },            // entradas registadas
              cartaoId: { not: fundo.id } }
          ]
        },
        include: {
          cartao: { select: { nome: true } },
          categoria: { select: { nome: true } }
        },
        orderBy: { data: 'desc' },
        skip,
        take: parseInt(limite)
      }),
      prisma.gasto.count({
        where: {
          usuarioId,
          excluido: false,
          OR: [
            { cartaoId: fundo.id },
            { tags: { has: 'fundo-emergencia' }, cartaoId: { not: fundo.id } }
          ]
        }
      })
    ]);

    const movimentosFormatados = movimentos.map(m => ({
      id: m.id,
      tipo: m.cartaoId === fundo.id ? 'LEVANTAMENTO' : 'DEPOSITO',
      valor: Number(m.valor),
      descricao: m.descricao,
      data: m.data,
      cartao: m.cartao?.nome
    }));

    res.json({
      success: true,
      existe: true,
      fundoActivo: fundo.fundoAtivo,
      saldoAtual: Number(fundo.saldoAtual),
      movimentos: movimentosFormatados,
      paginacao: {
        total,
        pagina: parseInt(pagina),
        paginas: Math.ceil(total / parseInt(limite))
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  obterFundo,
  criarFundo,
  depositar,
  levantar,
  desativar,
  historico
};