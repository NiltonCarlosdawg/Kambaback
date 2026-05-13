const prisma = require('../../../../lib/prisma');

const DICAS = {
  Alimentação: [
    'Cozinhar em casa pode poupar até 60% comparado a comer fora. Tenta levar marmita 3x por semana!',
    'Faz lista de compras antes de ir ao mercado e evita compras por impulso.',
    'Compra produtos da época e em mercados locais - são mais baratos que nos supermercados.',
  ],
  Transporte: [
    'Combinar boleias com colegas de trabalho pode reduzir teus gastos de transporte em 40%.',
    'Para curtas distâncias, caminhar é grátis e ainda faz bem à saúde!',
    'Se usas candongueiro diariamente, verifica se um passe mensal compensa mais.',
  ],
  Lazer: [
    'Define um teto mensal para lazer e controla com a app. Diversão com limite é mais gostosa!',
    'Troca alguns programas pagos por opções grátis: miradouro, praia, parques.',
    'Aproveita promoções e dias de desconto em cinemas e restaurantes.',
  ],
  Saúde: [
    'Prevenir é mais barato que tratar. Mantém exames de rotina em dia.',
    'Compara preços de medicamentos genéricos vs. originais - podes poupar até 70%.',
    'Farmácias têm dias de desconto. Programa tuas compras de medicamentos.',
  ],
  Educação: [
    'Aproveita cursos online grátis antes de investir em certificações pagas.',
    'Bibliotecas públicas e grupos de estudo são alternativas económicas.',
  ],
  Geral: [
    'Regra 50/30/20: 50% para necessidades, 30% para desejos, 20% para poupança.',
    'Antes de comprar algo não urgente, espera 24h. Muitas compras por impulso são evitadas.',
    'Revê tuas assinaturas mensais (streaming, apps). Cancele as que não usas.',
    'Poupar 10% de cada receita assim que cai na conta é mais fácil que poupar o que sobra.',
  ]
};

module.exports = {
  name: 'getDicasPoupanca',
  description: 'Gera dicas de poupança personalizadas baseadas no perfil de gastos do utilizador. Chamar quando o utilizador pede dicas de poupança ou economia.',
  handler: async (_, context) => {
    const usuarioId = context.usuarioId;
    const mes30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [gastosRecentes, userPrefs] = await Promise.all([
      prisma.gasto.findMany({
        where: {
          usuarioId,
          data: { gte: mes30Dias },
          excluido: false,
          tipo: 'DESPESA'
        },
        include: { categoria: { select: { nome: true } } }
      }),
      prisma.kambaPreferencias.findUnique({ where: { usuarioId } })
    ]);

    const totalGasto = gastosRecentes.reduce((acc, g) => acc + Number(g.valor), 0);
    const porCategoria = {};
    for (const g of gastosRecentes) {
      const nome = g.categoria?.nome || 'Geral';
      porCategoria[nome] = (porCategoria[nome] || 0) + Number(g.valor);
    }

    const catOrdenadas = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1]);

    const maiorCategoria = catOrdenadas[0]?.[0] || 'Geral';
    const dicas = DICAS[maiorCategoria] || DICAS.Geral;

    const dicasSelecionadas = dicas
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    let contextoPessoal = '';
    if (userPrefs?.temNegocio) {
      contextoPessoal = ' Como tens um negócio, separa as finanças pessoais das do negócio para melhor controlo.';
    }
    if (userPrefs?.preocupaComDolar) {
      contextoPessoal += ' Diversificar em dólar pode proteger, mas não deixes todo o kumbú numa moeda só.';
    }

    return {
      totalGasto: Math.round(totalGasto),
      maiorCategoria,
      dicas: dicasSelecionadas,
      contextoPessoal: contextoPessoal.trim()
    };
  },
  parameters: { type: 'object', properties: {} },
  category: 'knowledge'
};
