// src/controllers/gastosController.js
const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { invalidarCacheUsuario } = require('../../insights/controllers/insightsController');
const NotificacaoService = require('../../users/services/notificacaoService');
const { sanitizeHtml } = require('../../../utils/sanitizer');
const { calcularNovosSaldos } = require('../../cartoes/services/saldoCartaoService');

const arredondarDinheiro = (valor) =>
  Math.round((Number(valor) + Number.EPSILON) * 100) / 100;

const distribuirPoolPorPesos = (objetivos, pool) => {
  const totalPesos = objetivos.reduce(
    (acc, objetivo) => acc + Number(objetivo.porcentagemDistribuicao || 0),
    0,
  );

  if (Math.abs(totalPesos - 100) > 0.01) {
    throw new AppError(
      'A soma das percentagens dos objetivos deve ser exactamente 100%',
      400,
    );
  }

  let acumulado = 0;
  return objetivos.map((objetivo, index) => {
    const peso = Number(objetivo.porcentagemDistribuicao || 0);
    const valor =
      index === objetivos.length - 1
        ? arredondarDinheiro(pool - acumulado)
        : arredondarDinheiro((pool * peso) / 100);
    acumulado += valor;
    return { objetivo, valor };
  });
};

/**
 * CRIAR NOVO GASTO / RECEITA (Versão Corrigida com WebSocket)
 */
const criarGasto = async (req, res, next) => {
  const {
    cartaoId,
    tipo,
    valor,
    descricao,
    categoriaId,
    data,
    local,
    parcelado,
    totalParcelas = 1,
    tags,
    objetivoId
  } = req.body;

  const usuarioId = req.user.id;

  // Validar enum
  if (!['DESPESA', 'RECEITA'].includes(tipo)) {
    return next(new AppError('Tipo deve ser DESPESA ou RECEITA', 400));
  }

  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0) {
    return next(new AppError('Valor inválido', 400));
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Validação do Cartão
      const cartao = await tx.cartao.findFirst({
        where: { id: cartaoId, usuarioId, ativo: true, excluido: false }
      });
      
      if (!cartao) throw new AppError('Cartão inválido ou inativo', 404);

// 1.1 Validação da Categoria (se fornecida)
      if (categoriaId) {
        const categoria = await tx.categoria.findFirst({
          where: {
            id: categoriaId,
            excluido: false,
            OR: [
              { usuarioId },
              { usuarioId: null, padrao: true }
            ]
          }
        });
        if (!categoria) throw new AppError('Categoria inválida', 400);
      }

      // 2. Verificação de Saldo para DESPESA
      if (tipo === 'DESPESA') {
        const disponivel = Number(cartao.saldoDisponivel);
        if (disponivel < valorNum) {
          throw new AppError(`Saldo disponível insuficiente no cartão ${cartao.nome}. Disponível: ${disponivel}`, 400);
        }
      }

      let distribuicaoAutomatica = false;
      let valorDistribuidoTotal = 0;
      let distribuicoes = [];
      const percentualPoupanca = Number(cartao.percentualDistribuicaoPoupanca || 0);

      // --- LÓGICA DE OBJETIVOS ---
      // A) Distribuição Automática (Receita + Cartão Configurado)
      if (tipo === 'RECEITA' && cartao.distribuirParaObjetivos && percentualPoupanca > 0) {
        const objetivos = await tx.objetivo.findMany({
          where: { 
            usuarioId, 
            excluido: false, 
            concluido: false, 
            porcentagemDistribuicao: { gt: 0 } 
          }
        });

        if (objetivos.length === 0) {
          throw new AppError(
            'A distribuição automática está activa, mas não existem objetivos configurados',
            400,
          );
        }

        const poolDistribuicao = arredondarDinheiro(
          (valorNum * percentualPoupanca) / 100,
        );
        const distribuicoesPool = distribuirPoolPorPesos(
          objetivos,
          poolDistribuicao,
        );

        distribuicaoAutomatica = true;

        for (const item of distribuicoesPool) {
          const { objetivo, valor } = item;
          const objetivoAtualizado = await tx.objetivo.update({
            where: { id: objetivo.id },
            data: { valorAtual: { increment: valor } }
          });

          valorDistribuidoTotal += valor;
          distribuicoes.push({
            objetivoId: objetivo.id,
            titulo: objetivo.titulo,
            porcentagem: Number(objetivo.porcentagemDistribuicao),
            valor,
            novoValorAtual: Number(objetivoAtualizado.valorAtual),
            valorAlvo: Number(objetivo.valorAlvo)
          });
        }

      }

      // B) Depósito Manual (Despesa direcionada a objetivo)
      if (tipo === 'DESPESA' && objetivoId) {
        const objetivoExistente = await tx.objetivo.findFirst({
          where: {
            id: objetivoId,
            usuarioId,
            excluido: false
          }
        });

        if (!objetivoExistente) {
          throw new AppError('Objetivo não encontrado', 404);
        }

        const objetivoAtualizado = await tx.objetivo.update({
          where: { id: objetivoId },
          data: { valorAtual: { increment: valorNum } }
        });

        // Verifica progresso para notificação
        const progressoAnterior = Math.round(((Number(objetivoAtualizado.valorAtual) - valorNum) / Number(objetivoAtualizado.valorAlvo)) * 100);
        const progressoAtual = Math.round((Number(objetivoAtualizado.valorAtual) / Number(objetivoAtualizado.valorAlvo)) * 100);
        
        // Adiciona às distribuições para notificação posterior
        distribuicoes.push({
          objetivoId: objetivoAtualizado.id,
          titulo: objetivoAtualizado.titulo,
          tipo: 'deposito_manual',
          valor: valorNum,
          progressoAnterior,
          progressoAtual
        });
      }

      // 3. Criação do Gasto
      const gasto = await tx.gasto.create({
        data: {
          tipo,
          valor: valorNum,
          descricao: descricao?.trim() || '',
          data: data ? new Date(data) : new Date(),
          local: local?.trim() || null,
          parcelado: !!parcelado,
          totalParcelas: parcelado ? parseInt(totalParcelas) : 1,
          parcelaAtual: 1,
          tags: tags || [],
          usuarioId,
          cartaoId,
          categoriaId,
          objetivoId: (tipo === 'DESPESA' && objetivoId) ? objetivoId : null,
          distribuicaoAutomatica, // NOVO: Flag para rastrear
          percentualDistribuicaoPoupanca: distribuicaoAutomatica
            ? percentualPoupanca
            : 0,
          valorDistribuidoPoupanca: valorDistribuidoTotal
        },
        include: {
          categoria: { select: { nome: true, icone: true } },
          cartao: { select: { nome: true, saldoAtual: true, saldoDisponivel: true } },
          objetivo: { select: { titulo: true } }
        }
      });

      // 4. Atualização de Saldo do Cartão
      // Regra única por tipo de cartão (F-005): no CREDITO, DESPESA aumenta a
      // dívida e RECEITA é pagamento — já não diverge de atualizarSaldo.
      const novosSaldos = calcularNovosSaldos(
        cartao,
        tipo,
        valorNum,
        distribuicaoAutomatica ? valorDistribuidoTotal : 0,
      );

      const cartaoAtualizado = await tx.cartao.update({
        where: { id: cartaoId },
        data: novosSaldos
      });

      return {
        gasto,
        cartao: cartaoAtualizado,
        distribuicaoAutomatica,
        valorDistribuidoTotal,
        distribuicoes
      };
    });

    // ==========================================
    // NOTIFICAÇÕES EM TEMPO REAL (fora da transação)
    // ==========================================

    // 1. Notificar novo gasto/receita
    if (tipo === 'DESPESA') {
      await NotificacaoService.notificarNovoGasto(usuarioId, resultado.gasto);
    } else {
      await NotificacaoService.notificarNovaReceita(usuarioId, resultado.gasto);
    }

    // 2. Notificar atualização de saldo do cartão
    await NotificacaoService.notificarAtualizacaoSaldo(
      usuarioId,
      resultado.cartao,
      tipo,
      valorNum
    );

    // 3. Notificar distribuição automática de poupança
    if (resultado.distribuicaoAutomatica && resultado.distribuicoes.length > 0) {
      await NotificacaoService.notificarDistribuicaoPoupanca(
        usuarioId,
        resultado.valorDistribuidoTotal,
        resultado.distribuicoes
      );
    }

    // 4. Notificar progresso de objetivos (para depósitos manuais)
    for (const dist of resultado.distribuicoes) {
      if (dist.tipo === 'deposito_manual' || resultado.distribuicaoAutomatica) {
        // Busca objetivo atualizado para calcular progresso
        const objetivo = await prisma.objetivo.findUnique({
          where: { id: dist.objetivoId }
        });

        if (objetivo) {
          const progressoAtual = Math.round((Number(objetivo.valorAtual) / Number(objetivo.valorAlvo)) * 100);
          const progressoAnterior = dist.progressoAnterior || Math.max(0, progressoAtual - Math.round((dist.valor / Number(objetivo.valorAlvo)) * 100));
          
          await NotificacaoService.notificarProgressoObjetivo(
            usuarioId,
            objetivo,
            progressoAnterior,
            progressoAtual
          );
        }
      }
    }

    // 5. Verificar alerta de gasto alto (se for despesa)
    if (tipo === 'DESPESA') {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      
      const [totalMes, user] = await Promise.all([
        prisma.gasto.aggregate({
          _sum: { valor: true },
          where: {
            usuarioId,
            tipo: 'DESPESA',
            data: { gte: inicioMes },
            excluido: false
          }
        }),
        prisma.user.findUnique({
          where: { id: usuarioId },
          select: { rendaMensalMedia: true }
        })
      ]);

      const totalGasto = Number(totalMes._sum.valor) || 0;
      const percentual = user.rendaMensalMedia > 0 
        ? Math.round((totalGasto / Number(user.rendaMensalMedia)) * 100) 
        : 0;

      if (percentual >= 80) {
        await NotificacaoService.notificarGastoAlto(usuarioId, percentual, totalGasto);
      }
    }

    await invalidarCacheUsuario(usuarioId);

    res.status(201).json({ 
      success: true, 
      message: resultado.distribuicaoAutomatica 
        ? 'Receita registrada e distribuída automaticamente!' 
        : 'Transação registrada!',
      data: {
        ...resultado.gasto,
        valor: Number(resultado.gasto.valor),
        distribuicaoAutomatica: resultado.distribuicaoAutomatica,
        distribuicoes: resultado.distribuicoes
      }
    });

  } catch (err) { 
    next(err); 
  }
};

/**
 * LISTAR GASTOS (Com paginação)
 */
const listarGastos = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { pagina = 1, limite = 20, tipo, categoriaId, cartaoId, objetivoId, dataInicio, dataFim } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const where = {
      usuarioId,
      excluido: false,
      ...(tipo && { tipo }),
      ...(categoriaId && { categoriaId }),
      ...(cartaoId && { cartaoId }),
      ...(objetivoId && { objetivoId }),
      ...(dataInicio && dataFim && {
        data: {
          gte: new Date(dataInicio),
          lte: new Date(dataFim)
        }
      })
    };

    const [gastos, total] = await Promise.all([
      prisma.gasto.findMany({
        where,
        skip,
        take: parseInt(limite),
        include: {
          categoria: { select: { nome: true, cor: true, icone: true } },
          cartao: { select: { nome: true, banco: true, cor: true } },
          objetivo: { select: { titulo: true } }
        },
        orderBy: { data: 'desc' }
      }),
      prisma.gasto.count({ where })
    ]);

      // Converter Decimal para Number na resposta
    const gastosFormatados = gastos.map(g => ({
      ...g,
      valor: Number(g.valor),
      descricao: g.descricao ? sanitizeHtml(g.descricao) : '',
      local: g.local ? sanitizeHtml(g.local) : null
    }));

    res.json({
      success: true,
      paginacao: { 
        total, 
        pagina: parseInt(pagina), 
        paginas: Math.ceil(total / parseInt(limite)) 
      },
      gastos: gastosFormatados
    });
  } catch (err) { 
    next(err); 
  }
};

/**
 * GASTOS POR CATEGORIA
 */
const gastosPorCategoria = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { dataInicio, dataFim } = req.query;
    
    const where = {
      usuarioId, 
      tipo: 'DESPESA', 
      excluido: false,
      ...(dataInicio && dataFim && {
        data: {
          gte: new Date(dataInicio),
          lte: new Date(dataFim)
        }
      })
    };
    
    const stats = await prisma.gasto.groupBy({
      by: ['categoriaId'],
      where,
      _sum: { valor: true },
      _count: { id: true }
    });

    const categoriasIds = stats.map(s => s.categoriaId);
    const categorias = await prisma.categoria.findMany({
      where: { id: { in: categoriasIds } }
    });

    const totalGeral = stats.reduce((acc, s) => acc + Number(s._sum.valor || 0), 0);

    const resultado = stats.map(s => ({
      categoriaId: s.categoriaId,
      total: Number(s._sum.valor) || 0,
      quantidade: s._count.id,
      categoria: categorias.find(c => c.id === s.categoriaId)?.nome || 'Outros',
      cor: categorias.find(c => c.id === s.categoriaId)?.cor || '#9E9E9E',
      porcentagem: totalGeral > 0 ? Math.round((Number(s._sum.valor || 0) / totalGeral) * 100) : 0
    })).sort((a, b) => b.total - a.total);

    res.json({ 
      success: true, 
      totalGeral,
      data: resultado 
    });
  } catch (err) { 
    next(err); 
  }
};

/**
 * DELETAR GASTO (CORREÇÃO CRÍTICA: Estorno de distribuição automática + Notificações)
 */
const deletarGasto = async (req, res, next) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // Buscar gasto com relacionamentos necessários
      const gasto = await tx.gasto.findFirst({ 
        where: { id, usuarioId, excluido: false },
        include: { 
          cartao: true,
          objetivo: true
        }
      });
      
      if (!gasto) throw new AppError('Transação não encontrada', 404);

      const cartao = gasto.cartao;
      const valor = Number(gasto.valor);
      const tipo = gasto.tipo;
      const valorDistribuidoAutomatica = Number(gasto.valorDistribuidoPoupanca || 0);

      // Array de operações para Promise.all (independentes entre si)
      const operacoes = [];
      const notificacoesReverter = [];

      // 1. Reverter saldo do cartão
      let ajusteSaldo = 0;
      let ajusteReservado = 0;
      let ajusteDisponivel = 0;

      if (tipo === 'DESPESA') {
        // Estornar despesa: volta o dinheiro
        ajusteSaldo = valor;
        ajusteDisponivel = valor;
        
        // Se era depósito manual em objetivo, reverter
        if (gasto.objetivoId) {
          operacoes.push(
            tx.objetivo.update({
              where: { id: gasto.objetivoId },
              data: { valorAtual: { decrement: valor } }
            })
          );
          
          notificacoesReverter.push({
            tipo: 'objetivo',
            objetivoId: gasto.objetivoId,
            valor: -valor
          });
        }
      } else {
        // Estornar receita: tira o dinheiro
        ajusteSaldo = -valor;
        
        // CORREÇÃO CRÍTICA: Se tinha distribuição automática, reverter dos objetivos
        if (gasto.distribuicaoAutomatica && valorDistribuidoAutomatica > 0) {
          const objetivos = await tx.objetivo.findMany({
            where: { 
              usuarioId, 
              excluido: false, 
              porcentagemDistribuicao: { gt: 0 } 
            }
          });

          let totalRevertido = 0;
          const distribuicoesPool = distribuirPoolPorPesos(
            objetivos,
            valorDistribuidoAutomatica,
          );

          for (const item of distribuicoesPool) {
            const { objetivo, valor: valorFatiado } = item;
            if (valorFatiado > 0) {
              operacoes.push(
                tx.objetivo.update({
                  where: { id: objetivo.id },
                  data: { valorAtual: { decrement: valorFatiado } }
                })
              );
              totalRevertido += valorFatiado;

              notificacoesReverter.push({
                tipo: 'objetivo',
                objetivoId: objetivo.id,
                valor: -valorFatiado
              });
            }
          }

          // Diminuir o reservado (libera o comprometido)
          ajusteReservado = -totalRevertido;
          // Disponível diminui junto com o saldo, mas o reservado também diminui
          // Net effect: disponivel fica igual (perde saldo mas ganha reserva)
          ajusteDisponivel = -valor + totalRevertido; 
        } else {
          ajusteDisponivel = -valor;
        }
      }

      // Atualizar cartão
      operacoes.push(
        tx.cartao.update({
          where: { id: gasto.cartaoId },
          data: { 
            saldoAtual: { increment: ajusteSaldo },
            saldoDisponivel: { increment: ajusteDisponivel },
            saldoReservado: { increment: ajusteReservado }
          }
        })
      );

      // Soft delete do gasto
      operacoes.push(
        tx.gasto.update({ 
          where: { id }, 
          data: { excluido: true } 
        })
      );

      await Promise.all(operacoes);

      // Buscar cartão atualizado para notificação
      const cartaoAtualizado = await tx.cartao.findUnique({
        where: { id: gasto.cartaoId }
      });

      return {
        gasto,
        cartao: cartaoAtualizado,
        tipoReverso: tipo === 'DESPESA' ? 'RECEITA' : 'DESPESA',
        valorReverso: valor,
        notificacoesReverter
      };
    });

    // ==========================================
    // NOTIFICAÇÕES DE ESTORNO (fora da transação)
    // ==========================================

    // 1. Notificar estorno de saldo
    await NotificacaoService.notificarAtualizacaoSaldo(
      usuarioId,
      resultado.cartao,
      resultado.tipoReverso,
      resultado.valorReverso
    );

    // 2. Notificar reversão de objetivos
    for (const notif of resultado.notificacoesReverter) {
      if (notif.tipo === 'objetivo') {
        const objetivo = await prisma.objetivo.findUnique({
          where: { id: notif.objetivoId }
        });
        
        if (objetivo) {
          await NotificacaoService.criarNotificacao(
            usuarioId,
            'REVERSAO_OBJETIVO',
            '↩️ Contribuição Revertida',
            `A contribuição de ${Math.abs(notif.valor).toLocaleString('pt-AO')} Kz para "${objetivo.titulo}" foi revertida`,
            {
              objetivoId: objetivo.id,
              valorRevertido: Math.abs(notif.valor),
              novoValorAtual: Number(objetivo.valorAtual)
            }
          );
        }
      }
    }

    // 3. Notificar exclusão da transação
    await NotificacaoService.criarNotificacao(
      usuarioId,
      'TRANSACAO_REMOVIDA',
      '🗑️ Transação Removida',
      `${resultado.gasto.descricao || 'Transação'} de ${Number(resultado.gasto.valor).toLocaleString('pt-AO')} Kz foi removida`,
      {
        gastoId: resultado.gasto.id,
        valor: Number(resultado.gasto.valor),
        tipo: resultado.gasto.tipo
      }
    );

    await invalidarCacheUsuario(usuarioId);
    
    res.json({ 
      success: true, 
      message: 'Transação removida e valores estornados.',
      data: {
        estornado: true,
        tipo: resultado.gasto.tipo,
        valor: Number(resultado.gasto.valor)
      }
    });
    
  } catch (err) { 
    next(err); 
  }
};

/**
 * DASHBOARD STATS (Otimizado para Decimal)
 */
const dashboardStats = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    // Usando aggregate em vez de queryRaw para melhor type safety
    const [despesasAgg, receitasAgg] = await Promise.all([
      prisma.gasto.aggregate({
        where: {
          usuarioId,
          tipo: 'DESPESA',
          excluido: false,
          data: { gte: inicioMes }
        },
        _sum: { valor: true },
        _count: { id: true }
      }),
      prisma.gasto.aggregate({
        where: {
          usuarioId,
          tipo: 'RECEITA',
          excluido: false,
          data: { gte: inicioMes }
        },
        _sum: { valor: true },
        _count: { id: true }
      })
    ]);

    const despesas = Number(despesasAgg._sum.valor) || 0;
    const receitas = Number(receitasAgg._sum.valor) || 0;

    res.json({
      success: true,
      valores: {
        despesas,
        receitas,
        saldo: receitas - despesas,
        quantidadeDespesas: despesasAgg._count.id,
        quantidadeReceitas: receitasAgg._count.id
      }
    });
  } catch (err) { 
    next(err); 
  }
};

/**
 * ATUALIZAR GASTO (NOVO - para edição de transações)
 */
const atualizarGasto = async (req, res, next) => {
  const { id } = req.params;
  const { descricao, categoriaId, data, local, tags } = req.body;
  const usuarioId = req.user.id;

  try {
    const gastoExistente = await prisma.gasto.findFirst({
      where: { id, usuarioId, excluido: false }
    });

    if (!gastoExistente) {
      return next(new AppError('Transação não encontrada', 404));
    }

    const dadosAtualizacao = {};

    if (categoriaId !== undefined) {
      if (categoriaId === null || categoriaId === '') {
        dadosAtualizacao.categoriaId = null;
      } else {
        const categoriaValida = await prisma.categoria.findFirst({
          where: {
            id: categoriaId,
            excluido: false,
            OR: [{ usuarioId }, { usuarioId: null, padrao: true }]
          }
        });

        if (!categoriaValida) {
          return next(new AppError('Categoria inválida', 400));
        }

        dadosAtualizacao.categoriaId = categoriaId;
      }
    }
    if (descricao !== undefined) dadosAtualizacao.descricao = descricao.trim();
    if (data !== undefined) dadosAtualizacao.data = new Date(data);
    if (local !== undefined) {
      dadosAtualizacao.local = typeof local === 'string' ? local.trim() : local;
    }
    if (tags !== undefined) dadosAtualizacao.tags = Array.isArray(tags) ? tags : [];

    const gastoAtualizado = await prisma.gasto.update({
      where: { id },
      data: dadosAtualizacao,
      include: {
        categoria: { select: { nome: true, cor: true, icone: true } },
        cartao: { select: { nome: true } }
      }
    });

    // Notificar atualização
    await NotificacaoService.criarNotificacao(
      usuarioId,
      'TRANSACAO_ATUALIZADA',
      '✏️ Transação Atualizada',
      `${gastoAtualizado.descricao || 'Transação'} modificada`,
      {
        gastoId: gastoAtualizado.id,
        camposAlterados: Object.keys(dadosAtualizacao)
      }
    );

    await invalidarCacheUsuario(usuarioId);

    res.json({
      success: true,
      message: 'Transação atualizada com sucesso',
      data: {
        ...gastoAtualizado,
        valor: Number(gastoAtualizado.valor)
      }
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  criarGasto,
  listarGastos,
  gastosPorCategoria,
  deletarGasto,
  dashboardStats,
  atualizarGasto // NOVO
};
