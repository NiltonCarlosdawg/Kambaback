// src/controllers/objetivosController.js
const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { invalidarCacheUsuario } = require('../../insights/controllers/insightsController');

const arredondarDinheiro = (valor) =>
  Math.round((Number(valor) + Number.EPSILON) * 100) / 100;

const calcularTotalDistribuicao = async (usuarioId, objetivoIdIgnorado = null) => {
  const objetivos = await prisma.objetivo.findMany({
    where: {
      usuarioId,
      excluido: false,
      concluido: false,
      ...(objetivoIdIgnorado && { id: { not: objetivoIdIgnorado } })
    },
    select: {
      porcentagemDistribuicao: true
    }
  });

  return objetivos.reduce(
    (acc, obj) => acc + Number(obj.porcentagemDistribuicao || 0),
    0,
  );
};

const validarDistribuicaoObjetivos = async (
  usuarioId,
  novaPercentagem,
  objetivoIdIgnorado = null,
) => {
  const totalActual = await calcularTotalDistribuicao(usuarioId, objetivoIdIgnorado);
  const totalComNovoValor = totalActual + Number(novaPercentagem || 0);

  if (totalComNovoValor > 100) {
    throw new AppError(
      'A soma das percentagens de distribuição dos objetivos não pode ultrapassar 100%',
      400,
    );
  }
};

/**
 * LISTAR OBJETIVOS
 */
const listarObjetivos = async (req, res, next) => {
  try {
    const usuarioId = req.user.id;

    const objetivos = await prisma.objetivo.findMany({
      where: { usuarioId, excluido: false },
      orderBy: { dataPrevista: 'asc' }
    });

    const ativos = objetivos.filter(o => o.concluido === false);
    const concluidos = objetivos.filter(o => o.concluido === true);

    const totalAlvo = ativos.reduce((acc, o) => acc + Number(o.valorAlvo || 0), 0);
    const totalAtual = ativos.reduce((acc, o) => acc + Number(o.valorAtual || 0), 0);
    const progressoGeral = totalAlvo > 0 ? Math.round((totalAtual / totalAlvo) * 100) : 0;

    res.json({
      success: true,
      resumo: {
        totalObjetivos: ativos.length,
        totalConcluidos: concluidos.length,
        totalAlvo,
        totalAtual,
        progressoGeral
      },
      objetivos: ativos,
      concluidos
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
    titulo, valorAlvo, dataPrevista, categoria, 
    prioridade, icone, cor, porcentagemDistribuicao 
  } = req.body;

  if (!titulo || !valorAlvo || !dataPrevista) {
    return next(new AppError('Título, valor alvo e data prevista são obrigatórios', 400));
  }

  const valorAlvoNum = parseFloat(valorAlvo);
  const porcentagemNum = parseFloat(porcentagemDistribuicao || 0);

  if (Number.isNaN(valorAlvoNum) || valorAlvoNum <= 0) {
    return next(new AppError('Valor alvo inválido', 400));
  }

  if (Number.isNaN(porcentagemNum) || porcentagemNum < 0 || porcentagemNum > 100) {
    return next(new AppError('A percentagem de distribuição deve estar entre 0 e 100', 400));
  }

  try {
    await validarDistribuicaoObjetivos(
      req.user.id,
      porcentagemNum,
    );

    const objetivo = await prisma.objetivo.create({
      data: {
        usuarioId: req.user.id,
        titulo: titulo.trim(),
        valorAlvo: valorAlvoNum,
        dataPrevista: new Date(dataPrevista),
        categoria: categoria || 'Geral',
        prioridade: prioridade || 'MEDIA',
        icone: icone || 'target',
        cor: cor || '#10b981',
        porcentagemDistribuicao: porcentagemNum,
        valorAtual: 0,
        concluido: false,
        excluido: false
      }
    });

    await invalidarCacheUsuario(req.user.id);
    res.status(201).json({ success: true, message: 'Objetivo criado!', objetivo });
  } catch (err) {
    next(err);
  }
};

/**
 * ATUALIZAR OBJETIVO
 */
const atualizarObjetivo = async (req, res, next) => {
  const { id } = req.params;
  const dados = req.body;

  const camposPermitidos = [
    'titulo', 'valorAlvo', 'valorAtual', 'dataPrevista',
    'categoria', 'prioridade', 'icone', 'cor', 'porcentagemDistribuicao',
    'concluido', 'descricao'
  ];

  const dadosSanitizados = {};
  for (const campo of camposPermitidos) {
    if (dados[campo] !== undefined) {
      if (campo === 'valorAlvo' || campo === 'valorAtual' || campo === 'porcentagemDistribuicao') {
        dadosSanitizados[campo] = parseFloat(dados[campo]);
      } else if (campo === 'dataPrevista') {
        dadosSanitizados[campo] = new Date(dados[campo]);
      } else if (campo === 'concluido') {
        dadosSanitizados[campo] = Boolean(dados[campo]);
      } else if (typeof dados[campo] === 'string') {
        dadosSanitizados[campo] = dados[campo].trim();
      } else {
        dadosSanitizados[campo] = dados[campo];
      }
    }
  }

  try {
    const objetivoExistente = await prisma.objetivo.findFirst({
      where: { id, usuarioId: req.user.id, excluido: false }
    });

    if (!objetivoExistente) return next(new AppError('Objetivo não encontrado', 404));

    if (dadosSanitizados.valorAlvo !== undefined && Number.isNaN(dadosSanitizados.valorAlvo)) {
      return next(new AppError('Valor alvo inválido', 400));
    }
    if (dadosSanitizados.valorAtual !== undefined && Number.isNaN(dadosSanitizados.valorAtual)) {
      return next(new AppError('Valor actual inválido', 400));
    }
    if (
      dadosSanitizados.porcentagemDistribuicao !== undefined &&
      (Number.isNaN(dadosSanitizados.porcentagemDistribuicao) ||
        dadosSanitizados.porcentagemDistribuicao < 0 ||
        dadosSanitizados.porcentagemDistribuicao > 100)
    ) {
      return next(new AppError('A percentagem de distribuição deve estar entre 0 e 100', 400));
    }

    if (dadosSanitizados.porcentagemDistribuicao !== undefined) {
      await validarDistribuicaoObjetivos(
        req.user.id,
        dadosSanitizados.porcentagemDistribuicao,
        id,
      );
    }

    const atualizado = await prisma.objetivo.update({
      where: { id },
      data: dadosSanitizados
    });

    await invalidarCacheUsuario(req.user.id);
    res.json({ success: true, message: 'Objetivo atualizado!', objetivo: atualizado });
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
    const objetivo = await prisma.objetivo.findFirst({
      where: { id, usuarioId: req.user.id, excluido: false }
    });

    if (!objetivo) return next(new AppError('Objetivo não encontrado', 404));

    await prisma.objetivo.update({
      where: { id },
      data: { excluido: true, porcentagemDistribuicao: 0 }
    });

    await invalidarCacheUsuario(req.user.id);
    res.json({ success: true, message: 'Objetivo removido!' });
  } catch (err) {
    next(err);
  }
};

/**
 * DISTRIBUIR POUPANÇA
 */
const distribuirPoupancaAutomatica = async (req, res, next) => {
  const { valorTotal, cartaoId } = req.body;
  const valorNum = parseFloat(valorTotal);
  if (Number.isNaN(valorNum) || valorNum <= 0) return next(new AppError('Valor inválido', 400));
  if (!cartaoId) return next(new AppError('Cartão de origem é obrigatório', 400));

  try {
    const usuarioId = req.user.id;

    const cardBase = await prisma.cartao.findFirst({
      where: {
        id: cartaoId,
        usuarioId,
        ativo: true,
        excluido: false
      },
      orderBy: { atualizadoEm: 'desc' }
    });

    if (!cardBase) {
      return next(new AppError('Cartão de origem não encontrado ou inactivo', 404));
    }

    const percentualPoupanca = Number(cardBase.percentualDistribuicaoPoupanca || 0);
    if (percentualPoupanca <= 0) {
      return next(new AppError('O cartão seleccionado não tem percentagem de distribuição de poupança configurada', 400));
    }

    const objetivos = await prisma.objetivo.findMany({
      where: {
        usuarioId,
        excluido: false,
        concluido: false,
        porcentagemDistribuicao: { gt: 0 }
      }
    });

    const totalPercentagem = objetivos.reduce(
      (acc, obj) => acc + Number(obj.porcentagemDistribuicao || 0),
      0,
    );

    if (totalPercentagem <= 0) {
      return next(new AppError('Não existem objetivos configurados para distribuição', 400));
    }

    if (Math.abs(totalPercentagem - 100) > 0.01) {
      return next(new AppError('A soma das percentagens de distribuição dos objetivos deve ser exactamente 100%', 400));
    }

    const poolDistribuicao = arredondarDinheiro(
      (valorNum * percentualPoupanca) / 100,
    );

    const distribuicoes = objetivos.map((obj) => ({
      id: obj.id,
      valor: arredondarDinheiro(
        (poolDistribuicao * Number(obj.porcentagemDistribuicao)) / 100,
      )
    }));

    const totalDistribuido = distribuicoes.reduce(
      (acc, dist) => acc + dist.valor,
      0,
    );

    if (Number(cardBase.saldoDisponivel) < totalDistribuido) {
      return next(new AppError('Saldo disponível insuficiente no cartão seleccionado', 400));
    }

    await prisma.$transaction(async (tx) => {
      for (const dist of distribuicoes) {
        await tx.objetivo.update({
          where: { id: dist.id },
          data: { valorAtual: { increment: dist.valor } }
        });
      }

      await tx.cartao.update({
        where: { id: cardBase.id },
        data: {
          saldoDisponivel: { decrement: totalDistribuido },
          saldoReservado: { increment: totalDistribuido }
        }
      });
    });

    await invalidarCacheUsuario(usuarioId);
    res.json({
      success: true,
      message: 'Poupança distribuída e reservada no cartão',
      cartaoId: cardBase.id,
      valorReservado: totalDistribuido,
      valorNaoDistribuido: Math.max(0, valorNum - totalDistribuido),
      percentualDistribuicaoPoupanca: percentualPoupanca
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// EXPORTAÇÃO - MAPEAR NOMES POSSÍVEIS
// ==========================================
module.exports = {
  listarObjetivos,
  criarObjetivo,
  atualizarObjetivo,
  editarObjetivo: atualizarObjetivo, // Caso a rota use editarObjetivo
  deletarObjetivo,
  distribuirPoupancaAutomatica,
  distribuirPoupanca: distribuirPoupancaAutomatica // Caso a rota use distribuirPoupanca na linha 37
};
