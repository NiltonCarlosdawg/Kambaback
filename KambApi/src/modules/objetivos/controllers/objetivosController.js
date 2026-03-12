// src/controllers/objetivosController.js
const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { invalidarCacheUsuario } = require('../../insights/controllers/insightsController');

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

  try {
    const objetivo = await prisma.objetivo.create({
      data: {
        usuarioId: req.user.id,
        titulo: titulo.trim(),
        valorAlvo: parseFloat(valorAlvo),
        dataPrevista: new Date(dataPrevista),
        categoria: categoria || 'Geral',
        prioridade: prioridade || 'MEDIA',
        icone: icone || 'target',
        cor: cor || '#10b981',
        porcentagemDistribuicao: parseFloat(porcentagemDistribuicao || 0),
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

  try {
    const objetivoExistente = await prisma.objetivo.findFirst({
      where: { id, usuarioId: req.user.id, excluido: false }
    });

    if (!objetivoExistente) return next(new AppError('Objetivo não encontrado', 404));

    // Sanitização de tipos
    if (dados.valorAlvo) dados.valorAlvo = parseFloat(dados.valorAlvo);
    if (dados.valorAtual) dados.valorAtual = parseFloat(dados.valorAtual);
    if (dados.porcentagemDistribuicao !== undefined) {
      dados.porcentagemDistribuicao = parseFloat(dados.porcentagemDistribuicao);
    }
    if (dados.dataPrevista) dados.dataPrevista = new Date(dados.dataPrevista);

    const atualizado = await prisma.objetivo.update({
      where: { id },
      data: dados
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
  const { valorTotal } = req.body;
  if (!valorTotal || valorTotal <= 0) return next(new AppError('Valor inválido', 400));

  try {
    const objetivos = await prisma.objetivo.findMany({
      where: { usuarioId: req.user.id, excluido: false, concluido: false, porcentagemDistribuicao: { gt: 0 } }
    });

    await prisma.$transaction(
      objetivos.map(obj => prisma.objetivo.update({
        where: { id: obj.id },
        data: { valorAtual: { increment: (valorTotal * (obj.porcentagemDistribuicao / 100)) } }
      }))
    );

    await invalidarCacheUsuario(req.user.id);
    res.json({ success: true, message: 'Poupança distribuída!' });
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