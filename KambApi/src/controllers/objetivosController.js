// src/controllers/objetivosController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

/**
 * LISTAR OBJETIVOS + DASHBOARD COMPLETO
 */
const listarObjetivos = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;

    const objetivos = await prisma.objetivo.findMany({
      where: { usuarioId },
      orderBy: { dataFinal: 'asc' }
    });

    const ativos = objetivos.filter(o => o.concluido === false);
    const concluidos = objetivos.filter(o => o.concluido === true);

    const totalAlvo = ativos.reduce((acc, o) => acc + o.valorAlvo, 0);
    const totalAtual = ativos.reduce((acc, o) => acc + o.valorAtual, 0);
    const progressoGeral = totalAlvo > 0 ? Math.round((totalAtual / totalAlvo) * 100) : 0;

    const proximos3 = ativos.slice(0, 3).map(o => ({
      id: o.id,
      titulo: o.titulo,
      valorAlvo: o.valorAlvo,
      valorAtual: o.valorAtual,
      progresso: Math.round((o.valorAtual / o.valorAlvo) * 100),
      dataFinal: o.dataFinal,
      cor: o.cor
    }));

    res.json({
      success: true,
      message: 'Objetivos carregados com sucesso',
      resumo: {
        total: objetivos.length,
        ativos: ativos.length,
        concluidos: concluidos.length,
        progressoGeral
      },
      proximos: proximos3,
      todos: objetivos.map(o => ({
        ...o,
        progressoPercentual: Math.round((o.valorAtual / o.valorAlvo) * 100),
        valorFaltante: o.valorAlvo - o.valorAtual
      }))
    });

  } catch (err) {
    next(err);
  }
};

/**
 * CRIAR NOVO OBJETIVO
 */
const criarObjetivo = async (req, res, next) => {
  const {
    titulo,
    descricao = '',
    categoria,
    valorAlvo,
    dataFinal,
    prioridade = 'media',
    cor = '#10b981',
    icone = 'target',
    porcentagemDistribuicao = 0,
    modoDistribuicao = 'manual'
  } = req.body;

  if (!titulo || !valorAlvo || !dataFinal) {
    return next(new AppError('Título, valor alvo e data final são obrigatórios', 400));
  }

  try {
    const objetivo = await prisma.objetivo.create({
      data: {
        usuarioId: req.user.id,
        titulo: titulo.trim(),
        descricao,
        categoria: categoria || null,
        valorAlvo: parseFloat(valorAlvo),
        valorAtual: 0,
        dataFinal: new Date(dataFinal),
        prioridade,
        cor,
        icone,
        porcentagemDistribuicao: parseInt(porcentagemDistribuicao) || 0,
        modoDistribuicao,
        concluido: false
      }
    });

    res.status(201).json({
      success: true,
      message: 'Objetivo criado com sucesso! Vamos lá, kamba!',
      objetivo: {
        ...objetivo,
        progressoPercentual: 0,
        valorFaltante: objetivo.valorAlvo
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ATUALIZAR OBJETIVO
 */
const atualizarObjetivo = async (req, res, next) => {
  const { id } = req.params;
  const camposPermitidos = [
    'titulo', 'descricao', 'valorAlvo', 'dataFinal',
    'prioridade', 'cor', 'icone', 'porcentagemDistribuicao',
    'modoDistribuicao', 'concluido'
  ];

  const dados = {};
  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      dados[campo] = req.body[campo];
    }
  }

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nada para atualizar', 400));
  }

  try {
    const objetivo = await prisma.objetivo.updateMany({
      where: { id, usuarioId: req.user.id },
      data: dados
    });

    if (objetivo.count === 0) {
      return next(new AppError('Objetivo não encontrado', 404));
    }

    const atualizado = await prisma.objetivo.findUnique({ where: { id } });

    res.json({
      success: true,
      message: 'Objetivo atualizado',
      objetivo: {
        ...atualizado,
        progressoPercentual: Math.round((atualizado.valorAtual / atualizado.valorAlvo) * 100),
        valorFaltante: atualizado.valorAlvo - atualizado.valorAtual
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ADICIONAR PROGRESSO MANUAL
 */
const adicionarProgresso = async (req, res, next) => {
  const { id } = req.params;
  const { valor } = req.body;

  const valorNum = parseFloat(valor);
  if (!valor || valorNum <= 0) {
    return next(new AppError('Valor deve ser positivo', 400));
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const objetivo = await tx.objetivo.findFirst({
        where: { id, usuarioId: req.user.id }
      });

      if (!objetivo) throw new AppError('Objetivo não encontrado', 404);
      if (objetivo.concluido) throw new AppError('Este objetivo já foi concluído', 400);

      const novoValorAtual = Math.min(objetivo.valorAtual + valorNum, objetivo.valorAlvo);

      const atualizado = await tx.objetivo.update({
        where: { id },
        data: {
          valorAtual: novoValorAtual,
          concluido: novoValorAtual >= objetivo.valorAlvo
        }
      });

      return atualizado;
    });

    const progresso = Math.round((resultado.valorAtual / resultado.valorAlvo * 100));
    const faltam = resultado.valorAlvo - resultado.valorAtual;

    res.json({
      success: true,
      message: `Progresso adicionado! ${faltam <= 0 ? 'Parabéns! Objetivo concluído!' : `Faltam ${faltam.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}`}`,
      objetivo: {
        ...resultado,
        progressoPercentual: progresso,
        valorFaltante: faltam
      }
    });

  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Erro ao adicionar progresso', 500));
  }
};

/**
 * DISTRIBUIR POUPANÇA AUTOMÁTICA DO MÊS
 * CORRIGIDO: Transação atômica para evitar race conditions
 */
const distribuirPoupanca = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;

    // Executa tudo dentro de uma única transação
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Calcula poupança líquida do mês atual
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

      const movimentos = await tx.gasto.groupBy({
        by: ['tipo'],
        where: {
          usuarioId,
          data: { gte: inicioMes, lte: fimMes },
          excluido: false
        },
        _sum: { valor: true }
      });

      let receitas = 0, despesas = 0;
      movimentos.forEach(m => {
        if (m.tipo === 'receita') receitas = m._sum.valor || 0;
        if (m.tipo === 'despesa') despesas = m._sum.valor || 0;
      });

      const poupancaDisponivel = receitas - despesas;

      if (poupancaDisponivel <= 0) {
        return {
          semPoupanca: true,
          poupancaDisponivel,
          distribuidos: []
        };
      }

      // 2. Busca objetivos com distribuição automática
      const objetivos = await tx.objetivo.findMany({
        where: {
          usuarioId,
          concluido: false,
          modoDistribuicao: 'automatico',
          porcentagemDistribuicao: { gt: 0 }
        }
      });

      if (objetivos.length === 0) {
        return {
          semObjetivos: true,
          poupancaDisponivel,
          distribuidos: []
        };
      }

      // 3. Distribui proporcionalmente - AGORA TUDO NA MESMA TRANSAÇÃO
      const distribuidos = [];
      
      // Calcula todos os updates primeiro
      const updates = objetivos.map(obj => {
        const valor = Math.round(poupancaDisponivel * (obj.porcentagemDistribuicao / 100));
        if (valor <= 0) return null;

        const novoAtual = Math.min(obj.valorAtual + valor, obj.valorAlvo);
        
        return {
          id: obj.id,
          titulo: obj.titulo,
          valor,
          progressoAnterior: Math.round((obj.valorAtual / obj.valorAlvo) * 100),
          progressoAtual: Math.round((novoAtual / obj.valorAlvo) * 100),
          novoAtual,
          concluido: novoAtual >= obj.valorAlvo
        };
      }).filter(Boolean);

      // Executa todos os updates de forma atômica
      for (const update of updates) {
        await tx.objetivo.update({
          where: { id: update.id },
          data: {
            valorAtual: update.novoAtual,
            concluido: update.concluido
          }
        });

        distribuidos.push({
          objetivo: update.titulo,
          valor: update.valor,
          progressoAnterior: update.progressoAnterior,
          progressoAtual: update.progressoAtual
        });
      }

      return {
        sucesso: true,
        poupancaDisponivel,
        distribuidos
      };
    });

    // Retorna resposta baseada no resultado da transação
    if (resultado.semPoupanca) {
      return res.json({
        success: true,
        message: 'Sem poupança este mês. Continua a lutar, kamba!',
        poupancaDisponivel: resultado.poupancaDisponivel,
        distribuidos: []
      });
    }

    if (resultado.semObjetivos) {
      return res.json({
        success: true,
        message: 'Poupança disponível, mas sem objetivos automáticos configurados',
        poupancaDisponivel: resultado.poupancaDisponivel,
        distribuidos: []
      });
    }

    res.json({
      success: true,
      message: `Poupança distribuída automaticamente! ${resultado.poupancaDisponivel.toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })} investidos no teu futuro`,
      poupancaDisponivel: resultado.poupancaDisponivel,
      distribuidos: resultado.distribuidos
    });

  } catch (err) {
    next(err);
  }
};

/**
 * DELETAR OBJETIVO
 */
const deletarObjetivo = async (req, res, next) => {
  const { id } = req.params;

  try {
    const atualizado = await prisma.gasto.update({
      where: { id, usuarioId: req.user.id },
      data: { excluido: true }
    });

    // Invalida cache se tiver
    await invalidarCacheUsuario(req.user.id);

    res.json({
      success: true,
      message: 'Gasto removido com sucesso (movido para lixeira)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listarObjetivos,
  criarObjetivo,
  atualizarObjetivo,
  adicionarProgresso,
  distribuirPoupanca,
  deletarObjetivo
};