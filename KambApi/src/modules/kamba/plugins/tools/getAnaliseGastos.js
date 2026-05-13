const prisma = require('../../../../lib/prisma');

module.exports = {
  name: 'getAnaliseGastos',
  description: 'Analisa padrões de gastos do mês actual, calcula projecção para o fim do mês, e identifica categorias com maior peso. Chamar APENAS quando o utilizador pedir análise preditiva de gastos.',
  handler: async (_, context) => {
    const usuarioId = context.usuarioId;
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);
    const diasNoMes = fimMes.getDate();
    const diaAtual = hoje.getDate();

    const [despesas, user] = await Promise.all([
      prisma.gasto.findMany({
        where: {
          usuarioId,
          data: { gte: inicioMes, lte: fimMes },
          excluido: false,
          tipo: 'DESPESA'
        },
        include: { categoria: { select: { nome: true } } }
      }),
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { rendaMensalMedia: true }
      })
    ]);

    if (despesas.length === 0) {
      return { analise: 'Nenhum gasto registado este mês.', totalGasto: 0 };
    }

    const totalGasto = despesas.reduce((acc, g) => acc + Number(g.valor), 0);
    const mediaDiaria = totalGasto / Math.max(diaAtual, 1);
    const projecaoFimMes = Math.round(mediaDiaria * diasNoMes);

    const porCategoria = {};
    for (const g of despesas) {
      const nome = g.categoria?.nome || 'Geral';
      porCategoria[nome] = (porCategoria[nome] || 0) + Number(g.valor);
    }

    const categorias = Object.entries(porCategoria)
      .map(([nome, valor]) => ({ nome, valor: Math.round(valor), percentual: Math.round((valor / totalGasto) * 100) }))
      .sort((a, b) => b.valor - a.valor);

    const top3 = categorias.slice(0, 3);

    const renda = Number(user?.rendaMensalMedia) || 0;
    let avaliacao = '';
    if (renda > 0) {
      const percentualRenda = Math.round((totalGasto / renda) * 100);
      if (percentualRenda > 80) avaliacao = `Alerta: gastaste ${percentualRenda}% da renda. Controla o kumbú!`;
      else if (percentualRenda > 50) avaliacao = `Gastaste ${percentualRenda}% da renda. Ritmo controlado.`;
      else avaliacao = `Apenas ${percentualRenda}% da renda gasta. Tudo sob controlo!`;
    }

    return {
      periodo: `${inicioMes.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' })}`,
      totalGasto: Math.round(totalGasto),
      mediaDiaria: Math.round(mediaDiaria),
      projecaoFimMes,
      numTransacoes: despesas.length,
      ...(renda > 0 && { rendaMensal: Math.round(renda) }),
      topCategorias: top3,
      avaliacao
    };
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
