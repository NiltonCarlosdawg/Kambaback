const prisma = require('../lib/prisma');

// ==========================================
// FLUXOS GUIADOS (WIZARD CONVERSACIONAL)
// ==========================================

// Estado do wizard por usuário (em memória - pode mover para Redis/DB)
const wizardStates = new Map();

/**
 * Define os fluxos disponíveis
 */
const FLUXOS = {
  criar_meta: {
    nome: 'Criar Meta Financeira',
    passos: [
      {
        id: 'nome',
        pergunta: 'Fixe! 🎯 Qual é o nome da tua meta?\nExemplo: "Comprar moto", "Viagem para Cape Town"',
        validacao: (resp) => resp.length >= 3,
        erroMsg: 'Nome muito curto, kamba. Dá mais detalhes!'
      },
      {
        id: 'valor',
        pergunta: 'Top! 💰 Quanto precisas juntar?\nExemplo: 500000 (para 500 mil Kz)',
        validacao: (resp) => !isNaN(parseFloat(resp)) && parseFloat(resp) > 0,
        erroMsg: 'Preciso de um número válido, mano. Exemplo: 500000'
      },
      {
        id: 'prazo',
        pergunta: 'Beleza! 📅 Até quando queres atingir?\nExemplo: 12 (para 12 meses)',
        validacao: (resp) => !isNaN(parseInt(resp)) && parseInt(resp) > 0,
        erroMsg: 'Quantos meses, kamba? Exemplo: 6 ou 12'
      }
    ],
    concluir: async (dados, usuarioId) => {
      const valorAlvo = parseFloat(dados.valor);
      const prazoMeses = parseInt(dados.prazo);
      const mensal = valorAlvo / prazoMeses;

      const meta = await prisma.objetivo.create({
        data: {
          usuarioId,
          nome: dados.nome,
          valorAlvo,
          valorAtual: 0,
          prazo: new Date(Date.now() + prazoMeses * 30 * 24 * 60 * 60 * 1000),
          contribuicaoMensal: mensal,
          categoria: 'PESSOAL'
        }
      });

      return `🎉 Meta criada com sucesso, kamba!

📌 *${dados.nome}*
💰 Valor: ${valorAlvo.toLocaleString('pt-AO')} Kz
⏰ Prazo: ${prazoMeses} meses
📊 Contribuição mensal: ${mensal.toLocaleString('pt-AO')} Kz/mês

Vamos chegar lá juntos! 💪`;
    }
  },

  registar_gasto: {
    nome: 'Registar Gasto Rápido',
    passos: [
      {
        id: 'valor',
        pergunta: '💸 Quanto gastaste?\nExemplo: 5000',
        validacao: (resp) => !isNaN(parseFloat(resp)) && parseFloat(resp) > 0,
        erroMsg: 'Preciso de um valor, kamba. Exemplo: 5000'
      },
      {
        id: 'categoria',
        pergunta: '📂 Em que categoria?\n\n1️⃣ Alimentação\n2️⃣ Transporte\n3️⃣ Saúde\n4️⃣ Lazer\n5️⃣ Educação\n6️⃣ Outro',
        validacao: (resp) => ['1','2','3','4','5','6'].includes(resp),
        erroMsg: 'Escolhe um número de 1 a 6, mano!'
      },
      {
        id: 'descricao',
        pergunta: '📝 Descreve o gasto (opcional):\nExemplo: "Almoço no Oon.dah" ou manda "pular"',
        validacao: () => true, // Sempre válido
        opcional: true
      }
    ],
    concluir: async (dados, usuarioId) => {
      const categoriaMap = {
        '1': 'Alimentação',
        '2': 'Transporte', 
        '3': 'Saúde',
        '4': 'Lazer',
        '5': 'Educação',
        '6': 'Outro'
      };

      // Busca ou cria categoria
      let categoria = await prisma.categoria.findFirst({
        where: { 
          usuarioId, 
          nome: categoriaMap[dados.categoria] 
        }
      });

      if (!categoria) {
        categoria = await prisma.categoria.create({
          data: {
            usuarioId,
            nome: categoriaMap[dados.categoria],
            tipo: 'GASTO',
            cor: '#FF6B6B'
          }
        });
      }

      // Busca primeiro cartão ativo
      const cartao = await prisma.cartao.findFirst({
        where: { usuarioId, ativo: true }
      });

      if (!cartao) {
        return '❌ Precisas adicionar um cartão primeiro, kamba!';
      }

      const valor = parseFloat(dados.valor);

      // Cria gasto
      await prisma.gasto.create({
        data: {
          usuarioId,
          cartaoId: cartao.id,
          categoriaId: categoria.id,
          valor,
          descricao: dados.descricao !== 'pular' ? dados.descricao : `Gasto em ${categoriaMap[dados.categoria]}`,
          data: new Date()
        }
      });

      // Atualiza saldo do cartão
      await prisma.cartao.update({
        where: { id: cartao.id },
        data: { saldoAtual: { decrement: valor } }
      });

      return `✅ Gasto registado, kamba!

💸 Valor: ${valor.toLocaleString('pt-AO')} Kz
📂 Categoria: ${categoriaMap[dados.categoria]}
💳 Cartão: ${cartao.nome}

Saldo restante: ${(cartao.saldoAtual - valor).toLocaleString('pt-AO')} Kz`;
    }
  },

  analise_mensal: {
    nome: 'Análise do Mês',
    passos: [
      {
        id: 'confirmacao',
        pergunta: '📊 Queres uma análise completa deste mês?\n\n1️⃣ Sim, bora!\n2️⃣ Não, obrigado',
        validacao: (resp) => ['1','2','sim','não'].includes(resp.toLowerCase()),
        erroMsg: 'Responde 1 (sim) ou 2 (não), kamba!'
      }
    ],
    concluir: async (dados, usuarioId) => {
      if (['2','não'].includes(dados.confirmacao.toLowerCase())) {
        return 'Tranquilo, kamba! Quando quiseres, é só chamar. 👊';
      }

      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const fimMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const gastos = await prisma.gasto.findMany({
        where: {
          usuarioId,
          data: { gte: inicioMes, lte: fimMes },
          excluido: false
        },
        include: { categoria: true }
      });

      const totalGasto = gastos.reduce((acc, g) => acc + Number(g.valor), 0);
      
      // Agrupa por categoria
      const porCategoria = gastos.reduce((acc, g) => {
        const cat = g.categoria?.nome || 'Sem categoria';
        acc[cat] = (acc[cat] || 0) + Number(g.valor);
        return acc;
      }, {});

      const top3 = Object.entries(porCategoria)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, val]) => `• ${cat}: ${val.toLocaleString('pt-AO')} Kz`)
        .join('\n');

      return `📊 *Análise de ${new Date().toLocaleDateString('pt-AO', { month: 'long' })}*

💸 Total gasto: ${totalGasto.toLocaleString('pt-AO')} Kz
📝 Nº de transações: ${gastos.length}

🔥 Top 3 categorias:
${top3}

${totalGasto > 50000 ? '⚠️ Gastos elevados este mês, kamba! Controla aí.' : '✅ Tá dentro do esperado!'}`;
    }
  }
};

/**
 * Inicia um novo fluxo
 */
const iniciarFluxo = (usuarioId, tipoFluxo) => {
  const fluxo = FLUXOS[tipoFluxo];
  if (!fluxo) return null;

  const estado = {
    fluxo: tipoFluxo,
    passoAtual: 0,
    dados: {},
    iniciado: Date.now()
  };

  wizardStates.set(usuarioId, estado);
  return fluxo.passos[0].pergunta;
};

/**
 * Processa resposta no fluxo atual
 */
const processarRespostaFluxo = async (usuarioId, resposta) => {
  const estado = wizardStates.get(usuarioId);
  if (!estado) {
    return { 
      continuar: false, 
      mensagem: 'Nenhum fluxo ativo. Diz "criar meta" para começar!' 
    };
  }

  const fluxo = FLUXOS[estado.fluxo];
  const passoAtual = fluxo.passos[estado.passoAtual];

  // Validação
  if (!passoAtual.validacao(resposta.trim())) {
    return {
      continuar: true,
      mensagem: passoAtual.erroMsg
    };
  }

  // Salva resposta
  estado.dados[passoAtual.id] = resposta.trim();
  estado.passoAtual++;

  // Verifica se tem mais passos
  if (estado.passoAtual < fluxo.passos.length) {
    return {
      continuar: true,
      mensagem: fluxo.passos[estado.passoAtual].pergunta
    };
  }

  // Fluxo completo - executar ação
  const resultado = await fluxo.concluir(estado.dados, usuarioId);
  wizardStates.delete(usuarioId); // Limpa estado

  return {
    continuar: false,
    mensagem: resultado,
    concluido: true
  };
};

/**
 * Cancela fluxo atual
 */
const cancelarFluxo = (usuarioId) => {
  wizardStates.delete(usuarioId);
  return 'Fluxo cancelado, kamba! Qualquer coisa, é só chamar. 👊';
};

/**
 * Verifica se usuário tem fluxo ativo
 */
const temFluxoAtivo = (usuarioId) => {
  return wizardStates.has(usuarioId);
};

/**
 * Detecta intenção de iniciar fluxo
 */
const detectarIntencaoFluxo = (mensagem) => {
  const msg = mensagem.toLowerCase();

  if (msg.includes('criar meta') || msg.includes('nova meta') || msg.includes('objetivo')) {
    return 'criar_meta';
  }

  if (msg.includes('registar gasto') || msg.includes('adicionar gasto') || msg.includes('gastei')) {
    return 'registar_gasto';
  }

  if (msg.includes('análise') || msg.includes('analise') || msg.includes('resumo do mês')) {
    return 'analise_mensal';
  }

  return null;
};

/**
 * Lista fluxos disponíveis
 */
const listarFluxos = () => {
  return `🧭 *Fluxos Disponíveis:*

${Object.entries(FLUXOS).map(([key, fluxo], i) => 
  `${i+1}️⃣ ${fluxo.nome}`
).join('\n')}

Diz o nome do fluxo para começar!
Exemplo: "criar meta" ou "registar gasto"`;
};

module.exports = {
  iniciarFluxo,
  processarRespostaFluxo,
  cancelarFluxo,
  temFluxoAtivo,
  detectarIntencaoFluxo,
  listarFluxos,
  FLUXOS
};