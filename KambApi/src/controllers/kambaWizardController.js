// src/controllers/kambaWizardController.js
const prisma = require('../lib/prisma');

// ==========================================
// ESTADO DOS FLUXOS (em memória - pode mover para Redis/DB em produção)
// ==========================================
const wizardStates = new Map();

// ==========================================
// DEFINIÇÃO DOS FLUXOS DISPONÍVEIS
// ==========================================
const FLUXOS = {
  criar_meta: {
    nome: 'Criar Meta Financeira',
    passos: [
      {
        id: 'nome',
        pergunta: 'Fixe! 🎯 Qual é o nome da tua meta?\nExemplo: "Comprar moto", "Viagem para Cape Town"',
        validacao: (resp) => resp && resp.trim().length >= 3,
        erroMsg: 'Nome muito curto, kamba. Dá mais detalhes (mínimo 3 caracteres)!'
      },
      {
        id: 'valor',
        pergunta: 'Top! 💰 Quanto precisas juntar?\nExemplo: 500000 (para 500 mil Kz)',
        validacao: (resp) => {
          const num = parseFloat(resp);
          return !isNaN(num) && num > 0 && num < 1000000000; // Máximo 1 bilhão (sanidade)
        },
        erroMsg: 'Preciso de um número válido entre 1 e 1.000.000.000 Kz, mano. Exemplo: 500000'
      },
      {
        id: 'prazo',
        pergunta: 'Beleza! 📅 Até quando queres atingir?\nExemplo: 12 (para 12 meses)',
        validacao: (resp) => {
          const num = parseInt(resp);
          return !isNaN(num) && num > 0 && num <= 120; // Máximo 10 anos
        },
        erroMsg: 'Quantos meses, kamba? Use um número entre 1 e 120. Exemplo: 6 ou 12'
      }
    ],
    concluir: async (dados, usuarioId) => {
      try {
        const valorAlvo = parseFloat(dados.valor);
        const prazoMeses = parseInt(dados.prazo);
        const mensal = valorAlvo / prazoMeses;

        // Validar data futura
        const dataPrazo = new Date();
        dataPrazo.setMonth(dataPrazo.getMonth() + prazoMeses);

        const meta = await prisma.objetivo.create({
          data: {
            usuarioId,
            titulo: dados.nome.trim(),
            valorAlvo,
            valorAtual: 0,
            dataPrevista: dataPrazo,
            descricao: `Meta: poupar ${valorAlvo.toLocaleString('pt-AO')} Kz em ${prazoMeses} meses (${mensal.toLocaleString('pt-AO')} Kz/mês)`,
            categoria: 'PESSOAL',
            prioridade: 'MEDIA',
            cor: '#10b981',
            icone: 'target',
            excluido: false,
            concluido: false
          }
        });

        return `🎉 Meta criada com sucesso, kamba!

*${dados.nome}*
💰 Valor: ${valorAlvo.toLocaleString('pt-AO')} Kz
📅 Prazo: ${prazoMeses} meses (até ${dataPrazo.toLocaleDateString('pt-AO')})
💵 Contribuição mensal: ${mensal.toLocaleString('pt-AO')} Kz/mês

Vamos chegar lá juntos! 💪`;
      } catch (err) {
        console.error('[WIZARD] Erro ao criar meta:', err);
        return '❌ Eish, deu erro ao salvar a meta. Tenta novamente ou fala com o suporte.';
      }
    }
  },

  registar_gasto: {
    nome: 'Registar Gasto Rápido',
    passos: [
      {
        id: 'valor',
        pergunta: '💸 Quanto gastaste?\nExemplo: 5000',
        validacao: (resp) => {
          const num = parseFloat(resp);
          return !isNaN(num) && num > 0 && num < 100000000; // Máximo 100 milhões
        },
        erroMsg: 'Preciso de um valor válido, kamba. Exemplo: 5000 (máx 100.000.000 Kz)'
      },
      {
        id: 'categoria',
        pergunta: '📂 Em que categoria?\n\n1️⃣ Alimentação\n2️⃣ Transporte\n3️⃣ Saúde\n4️⃣ Lazer\n5️⃣ Educação\n6️⃣ Outro',
        validacao: (resp) => ['1','2','3','4','5','6'].includes(resp.trim()),
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
      try {
        const categoriaMap = {
          '1': 'Alimentação',
          '2': 'Transporte', 
          '3': 'Saúde',
          '4': 'Lazer',
          '5': 'Educação',
          '6': 'Outro'
        };

        const nomeCategoria = categoriaMap[dados.categoria];
        const valor = parseFloat(dados.valor);

        // Busca ou cria categoria
        let categoria = await prisma.categoria.findFirst({
          where: { 
            usuarioId, 
            nome: nomeCategoria,
            excluido: false
          }
        });

        if (!categoria) {
          // Verifica se existe categoria padrão
          categoria = await prisma.categoria.findFirst({
            where: {
              padrao: true,
              nome: nomeCategoria,
              excluido: false
            }
          });
          
          // Se não encontrar, cria uma personalizada
          if (!categoria) {
            categoria = await prisma.categoria.create({
              data: {
                usuarioId,
                nome: nomeCategoria,
                tipo: 'FLEXIVEL',
                cor: '#FF6B6B',
                icone: 'category',
                padrao: false,
                excluido: false
              }
            });
          }
        }

        // Busca primeiro cartão ativo do usuário
        const cartao = await prisma.cartao.findFirst({
          where: { 
            usuarioId, 
            ativo: true,
            excluido: false
          }
        });

        if (!cartao) {
          return '⚠️ Precisas adicionar um cartão primeiro, kamba! Vai em "Cartões" e adiciona um.';
        }

        // Verifica saldo disponível
        if (cartao.saldoAtual < valor) {
          return `⚠️ Saldo insuficiente no cartão ${cartao.nome}!\nTens apenas ${cartao.saldoAtual.toLocaleString('pt-AO')} Kz disponíveis.`;
        }

        // Executa em transação: cria gasto + atualiza saldo
        const resultado = await prisma.$transaction(async (tx) => {
          // Cria gasto
          const gasto = await tx.gasto.create({
            data: {
              usuarioId,
              cartaoId: cartao.id,
              categoriaId: categoria.id,
              valor,
              descricao: dados.descricao && dados.descricao.toLowerCase() !== 'pular' 
                ? dados.descricao.trim() 
                : `Gasto em ${nomeCategoria}`,
              tipo: 'DESPESA',
              data: new Date(),
              excluido: false,
              local: null,
              tags: []
            }
          });

          // Atualiza saldo do cartão
          const novoSaldo = cartao.saldoAtual - valor;
          await tx.cartao.update({
            where: { id: cartao.id },
            data: { 
              saldoAtual: novoSaldo,
              saldoDisponivel: novoSaldo
            }
          });

          return gasto;
        });

        return `✅ Gasto registado, kamba!

💸 Valor: ${valor.toLocaleString('pt-AO')} Kz
📂 Categoria: ${nomeCategoria}
💳 Cartão: ${cartao.nome}
📝 Descrição: ${resultado.descricao}

Saldo restante: ${(cartao.saldoAtual - valor).toLocaleString('pt-AO')} Kz`;
      } catch (err) {
        console.error('[WIZARD] Erro ao registar gasto:', err);
        return '❌ Eish, deu erro ao registar o gasto. Verifica se tens cartão ativo e tenta novamente.';
      }
    }
  },

  analise_mensal: {
    nome: 'Análise do Mês',
    passos: [
      {
        id: 'confirmacao',
        pergunta: '📊 Queres uma análise completa deste mês?\n\n1️⃣ Sim, bora!\n2️⃣ Não, obrigado',
        validacao: (resp) => ['1','2','sim','não', 'nao'].includes(resp.trim().toLowerCase()),
        erroMsg: 'Responde 1 (sim) ou 2 (não), kamba!'
      }
    ],
    concluir: async (dados, usuarioId) => {
      try {
        const resposta = dados.confirmacao.toLowerCase().trim();
        if (['2','não','nao'].includes(resposta)) {
          return 'Tranquilo, kamba! Quando quiseres, é só chamar. 👊';
        }

        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

        const gastos = await prisma.gasto.findMany({
          where: {
            usuarioId,
            data: { gte: inicioMes, lte: fimMes },
            excluido: false,
            tipo: 'DESPESA'
          },
          include: { categoria: true },
          orderBy: { valor: 'desc' }
        });

        if (gastos.length === 0) {
          return `📊 *Análise de ${hoje.toLocaleDateString('pt-AO', { month: 'long' })}*

Nenhum gasto registado este mês, kamba! Tá tudo parado ou és mestre da poupança? 😄

Registra tuas despesas para eu poder analisar melhor.`;
        }

        const totalGasto = gastos.reduce((acc, g) => acc + Number(g.valor), 0);
        
        // Agrupa por categoria
        const porCategoria = gastos.reduce((acc, g) => {
          const cat = g.categoria?.nome || 'Sem categoria';
          if (!acc[cat]) {
            acc[cat] = { total: 0, count: 0 };
          }
          acc[cat].total += Number(g.valor);
          acc[cat].count += 1;
          return acc;
        }, {});

        const top3 = Object.entries(porCategoria)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 3)
          .map(([cat, dados]) => `• ${cat}: ${dados.total.toLocaleString('pt-AO')} Kz (${dados.count}x)`)
          .join('\n');

        // Calcula média diária
        const diasPassados = hoje.getDate();
        const mediaDiaria = totalGasto / diasPassados;

        // Alerta inteligente
        let alerta = '';
        if (totalGasto > 100000) {
          alerta = '\n\n🔥 Gastos elevados este mês, kamba! Controla aí o kumbú.';
        } else if (totalGasto < 10000) {
          alerta = '\n\n💚 Tás a poupar bem, boa camba!';
        }

        return `📊 *Análise de ${hoje.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' })}*

💸 Total gasto: ${totalGasto.toLocaleString('pt-AO')} Kz
📝 Transações: ${gastos.length}
📅 Média diária: ${mediaDiaria.toLocaleString('pt-AO')} Kz

🔥 Top 3 categorias:
${top3}
${alerta}`;
      } catch (err) {
        console.error('[WIZARD] Erro na análise:', err);
        return '❌ Deu erro ao gerar a análise, kamba. Tenta mais tarde.';
      }
    }
  }
};

// ==========================================
// FUNÇÕES EXPORTADAS
// ==========================================

/**
 * Inicia um novo fluxo
 */
const iniciarFluxo = (usuarioId, tipoFluxo) => {
  const fluxo = FLUXOS[tipoFluxo];
  if (!fluxo) return null;

  // Limpa estado anterior se existir
  wizardStates.delete(usuarioId);

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
  
  if (!fluxo) {
    wizardStates.delete(usuarioId);
    return {
      continuar: false,
      mensagem: 'Fluxo inválido. Começa de novo.'
    };
  }

  const passoAtual = fluxo.passos[estado.passoAtual];

  // Validação
  if (!passoAtual.validacao(resposta.trim())) {
    return {
      continuar: true,
      mensagem: `❌ ${passoAtual.erroMsg}\n\n${passoAtual.pergunta}`
    };
  }

  // Salva resposta (trim e sanitize básico)
  estado.dados[passoAtual.id] = resposta.trim().replace(/[<>]/g, ''); // Remove tags HTML básicas
  estado.passoAtual++;

  // Verifica se tem mais passos
  if (estado.passoAtual < fluxo.passos.length) {
    return {
      continuar: true,
      mensagem: fluxo.passos[estado.passoAtual].pergunta
    };
  }

  // Fluxo completo - executar ação
  try {
    const resultado = await fluxo.concluir(estado.dados, usuarioId);
    wizardStates.delete(usuarioId); // Limpa estado após conclusão
    
    return {
      continuar: false,
      mensagem: resultado,
      concluido: true
    };
  } catch (err) {
    console.error('[WIZARD] Erro ao concluir fluxo:', err);
    wizardStates.delete(usuarioId);
    
    return {
      continuar: false,
      mensagem: '❌ Deu erro ao processar, kamba. Tenta novamente.',
      concluido: false,
      erro: true
    };
  }
};

/**
 * Cancela fluxo atual
 */
const cancelarFluxo = (usuarioId) => {
  const tinhaFluxo = wizardStates.has(usuarioId);
  wizardStates.delete(usuarioId);
  return tinhaFluxo 
    ? 'Fluxo cancelado, kamba! Qualquer coisa, é só chamar. 👋'
    : 'Não tinha nenhum fluxo ativo, mano.';
};

/**
 * Verifica se usuário tem fluxo ativo
 */
const temFluxoAtivo = (usuarioId) => {
  // Limpar fluxos antigos (mais de 30 minutos) - prevenir vazamento de memória
  const agora = Date.now();
  for (const [uid, estado] of wizardStates.entries()) {
    if (agora - estado.iniciado > 30 * 60 * 1000) { // 30 minutos
      wizardStates.delete(uid);
    }
  }
  
  return wizardStates.has(usuarioId);
};

/**
 * Detecta intenção de iniciar fluxo
 */
const detectarIntencaoFluxo = (mensagem) => {
  if (!mensagem || typeof mensagem !== 'string') return null;
  
  const msg = mensagem.toLowerCase().trim();

  if (msg.includes('criar meta') || msg.includes('nova meta') || msg.includes('novo objetivo') || msg.includes('objetivo')) {
    return 'criar_meta';
  }

  if (msg.includes('registar gasto') || msg.includes('adicionar gasto') || msg.includes('gastei') || msg.includes('despesa')) {
    return 'registar_gasto';
  }

  if (msg.includes('análise') || msg.includes('analise') || msg.includes('resumo do mês') || msg.includes('como vou')) {
    return 'analise_mensal';
  }

  return null;
};

/**
 * Lista fluxos disponíveis
 */
const listarFluxos = () => {
  return `🧙‍♂️ *Fluxos Disponíveis:*

${Object.entries(FLUXOS).map(([key, fluxo], i) => 
  `${i+1}️⃣ *${fluxo.nome}*`
).join('\n')}

Diz o nome do fluxo para começar!
Exemplos: "criar meta", "registar gasto" ou "análise"`;
};

// ==========================================
// EXPORTAÇÕES
// ==========================================
module.exports = {
  iniciarFluxo,
  processarRespostaFluxo,
  cancelarFluxo,
  temFluxoAtivo,
  detectarIntencaoFluxo,
  listarFluxos,
  FLUXOS
};