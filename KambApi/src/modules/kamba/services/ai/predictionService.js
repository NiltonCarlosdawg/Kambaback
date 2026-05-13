const prisma = require('../../../../lib/prisma');

const gerarPrevisoes = async (usuarioId) => {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);
  const diaAtual = hoje.getDate();
  const diasNoMes = fimMes.getDate();
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

  const [gastosMes, gastosHistoricos, user, cartoes] = await Promise.all([
    prisma.gasto.findMany({
      where: {
        usuarioId, data: { gte: inicioMes, lte: fimMes },
        excluido: false, tipo: 'DESPESA'
      },
      include: { categoria: { select: { nome: true } } }
    }),
    prisma.gasto.findMany({
      where: {
        usuarioId, data: { gte: seisMesesAtras, lt: inicioMes },
        excluido: false, tipo: 'DESPESA'
      },
      include: { categoria: { select: { nome: true } } }
    }),
    prisma.user.findUnique({
      where: { id: usuarioId },
      select: { rendaMensalMedia: true }
    }),
    prisma.cartao.findMany({
      where: { usuarioId, ativo: true, excluido: false },
      select: { saldoAtual: true, tipo: true }
    })
  ]);

  const renda = Number(user?.rendaMensalMedia) || 0;
  const previsoes = [];

  // ── PREVISÃO 1: Data de "bater na parede" ───────────────
  const totalGastoMes = gastosMes.reduce((acc, g) => acc + Number(g.valor), 0);
  if (totalGastoMes > 0 && diaAtual > 0 && renda > 0) {
    const mediaDiaria = totalGastoMes / diaAtual;
    const diasRestantes = diasNoMes - diaAtual;
    const gastoRestante = Math.round(mediaDiaria * diasRestantes);
    const saldoDisponivel = Math.max(0, renda - totalGastoMes);

    if (saldoDisponivel < gastoRestante && saldoDisponivel > 0) {
      const diaQuebra = Math.floor(saldoDisponivel / mediaDiaria) + diaAtual;
      if (diaQuebra <= diasNoMes) {
        previsoes.push({
          tipo: 'bater_parede',
          mensagem: `Com este ritmo de ${Math.round(mediaDiaria).toLocaleString('pt-AO')} AOA/dia, vais bater na parede dia ${diaQuebra}. Só tens ${saldoDisponivel.toLocaleString('pt-AO')} AOA de margem.`
        });
      }
    }

    if (saldoDisponivel <= 0) {
      previsoes.push({
        tipo: 'ja_bateu',
        mensagem: `Já gastaste mais do que a tua renda este mês. Hora de reavaliar os gastos, kamba!`
      });
    }
  }

  // ── PREVISÃO 2: Projecção por categoria ─────────────────
  if (gastosHistoricos.length >= 10) {
    const porCategoriaHistorico = {};
    for (const g of gastosHistoricos) {
      const mes = `${g.data.getFullYear()}-${g.data.getMonth()}`;
      const cat = g.categoria?.nome || 'Geral';
      if (!porCategoriaHistorico[cat]) porCategoriaHistorico[cat] = {};
      if (!porCategoriaHistorico[cat][mes]) porCategoriaHistorico[cat][mes] = 0;
      porCategoriaHistorico[cat][mes] += Number(g.valor);
    }

    const porCategoriaAtual = {};
    for (const g of gastosMes) {
      const cat = g.categoria?.nome || 'Geral';
      porCategoriaAtual[cat] = (porCategoriaAtual[cat] || 0) + Number(g.valor);
    }

    for (const [cat, meses] of Object.entries(porCategoriaHistorico)) {
      const valores = Object.values(meses);
      if (valores.length < 3) continue;
      const mediaHistorica = Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
      const gastoAtual = Math.round(porCategoriaAtual[cat] || 0);
      const projecaoAtual = Math.round((gastoAtual / Math.max(diaAtual, 1)) * diasNoMes);

      if (mediaHistorica > 0 && projecaoAtual > mediaHistorica * 1.3) {
        previsoes.push({
          tipo: 'categoria_acima',
          categoria: cat,
          mensagem: `Este mês vais gastar ~${projecaoAtual.toLocaleString('pt-AO')} AOA em ${cat}, contra ${mediaHistorica.toLocaleString('pt-AO')} AOA da média dos últimos meses.`,
        });
      }
    }
  }

  // ── PREVISÃO 3: Fundo de emergência ─────────────────────
  const saldoTotal = cartoes.reduce((acc, c) => acc + Number(c.saldoAtual), 0);
  const gastoMedioMensal = gastosHistoricos.length > 0
    ? Math.round(gastosHistoricos.reduce((acc, g) => acc + Number(g.valor), 0) / Math.max(
        new Set(gastosHistoricos.map(g => `${g.data.getFullYear()}-${g.data.getMonth()}`)).size, 1
      ))
    : totalGastoMes;

  if (gastoMedioMensal > 0 && saldoTotal > 0) {
    const mesesCobertura = saldoTotal / gastoMedioMensal;
    if (mesesCobertura < 6) {
      previsoes.push({
        tipo: 'fundo_baixo',
        mensagem: `Teu fundo cobre apenas ${mesesCobertura.toFixed(1)} meses de gastos. O ideal são 6 meses. Bora reforçar?`
      });
    }
  } else if (saldoTotal === 0) {
    previsoes.push({
      tipo: 'sem_fundo',
      mensagem: `Não tens fundo de emergência. Se surgir um imprevisto, como vais fazer?`
    });
  }

  return previsoes;
};

module.exports = { gerarPrevisoes };
