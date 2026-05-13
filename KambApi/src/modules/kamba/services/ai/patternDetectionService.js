const prisma = require('../../../../lib/prisma');

const detectarPadroes = async (usuarioId) => {
  const tresMesesAtras = new Date();
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

  const gastos = await prisma.gasto.findMany({
    where: {
      usuarioId,
      data: { gte: tresMesesAtras },
      excluido: false,
      tipo: 'DESPESA'
    },
    include: { categoria: { select: { nome: true } } },
    orderBy: { data: 'asc' }
  });

  if (gastos.length < 5) return { padroes: [], insights: [] };

  const padroes = [];
  const insights = [];

  // ── PADRÃO 1: Gastos recorrentes no mesmo dia do mês ────
  const porDiaCategoria = {};
  for (const g of gastos) {
    const dia = g.data.getDate();
    const cat = g.categoria?.nome || 'Geral';
    const chave = `${dia}_${cat}`;
    if (!porDiaCategoria[chave]) porDiaCategoria[chave] = [];
    porDiaCategoria[chave].push(g);
  }

  for (const [chave, ocorrencias] of Object.entries(porDiaCategoria)) {
    if (ocorrencias.length >= 2) {
      const meses = new Set(ocorrencias.map(g => `${g.data.getFullYear()}-${g.data.getMonth()}`));
      if (meses.size >= 2) {
        const [dia, categoria] = chave.split('_');
        const total = ocorrencias.reduce((acc, g) => acc + Number(g.valor), 0);
        const media = Math.round(total / ocorrencias.length);
        padroes.push({
          tipo: 'gasto_recorrente',
          dia: parseInt(dia),
          categoria,
          media,
          ocorrencias: ocorrencias.length,
          mensagem: `Todo dia ${dia} gastas ~${media.toLocaleString('pt-AO')} AOA em ${categoria}`
        });
      }
    }
  }

  // ── PADRÃO 2: Velocidade de gasto ────────────────────────
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const diaAtual = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

  const gastosMes = gastos.filter(g => g.data >= inicioMes);
  const totalGasto = gastosMes.reduce((acc, g) => acc + Number(g.valor), 0);
  const user = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { rendaMensalMedia: true }
  });
  const renda = Number(user?.rendaMensalMedia) || 0;

  if (diaAtual >= 5 && totalGasto > 0 && renda > 0) {
    const percentualGasto = Math.round((totalGasto / renda) * 100);
    const percentualTempo = Math.round((diaAtual / diasNoMes) * 100);

    if (percentualGasto > percentualTempo * 1.5) {
      insights.push({
        tipo: 'velocidade_alta',
        mensagem: `Gastaste ${percentualGasto}% da renda em apenas ${diaAtual} dias (${percentualTempo}% do mês). O ritmo está acelerado!`
      });
    }
  }

  // ── PADRÃO 3: Comparação com mês anterior ────────────────
  const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fimMesPassado = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59, 999);

  const gastosMesPassado = gastos.filter(g =>
    g.data >= mesPassado && g.data <= fimMesPassado
  );
  const totalMesPassado = gastosMesPassado.reduce((acc, g) => acc + Number(g.valor), 0);

  if (totalMesPassado > 0 && totalGasto > 0 && diaAtual > 1) {
    // Projetar gasto actual para o mês completo
    const projecaoAtual = Math.round((totalGasto / diaAtual) * diasNoMes);
    const variacao = Math.round(((projecaoAtual - totalMesPassado) / totalMesPassado) * 100);

    if (Math.abs(variacao) > 20) {
      insights.push({
        tipo: variacao > 0 ? 'gasto_crescente' : 'gasto_decrescente',
        mensagem: variacao > 0
          ? `Este mês estás a gastar ${variacao}% mais que o mês passado. Se manteres o ritmo, vais gastar ${projecaoAtual.toLocaleString('pt-AO')} AOA no total.`
          : `Este mês estás a gastar ${Math.abs(variacao)}% menos que o mês passado. Boa continua assim!`
      });
    }
  }

  // ── PADRÃO 4: Gasto grande isolado ───────────────────────
  if (gastosMes.length > 0) {
    const valores = gastosMes.map(g => Number(g.valor));
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const desvio = Math.sqrt(valores.reduce((sum, v) => sum + Math.pow(v - media, 2), 0) / valores.length);
    const grandes = gastosMes.filter(g => Number(g.valor) > media + 2 * desvio);

    for (const g of grandes) {
      insights.push({
        tipo: 'gasto_grande',
        mensagem: `Gastaste ${Number(g.valor).toLocaleString('pt-AO')} AOA em ${g.categoria?.nome || 'Geral'} (${g.descricao}). Queres criar uma meta para compensar?`,
        gastoId: g.id
      });
    }
  }

  return { padroes, insights };
};

module.exports = { detectarPadroes };
