const prisma = require('../../../../lib/prisma');

const ZONAS_LUANDA = {
  alta: ['miramar', 'alvalade', 'talatona', 'belas', 'benfica', 'ilha', 'bay', 'atlântico', 'atlantico'],
  media: ['kilamba', 'sequele', 'camama', 'viana', 'mulenvos', 'centralidade', 'patriota', 'zango'],
  baixa: ['cazenga', 'rangel', 'hoji', 'sambizanga', 'cacuaco', 'palanca', 'marçal', 'cassequel', 'lixeira', 'rocha pinto', 'terra nova'],
  centro: ['ingombota', 'maianga', 'samba', 'prenda', 'vila alice', 'mutamba']
};

const detectarZona = (morada) => {
  if (!morada) return 'desconhecida';
  const m = morada.toLowerCase();
  for (const [zona, palavras] of Object.entries(ZONAS_LUANDA)) {
    if (palavras.some(p => m.includes(p))) return zona;
  }
  return 'desconhecida';
};

const IDEIAS_POR_ZONA = {
  alta: {
    micro: [
      { nome: 'Personal Shopper / Compras no Exterior', investimento: 30000, retorno: '50-100% por viagem', descricao: 'Clientes de alta renda pagam bem por conveniência' },
      { nome: 'Delivery premium de comida caseira', investimento: 50000, retorno: '40-60% ao mês', descricao: 'Marmitas gourmet para executivos em Talatona/Miramar' },
      { nome: 'Aulas particulares (idiomas, informática)', investimento: 10000, retorno: '60-80% ao mês', descricao: 'Alta procura em zonas com expatriados e classe alta' }
    ]
  },
  media: {
    micro: [
      { nome: 'Mini-supermercado de bairro', investimento: 200000, retorno: '20-30% ao mês', descricao: 'Alta densidade populacional no Kilamba e Sequele' },
      { nome: 'Cabeleireiro/Barbearia', investimento: 150000, retorno: '25-40% ao mês', descricao: 'Mercado crescente nas novas centralidades' },
      { nome: 'Venda de refeições na hora do almoço', investimento: 40000, retorno: '35-50% ao mês', descricao: 'Muitos trabalhadores longe do centro, sem opções próximas' }
    ]
  },
  baixa: {
    micro: [
      { nome: 'Revenda no Zango / Roque Santeiro', investimento: 20000, retorno: '30-50% ao mês', descricao: 'Mercados de revenda são a espinha dorsal da economia local' },
      { nome: 'Venda ambulante (zunga)', investimento: 15000, retorno: '20-40% ao mês', descricao: 'Baixo investimento, alta rotatividade' },
      { nome: 'Fotocópias e serviços de impressão', investimento: 80000, retorno: '30-50% ao mês', descricao: 'Alta procura em zonas com escolas e repartições' }
    ]
  }
};

module.exports = {
  name: 'getIdeiasNegocio',
  description: 'Fornece ideias de negócio adaptadas ao capital disponível e realidade angolana. Chamar APENAS quando o utilizador mencionar querer começar um negócio.',
  handler: async (params, context) => {
    const [cartoes, userGeo] = await Promise.all([
      prisma.cartao.aggregate({
        where: { usuarioId: context.usuarioId, ativo: true, excluido: false },
        _sum: { saldoAtual: true }
      }),
      prisma.user.findUnique({
        where: { id: context.usuarioId },
        select: { morada: true }
      }).catch(() => null)
    ]);
    const saldoReal = Number(cartoes._sum.saldoAtual) || 0;
    const capitalDaConversa = Number(params?.capital) || 0;

    let capitalNum = saldoReal > 0 ? saldoReal : (capitalDaConversa > 0 ? capitalDaConversa : 50000);
    const saldoOficial = saldoReal > 0 ? Math.round(saldoReal) : null;

    const ideias = {
      micro: [
        { nome: 'Venda de bebidas', investimento: 20000, retorno: '20-30% ao mês', descricao: 'Compra em grosso e revenda em zonas movimentadas' },
        { nome: 'Reparação de telemóveis', investimento: 50000, retorno: '40-60% ao mês', descricao: 'Ecrãs, baterias, acessórios' },
        { nome: 'Venda de roupas usadas', investimento: 30000, retorno: '50-100% ao mês', descricao: 'Compra no Zango e revende no bairro' },
        { nome: 'Marmitas caseiras', investimento: 25000, retorno: '30-50% ao mês', descricao: 'Cozinha em casa e vende em empresas' },
        { nome: 'Transporte (kupapata)', investimento: 80000, retorno: '25-35% ao mês', descricao: 'Aluga mota ou compra usada' }
      ],
      pequeno: [
        { nome: 'Minimercado / Quiosque', investimento: 300000, retorno: '15-25% ao mês', descricao: 'Venda de produtos básicos no bairro' },
        { nome: 'Papelaria', investimento: 150000, retorno: '20-30% ao mês', descricao: 'Alta procura em época de aulas' },
        { nome: 'Cabeleireiro', investimento: 200000, retorno: '25-40% ao mês', descricao: 'Com equipamentos básicos começas já' },
        { nome: 'Serviços digitais', investimento: 50000, retorno: '50-100% ao projecto', descricao: 'Gerencia redes sociais' },
        { nome: 'Acessórios telemóveis', investimento: 100000, retorno: '30-50% ao mês', descricao: 'Capas, carregadores, fones' }
      ],
      medio: [
        { nome: 'Transporte (candongueiro)', investimento: 1500000, retorno: '20-30% ao mês', descricao: 'Compra van usada ou aluga' },
        { nome: 'Loja de roupa nova', investimento: 800000, retorno: '20-35% ao mês', descricao: 'Importa da Turquia ou China' },
        { nome: 'Materiais de construção', investimento: 2000000, retorno: '15-25% ao mês', descricao: 'Alta procura em Luanda' }
      ]
    };

    let categoria = capitalNum <= 100000 ? 'micro' : capitalNum <= 500000 ? 'pequeno' : 'medio';

    const zona = detectarZona(userGeo?.morada);
    const ideiasZona = IDEIAS_POR_ZONA[zona]?.[categoria] || [];

    const resultado = {
      capitalDisponivel: Math.round(capitalNum),
      categoria,
      ideias: ideias[categoria].slice(0, 5),
      dicaGeral: 'Começa com o que sabes fazer melhor. Não invistas tudo de uma vez. Testa primeiro!',
      zona: zona !== 'desconhecida' ? zona : null,
      ideiasAdaptadasZona: ideiasZona.length > 0 ? ideiasZona : null,
      notaGeografica: zona !== 'desconhecida'
        ? `Sugestões adaptadas para a zona ${zona === 'alta' ? 'premium' : zona === 'media' ? 'de classe média' : zona === 'baixa' ? 'popular' : 'central'} de Luanda`
        : null
    };

    if (saldoOficial && capitalDaConversa > 0 && saldoOficial !== capitalDaConversa) {
      resultado.discrepanciaCapital = {
        saldoRegistado: saldoOficial,
        valorMencionado: capitalDaConversa,
        mensagem: `O sistema mostra ${saldoOficial.toLocaleString('pt-AO')} AOA registados, mas ${capitalDaConversa.toLocaleString('pt-AO')} AOA foi o valor mencionado. Estás a usar o valor correcto?`
      };
    }

    return resultado;
  },
  parameters: {
    type: 'object',
    properties: {
      capital: { type: 'number', description: 'Capital disponível em kwanzas (AOA). Opcional — se não for passado, o sistema busca o saldo real do utilizador.' }
    }
  },
  category: 'knowledge'
};
