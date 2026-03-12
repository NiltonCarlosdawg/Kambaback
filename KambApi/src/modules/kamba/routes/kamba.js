const express = require('express');
const router = express.Router();
const { protegerRota } = require('../../../middleware/auth');
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
 * Body: { mensagemId?, avaliacao: 1-5, comentario? }
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
 * Busca lembretes pendentes (não enviados e não lidos)
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
        titulo: l.titulo,           // CORRIGIDO: adicionado campo
        mensagem: l.mensagem,
        dataHora: l.dataHora,       // CORRIGIDO: era 'agendadoPara'
        enviado: l.enviado,         // CORRIGIDO: adicionado campo
        lido: l.lido                // CORRIGIDO: adicionado campo
      }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /kamba/lembretes/:id/marcar-lido
 * Marca lembrete como lido pelo usuário
 * CORRIGIDO: usa marcarLembreteLido ao invés de marcarLembreteEnviado
 */
router.post('/lembretes/:id/marcar-lido', async (req, res, next) => {
  try {
    const { id } = req.params;
    await Proatividade.marcarLembreteLido(id);  // CORRIGIDO: função específica para lido
    
    return res.json({
      success: true,
      mensagem: 'Lembrete marcado como lido'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /kamba/lembretes/:id/marcar-enviado
 * Marca lembrete como enviado (uso interno/admin)
 */
router.post('/lembretes/:id/marcar-enviado', async (req, res, next) => {
  try {
    const { id } = req.params;
    await Proatividade.marcarLembreteEnviado(id);
    
    return res.json({
      success: true,
      mensagem: 'Lembrete marcado como enviado'
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
 * CORRIGIDO: usa campos atualizados do KambaUsage
 */
router.get('/stats', async (req, res, next) => {
  try {
    const prisma = require('../../../lib/prisma');
    const usuarioId = req.user.id;
    
    const mes30DiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // CORRIGIDO: usa campos do schema atualizado
    const stats = await prisma.kambaUsage.aggregate({
      where: {
        usuarioId,
        criadoEm: { gte: mes30DiasAtras }  // CORRIGIDO: era 'timestamp'
      },
      _sum: { 
        tokens: true,
        latencia: true  // CORRIGIDO: adicionado
      },
      _avg: { 
        latencia: true 
      },
      _count: true
    });

    // CORRIGIDO: agrupa por sucesso/erro
    const feedbackStatus = await prisma.kambaUsage.groupBy({
      by: ['sucesso'],
      where: {
        usuarioId,
        criadoEm: { gte: mes30DiasAtras }
      },
      _count: true
    });

    // CORRIGIDO: KambaFeedback usa avaliacao como Int, não string
    const feedbackAvaliacoes = await prisma.kambaFeedback.groupBy({
      by: ['avaliacao'],
      where: {
        usuarioId,
        criadoEm: { gte: mes30DiasAtras }  // CORRIGIDO: verifica se existe ou usa createdAt
      },
      _count: true
    });

    // Calcula taxa de sucesso
    const totalRequests = stats._count || 0;
    const sucessos = feedbackStatus.find(f => f.sucesso === true)?._count || 0;
    const falhas = feedbackStatus.find(f => f.sucesso === false)?._count || 0;

    return res.json({
      success: true,
      periodo: '30 dias',
      stats: {
        totalInteracoes: totalRequests,
        totalTokens: stats._sum.tokens || 0,
        latenciaMedia: stats._avg.latencia?.toFixed(0) || 0,
        latenciaTotal: stats._sum.latencia || 0,
        taxaSucesso: totalRequests > 0 ? Math.round((sucessos / totalRequests) * 100) : 0,
        totalSucessos: sucessos,
        totalFalhas: falhas,
        feedbackPorNota: feedbackAvaliacoes.reduce((acc, f) => {
          acc[f.avaliacao] = f._count;
          return acc;
        }, {})
      }
    });
  } catch (err) {
    console.error('[STATS] Erro:', err.message);
    // Retorna erro amigável em vez de crashar
    return res.json({
      success: false,
      mensagem: 'Erro ao carregar estatísticas',
      erro: err.message
    });
  }
});

/**
 * GET /kamba/stats/modelos
 * Estatísticas por modelo de IA usado
 */
router.get('/stats/modelos', async (req, res, next) => {
  try {
    const prisma = require('../../../lib/prisma');
    const usuarioId = req.user.id;
    
    const mes30DiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const statsPorModelo = await prisma.kambaUsage.groupBy({
      by: ['modelo'],
      where: {
        usuarioId,
        criadoEm: { gte: mes30DiasAtras },
        modelo: { not: null }
      },
      _sum: {
        tokens: true,
        latencia: true
      },
      _count: true
    });

    return res.json({
      success: true,
      modelos: statsPorModelo.map(s => ({
        modelo: s.modelo,
        totalUsos: s._count,
        totalTokens: s._sum.tokens || 0,
        latenciaMedia: s._sum.latencia ? Math.round(s._sum.latencia / s._count) : 0
      }))
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
    const prisma = require('../../../lib/prisma');
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

/**
 * GET /kamba/memoria
 * Lista últimas mensagens da memória (para debug)
 */
router.get('/memoria', async (req, res, next) => {
  try {
    const prisma = require('../../../lib/prisma');
    const usuarioId = req.user.id;
    
    const mensagens = await prisma.kambaMemoria.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },  // CORRIGIDO: era 'timestamp'
      take: 20
    });

    return res.json({
      success: true,
      total: mensagens.length,
      mensagens: mensagens.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        contexto: m.contexto,
        criadoEm: m.criadoEm  // CORRIGIDO: era 'timestamp'
      }))
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// ROTAS ADMIN (protegidas por role)
// ==========================================

/**
 * POST /kamba/admin/analise-geral
 * Executa análise proativa para todos os usuários (admin only)
 */
router.post('/admin/analise-geral', async (req, res, next) => {
  try {
    // Verifica se é admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        mensagem: 'Apenas administradores podem executar esta ação'
      });
    }

    await Proatividade.executarAnaliseDiaria();
    
    return res.json({
      success: true,
      mensagem: 'Análise proativa executada para todos os usuários'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;