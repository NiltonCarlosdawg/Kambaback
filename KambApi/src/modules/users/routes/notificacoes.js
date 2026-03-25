
const express = require('express');
const router = express.Router();
const { protegerRota } = require('../../../middleware/auth');
const NotificacaoService = require('../services/notificacaoService');
const { getEstatisticas, isUsuarioOnline } = require('../../../websocket/socketConfig');

// ==========================================
// ROTAS DE NOTIFICAÇÕES
// ==========================================


router.get('/', protegerRota, async (req, res, next) => {
  try {
    const { pagina = 1, limite = 20, apenasNaoLidas = false } = req.query;
    const usuarioId = req.user.id;

    const resultado = await NotificacaoService.buscarHistorico(
      usuarioId,
      { 
        pagina: parseInt(pagina), 
        limite: parseInt(limite), 
        apenasNaoLidas: apenasNaoLidas === 'true' 
      }
    );

    res.json({
      success: true,
      ...resultado
    });
  } catch (err) {
    next(err);
  }
});


router.get('/nao-lidas', protegerRota, async (req, res, next) => {
  try {
    const { limite = 20 } = req.query;
    const notificacoes = await NotificacaoService.buscarNaoLidas(
      req.user.id, 
      parseInt(limite)
    );

    res.json({
      success: true,
      total: notificacoes.length,
      notificacoes
    });
  } catch (err) {
    next(err);
  }
});


router.patch('/:id/lida', protegerRota, async (req, res, next) => {
  try {
    const { id } = req.params;
    const sucesso = await NotificacaoService.marcarComoLida(id, req.user.id);

    if (!sucesso) {
      return res.status(404).json({
        success: false,
        message: 'Notificação não encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Notificação marcada como lida'
    });
  } catch (err) {
    next(err);
  }
});


router.patch('/lidas/todas', protegerRota, async (req, res, next) => {
  try {
    const prisma = require('../../../lib/prisma');
    
    const resultado = await prisma.notificacaoPush.updateMany({
      where: {
        usuarioId: req.user.id,
        lida: false
      },
      data: {
        lida: true
      }
    });

    res.json({
      success: true,
      message: `${resultado.count} notificações marcadas como lidas`
    });
  } catch (err) {
    next(err);
  }
});


router.get('/status', protegerRota, async (req, res) => {
  const online = isUsuarioOnline(req.user.id);
  const stats = getEstatisticas();
  
  res.json({
    success: true,
    websocket: {
      conectado: online,
      ...stats
    }
  });
});

module.exports = router;