const express = require('express');
const router = express.Router();
const { protegerRota } = require('../middleware/auth');
const { 
  conversarComKamba, 
  enviarFeedback 
} = require('../controllers/kambaController');
const Wizard = require('../controllers/kambaWizardController');
const Proatividade = require('../services/kambaProatividadeService');

router.use(protegerRota);
/**
 * POST /kamba
 * Conversa principal com o Kamba
 */
router.post('/', conversarComKamba);

/**
 * POST /kamba/conversar
 * Alias da rota principal (compatibilidade)
 */
router.post('/conversar', conversarComKamba);

// ==========================================
// ROTAS DE FEEDBACK
// ==========================================

/**
 * POST /kamba/feedback
 * Enviar feedback sobre resposta
 * Body: { mensagemId?, avaliacao: 'positivo'|'negativo'|'neutro', comentario? }
 */
router.post('/feedback', enviarFeedback);

// ==========================================
// ROTAS DE WIZARD/FLUXOS
// ==========================================

/**
 * GET /kamba/fluxos
 * Lista todos os fluxos disponíveis
 */
router.get('/fluxos', (req, res) => {
  const lista = Wizard.listarFluxos();
  return res.json({
    success: true,
    fluxos: Object.entries(Wizard.FLUXOS).map(([key, fluxo]) => ({
      id: key,
      nome: fluxo.nome,
      passos: fluxo.passos.length
    })),
    mensagem: lista
  });
});

/**
 * POST /kamba/fluxo/cancelar
 * Cancela fluxo ativo
 */
router.post('/fluxo/cancelar', (req, res) => {
  const usuarioId = req.user.id;
  const mensagem = Wizard.cancelarFluxo(usuarioId);
  return res.json({
    success: true,
    mensagem
  });
});

/**
 * GET /kamba/fluxo/status
 * Verifica se tem fluxo ativo
 */
router.get('/fluxo/status', (req, res) => {
  const usuarioId = req.user.id;
  const ativo = Wizard.temFluxoAtivo(usuarioId);
  return res.json({
    success: true,
    fluxoAtivo: ativo
  });
});

// ==========================================
// ROTAS DE PROATIVIDADE/LEMBRETES
// ==========================================

/**
 * GET /kamba/lembretes
 * Busca lembretes pendentes
 */
router.get('/lembretes', async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const lembretes = await Proatividade.buscarLembretesPendentes(usuarioId);
    
    return res.json({
      success: true,
      total: lembretes.length,
      lembretes: lembretes.map(l => ({
        id: l.id,
        tipo: l.tipo,
        mensagem: l.mensagem,
        agendadoPara: l.agendadoPara
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /kamba/lembretes/:id/marcar-lido
 * Marca lembrete como lido
 */
router.post('/lembretes/:id/marcar-lido', async (req, res, next) => {
  try {
    const { id } = req.params;
    await Proatividade.marcarLembreteEnviado(id);
    
    return res.json({
      success: true,
      mensagem: 'Lembrete marcado como lido'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /kamba/dica
 * Gera dica proativa baseada em padrões
 */
router.get('/dica', async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const dica = await Proatividade.gerarDicaProativa(usuarioId);
    
    if (!dica) {
      return res.json({
        success: true,
        mensagem: 'Tá tudo sob controlo, kamba! Continue assim. '
      });
    }

    return res.json({
      success: true,
      dica
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// ROTAS DE ESTATÍSTICAS (ADMIN/DEBUG)
// ==========================================

/**
 * GET /kamba/stats
 * Estatísticas de uso (últimos 30 dias)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const prisma = require('../lib/prisma');
    const usuarioId = req.user.id;
    
    const mes30DiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const stats = await prisma.kambaUsage.aggregate({
      where: {
        usuarioId,
        timestamp: { gte: mes30DiasAtras }
      },
      _sum: { tokens: true },
      _avg: { latencia: true },
      _count: true
    });

    const feedback = await prisma.kambaFeedback.groupBy({
      by: ['avaliacao'],
      where: {
        usuarioId,
        criadoEm: { gte: mes30DiasAtras }
      },
      _count: true
    });

    return res.json({
      success: true,
      periodo: '30 dias',
      stats: {
        totalInteracoes: stats._count,
        totalTokens: stats._sum.tokens || 0,
        latenciaMedia: stats._avg.latencia?.toFixed(0) || 0,
        feedback: feedback.reduce((acc, f) => {
          acc[f.avaliacao] = f._count;
          return acc;
        }, {})
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /kamba/memoria
 * Limpa histórico de memória (reset)
 */
router.delete('/memoria', async (req, res, next) => {
  try {
    const prisma = require('../lib/prisma');
    const usuarioId = req.user.id;
    
    await prisma.kambaMemoria.deleteMany({
      where: { usuarioId }
    });

    return res.json({
      success: true,
      mensagem: 'Memória limpa com sucesso! Começamos do zero.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;