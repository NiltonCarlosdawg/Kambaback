// src/controllers/gastosController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');
const { invalidarCacheUsuario } = require('./insightsController');

/**
 * CRIAR NOVO GASTO / RECEITA (Versão Corrigida)
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

      // 2. Verificação de Saldo para DESPESA
      if (tipo === 'DESPESA') {
        const disponivel = Number(cartao.saldoDisponivel);
        if (disponivel < valorNum) {
          throw new AppError(`Saldo disponível insuficiente no cartão ${cartao.nome}. Disponível: ${disponivel}`, 400);
        }
      }

      let distribuicaoAutomatica = false;
      let valorDistribuidoTotal = 0;

      // --- LÓGICA DE OBJETIVOS ---
      // A) Distribuição Automática (Receita + Cartão Configurado)
      if (tipo === 'RECEITA' && cartao.distribuirParaObjetivos) {
        const objetivos = await tx.objetivo.findMany({
          where: { 
            usuarioId, 
            excluido: false, 
            concluido: false, 
            porcentagemDistribuicao: { gt: 0 } 
          }
        });

        if (objetivos.length > 0) {
          distribuicaoAutomatica = true;
          
          for (const obj of objetivos) {
            const valorFatiado = valorNum * (Number(obj.porcentagemDistribuicao) / 100);
            if (valorFatiado > 0) {
              await tx.objetivo.update({
                where: { id: obj.id },
                data: { valorAtual: { increment: valorFatiado } }
              });
              valorDistribuidoTotal += valorFatiado;
            }
          }

          // NOVO: Atualizar saldoReservado do cartão (bloqueia o valor distribuído)
          await tx.cartao.update({
            where: { id: cartaoId },
            data: { 
              saldoReservado: { increment: valorDistribuidoTotal },
              // Disponível já será atualizado junto com saldoAtual abaixo
            }
          });
        }
      }

      // B) Depósito Manual (Despesa direcionada a objetivo)
      if (tipo === 'DESPESA' && objetivoId) {
        await tx.objetivo.update({
          where: { id: objetivoId, usuarioId },
          data: { valorAtual: { increment: valorNum } }
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
          distribuicaoAutomatica // NOVO: Flag para rastrear
        },
        include: {
          categoria: { select: { nome: true, icone: true } },
          cartao: { select: { nome: true } },
          objetivo: { select: { titulo: true } }
        }
      });

      // 4. Atualização de Saldo do Cartão
      const fator = tipo === 'RECEITA' ? 1 : -1;
      const novoSaldo = Number(cartao.saldoAtual) + (valorNum * fator);
      let novoDisponivel = Number(cartao.saldoDisponivel);
      let novoReservado = Number(cartao.saldoReservado);

      if (tipo === 'RECEITA') {
        novoDisponivel += valorNum;
        // Se teve distribuição automática, o reservado já foi incrementado acima
        // e o disponível deve refletir: novoSaldo - novoReservado
        if (distribuicaoAutomatica) {
          novoDisponivel = novoSaldo - novoReservado;
        }
      } else {
        // DESPESA: diminui disponível
        novoDisponivel -= valorNum;
        // Reservado permanece igual
      }

      await tx.cartao.update({
        where: { id: cartaoId },
        data: { 
          saldoAtual: novoSaldo,
          saldoDisponivel: novoDisponivel,
          saldoReservado: novoReservado
        }
      });

      return gasto;
    });

    await invalidarCacheUsuario(usuarioId);
    res.status(201).json({ 
      success: true, 
      message: resultado.distribuicaoAutomatica 
        ? 'Receita registrada e distribuída automaticamente!' 
        : 'Transação registrada!',
      data: resultado 
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
    const { pagina = 1, limite = 20, tipo, categoriaId, cartaoId, objetivoId } = req.query;
    const skip = (parseInt(pagina) - 1) * parseInt(limite);

    const where = {
      usuarioId,
      excluido: false,
      ...(tipo && { tipo }),
      ...(categoriaId && { categoriaId }),
      ...(cartaoId && { cartaoId }),
      ...(objetivoId && { objetivoId })
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
      valor: Number(g.valor)
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
    
    const stats = await prisma.gasto.groupBy({
      by: ['categoriaId'],
      where: { 
        usuarioId, 
        tipo: 'DESPESA', 
        excluido: false 
      },
      _sum: { valor: true },
      _count: { id: true }
    });

    const categoriasIds = stats.map(s => s.categoriaId);
    const categorias = await prisma.categoria.findMany({
      where: { id: { in: categoriasIds } }
    });

    const resultado = stats.map(s => ({
      categoriaId: s.categoriaId,
      total: Number(s._sum.valor) || 0,
      quantidade: s._count.id,
      categoria: categorias.find(c => c.id === s.categoriaId)?.nome || 'Outros'
    }));

    res.json({ success: true, data: resultado });
  } catch (err) { 
    next(err); 
  }
};

/**
 * DELETAR GASTO (CORREÇÃO CRÍTICA: Estorno de distribuição automática)
 */
const deletarGasto = async (req, res, next) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      // Buscar gasto com relacionamentos necessários
      const gasto = await tx.gasto.findFirst({ 
        where: { id, usuarioId, excluido: false },
        include: { cartao: true }
      });
      
      if (!gasto) throw new AppError('Transação não encontrada', 404);

      const cartao = gasto.cartao;
      const valor = Number(gasto.valor);
      const tipo = gasto.tipo;

      // Array de operações para Promise.all (independentes entre si)
      const operacoes = [];

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
        }
      } else {
        // Estornar receita: tira o dinheiro
        ajusteSaldo = -valor;
        
        // CORREÇÃO CRÍTICA: Se tinha distribuição automática, reverter dos objetivos
        if (gasto.distribuicaoAutomatica && cartao.distribuirParaObjetivos) {
          const objetivos = await tx.objetivo.findMany({
            where: { 
              usuarioId, 
              excluido: false, 
              porcentagemDistribuicao: { gt: 0 } 
            }
          });

          let totalRevertido = 0;
          
          for (const obj of objetivos) {
            const valorFatiado = valor * (Number(obj.porcentagemDistribuicao) / 100);
            if (valorFatiado > 0) {
              operacoes.push(
                tx.objetivo.update({
                  where: { id: obj.id },
                  data: { valorAtual: { decrement: valorFatiado } }
                })
              );
              totalRevertido += valorFatiado;
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
    });

    await invalidarCacheUsuario(usuarioId);
    res.json({ success: true, message: 'Transação removida e valores estornados.' });
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

module.exports = {
  criarGasto,
  listarGastos,
  gastosPorCategoria,
  deletarGasto,
  dashboardStats
};