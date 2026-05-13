const prisma = require('../../../../lib/prisma');

const extrairPreferencias = (mensagens) => {
  const preferencias = {
    temNegocio: false,
    preocupaComDolar: false,
    querPoupar: false,
    temDividas: false,
    estiloResposta: 'normal',
    temasFrequentes: []
  };

  const contagemTemas = {};

  mensagens.forEach(m => {
    if (m.role !== 'user') return;

    const content = m.content?.toLowerCase() || '';

    if (content.includes('negócio') || content.includes('negocio') || content.includes('vender') || content.includes('cliente')) {
      preferencias.temNegocio = true;
    }
    if (content.includes('dólar') || content.includes('dolar') || content.includes('câmbio') || content.includes('cambio')) {
      preferencias.preocupaComDolar = true;
    }
    if (content.includes('poupar') || content.includes('economizar') || content.includes('juntar')) {
      preferencias.querPoupar = true;
    }
    if (content.includes('dívida') || content.includes('divida') || content.includes('emprestimo') || content.includes('empréstimo')) {
      preferencias.temDividas = true;
    }

    if (content.length < 20) preferencias.estiloResposta = 'curto';
    else if (content.length > 100) preferencias.estiloResposta = 'detalhado';

    const temas = [
      { palavras: ['saldo', 'conta', 'cartão'], tema: 'saldo' },
      { palavras: ['gasto', 'despesa', 'comprei'], tema: 'gastos' },
      { palavras: ['objetivo', 'meta', 'quero comprar'], tema: 'metas' },
      { palavras: ['poupar', 'economizar', 'guardar'], tema: 'poupança' },
      { palavras: ['investir', 'investimento', 'juros'], tema: 'investimentos' },
      { palavras: ['dólar', 'dolar', 'euro', 'câmbio'], tema: 'câmbio' },
      { palavras: ['negócio', 'negocio', 'empresa'], tema: 'negócios' }
    ];

    temas.forEach(({ palavras, tema }) => {
      if (palavras.some(p => content.includes(p))) {
        contagemTemas[tema] = (contagemTemas[tema] || 0) + 1;
      }
    });
  });

  preferencias.temasFrequentes = Object.entries(contagemTemas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tema]) => tema);

  return preferencias;
};

const atualizarPreferenciasUsuario = async (usuarioId, novasPreferencias) => {
  try {
    const existente = await prisma.kambaPreferencias.findUnique({
      where: { usuarioId }
    });

    if (existente) {
      const temasAtuais = existente.temasFrequentes || [];
      const temasNovos = novasPreferencias.temasFrequentes || [];
      const temasUnicos = [...new Set([...temasAtuais, ...temasNovos])].slice(0, 5);

      await prisma.kambaPreferencias.update({
        where: { usuarioId },
        data: {
          temNegocio: novasPreferencias.temNegocio || existente.temNegocio,
          preocupaComDolar: novasPreferencias.preocupaComDolar || existente.preocupaComDolar,
          querPoupar: novasPreferencias.querPoupar || existente.querPoupar,
          temDividas: novasPreferencias.temDividas || existente.temDividas,
          estiloResposta: novasPreferencias.estiloResposta || existente.estiloResposta,
          temasFrequentes: temasUnicos,
          atualizadoEm: new Date()
        }
      });
    } else {
      await prisma.kambaPreferencias.create({
        data: {
          usuarioId,
          ...novasPreferencias
        }
      });
    }
  } catch (err) {
    console.error('[USER_PREFERENCES] Erro ao atualizar preferências:', err.message);
  }
};

const carregarPreferencias = async (usuarioId) => {
  try {
    return await prisma.kambaPreferencias.findUnique({
      where: { usuarioId }
    });
  } catch (err) {
    console.error('[USER_PREFERENCES] Erro ao carregar preferências:', err.message);
    return null;
  }
};

module.exports = {
  extrairPreferencias,
  atualizarPreferenciasUsuario,
  carregarPreferencias
};
