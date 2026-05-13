const prisma = require('../../../../lib/prisma');

const CATEGORIAS_NECESSIDADES = ['Alimentação', 'Transporte', 'Saúde', 'Casa', 'Moradia'];
const CATEGORIAS_DESEJOS = ['Lazer', 'Vestuário', 'Assinaturas', 'Restaurante'];

module.exports = {
  name: 'getPlaneamentoMensal',
  description: 'Cria um plano orçamental mensal baseado na regra 50/30/20 (necessidades/desejos/poupança) usando a renda do utilizador. Chamar quando o utilizador pedir planeamento orçamental mensal.',
  handler: async (_, context) => {
    const usuarioId = context.usuarioId;
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const diasPassados = hoje.getDate();

    const [user, gastosMes] = await Promise.all([
      prisma.user.findUnique({
        where: { id: usuarioId },
        select: { rendaMensalMedia: true, nome: true }
      }),
      prisma.gasto.findMany({
        where: {
          usuarioId,
          data: { gte: inicioMes },
          excluido: false,
          tipo: 'DESPESA'
        },
        include: { categoria: { select: { nome: true } } }
      })
    ]);

    const renda = Number(user?.rendaMensalMedia) || 0;
    if (renda === 0) {
      return {
        plano: null,
        mensagem: 'Precisas de definir a tua renda mensal média nas configurações para eu criar um plano.'
      };
    }

    const orcamentoNecessidades = renda * 0.50;
    const orcamentoDesejos = renda * 0.30;
    const orcamentoPoupanca = renda * 0.20;

    let gastoNecessidades = 0;
    let gastoDesejos = 0;
    let gastoOutros = 0;

    for (const g of gastosMes) {
      const nomeCat = g.categoria?.nome || 'Outros';
      const valor = Number(g.valor);
      if (CATEGORIAS_NECESSIDADES.some(c => nomeCat.toLowerCase().includes(c.toLowerCase()))) {
        gastoNecessidades += valor;
      } else if (CATEGORIAS_DESEJOS.some(c => nomeCat.toLowerCase().includes(c.toLowerCase()))) {
        gastoDesejos += valor;
      } else {
        gastoOutros += valor;
      }
    }

    const totalGasto = gastoNecessidades + gastoDesejos + gastoOutros;
    const saldoRestante = renda - totalGasto;

    const mediaDiaria = totalGasto / Math.max(diasPassados, 1);
    const projecaoGasto = Math.round(mediaDiaria * 30);

    const categorizar = (gasto, orcamento, nome) => {
      const percentual = Math.round((gasto / Math.max(orcamento, 1)) * 100);
      const restante = Math.round(orcamento - gasto);
      return {
        orcamento: Math.round(orcamento),
        gastoActual: Math.round(gasto),
        restante: Math.max(0, restante),
        percentualUtilizado: Math.min(100, percentual),
        status: percentual > 100 ? 'excedido' : percentual > 80 ? 'atencao' : 'ok'
      };
    };

    return {
      rendaMensal: Math.round(renda),
      periodo: inicioMes.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' }),
      planeamento: {
        necessidades: categorizar(gastoNecessidades, orcamentoNecessidades, 'Necessidades'),
        desejos: categorizar(gastoDesejos, orcamentoDesejos, 'Desejos'),
        poupanca: {
          orcamento: Math.round(orcamentoPoupanca),
          gastoActual: Math.round(gastoOutros),
          restante: Math.max(0, Math.round(orcamentoPoupanca - gastoOutros)),
          percentualUtilizado: Math.min(100, Math.round((gastoOutros / Math.max(orcamentoPoupanca, 1)) * 100))
        }
      },
      saldoRestante: Math.max(0, Math.round(saldoRestante)),
      projecaoFimMes: Math.round(projecaoGasto),
      dica: saldoRestante > 0
        ? `Tens ${Math.round(saldoRestante).toLocaleString('pt-AO')} AOA de margem este mês. Guarda pelo menos parte para o fundo de emergência!`
        : 'Estás a gastar mais do que ganhas. Vamos rever teus gastos para ajustar o orçamento.'
    };
  },
  parameters: { type: 'object', properties: {} },
  category: 'financial'
};
