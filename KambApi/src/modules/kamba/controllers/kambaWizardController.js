// src/controllers/kambaWizardController.js
const prisma = require('../../../lib/prisma');

// ==========================================
// ESTADO DOS FLUXOS
// NOTA: Em produção migrar para Redis (evita perda de estado em deploy/restart)
// Ver: services/wizardStateService.js (implementação Redis)
// ==========================================
const wizardStates = new Map();

// Mutex simples para evitar race conditions em requests simultâneos do mesmo user
const wizardLocks = new Map();

const acquireLock = async (usuarioId, timeout = 3000) => {
  const inicio = Date.now();
  while (wizardLocks.get(usuarioId)) {
    if (Date.now() - inicio > timeout) return false;
    await new Promise(r => setTimeout(r, 50));
  }
  wizardLocks.set(usuarioId, true);
  return true;
};

const releaseLock = (usuarioId) => {
  wizardLocks.delete(usuarioId);
};

// ==========================================
// DEFINIÇÃO DOS FLUXOS
// ==========================================
const FLUXOS = {
  criar_meta: {
    nome: 'Criar Meta Financeira',
    icone: '🎯',
    passos: [
      {
        id: 'nome',
        pergunta: '🎯 Fixe! Qual é o nome da tua meta?\nExemplo: "Comprar moto", "Viagem para Benguela", "Trocar de telemóvel"',
        validacao: (resp) => resp && resp.trim().length >= 3 && resp.trim().length <= 100,
        erroMsg: 'Nome muito curto ou longo, kamba. Entre 3 e 100 caracteres. Exemplo: "Comprar moto"'
      },
      {
        id: 'valor',
        pergunta: '💰 Quanto precisas juntar em AOA?\nExemplo: 500000 (para 500 mil Kwanzas)',
        validacao: (resp) => {
          const num = parseFloat(resp.replace(/[.,\s]/g, '').replace(',', '.'));
          return !isNaN(num) && num > 0 && num < 1_000_000_000;
        },
        transform: (resp) => resp.replace(/[.\s]/g, '').replace(',', '.'), // normaliza input
        erroMsg: 'Preciso de um valor válido, kamba. Exemplo: 500000 (máx 1 bilião AOA)'
      },
      {
        id: 'prazo',
        pergunta: '📅 Em quantos meses queres atingir?\nExemplo: 6 (para 6 meses), 12 (para 1 ano)',
        validacao: (resp) => {
          const num = parseInt(resp);
          return !isNaN(num) && num > 0 && num <= 120;
        },
        erroMsg: 'Quantos meses, kamba? Use um número entre 1 e 120. Exemplo: 6 ou 12'
      }
    ],
    concluir: async (dados, usuarioId) => {
      try {
        const valorAlvo = parseFloat(dados.valor);
        const prazoMeses = parseInt(dados.prazo);
        const mensal = Math.ceil(valorAlvo / prazoMeses);

        const dataPrazo = new Date();
        dataPrazo.setMonth(dataPrazo.getMonth() + prazoMeses);

        const meta = await prisma.objetivo.create({
          data: {
            usuarioId,
            titulo: dados.nome.trim(),
            valorAlvo,
            valorAtual: 0,
            dataPrevista: dataPrazo,
            descricao: `Meta: poupar ${valorAlvo.toLocaleString('pt-AO')} AOA em ${prazoMeses} meses`,
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
💰 Valor alvo: ${valorAlvo.toLocaleString('pt-AO')} AOA
📅 Prazo: ${prazoMeses} meses (até ${dataPrazo.toLocaleDateString('pt-AO')})
💵 Poupar por mês: ${mensal.toLocaleString('pt-AO')} AOA

Vamos chegar lá juntos! Digita "como vão meus objetivos?" a qualquer momento para ver o progresso. 💪`;
      } catch (err) {
        console.error('[WIZARD] Erro ao criar meta:', err);
        return '❌ Eish, deu erro ao salvar a meta. Tenta novamente ou contacta o suporte.';
      }
    }
  },

  registar_gasto: {
    nome: 'Registar Gasto Rápido',
    icone: '💸',
    passos: [
      {
        id: 'valor',
        pergunta: '💸 Quanto gastaste (em AOA)?\nExemplo: 5000',
        validacao: (resp) => {
          const num = parseFloat(resp.replace(/[.\s]/g, '').replace(',', '.'));
          return !isNaN(num) && num > 0 && num < 100_000_000;
        },
        transform: (resp) => resp.replace(/[.\s]/g, '').replace(',', '.'),
        erroMsg: 'Preciso de um valor válido, kamba. Exemplo: 5000 (máx 100 milhões AOA)'
      },
      {
        id: 'categoria',
        pergunta: '📂 Em que categoria?\n\n1️⃣ Alimentação\n2️⃣ Transporte\n3️⃣ Saúde\n4️⃣ Lazer\n5️⃣ Educação\n6️⃣ Outro\n\nResponde com o número.',
        validacao: (resp) => ['1', '2', '3', '4', '5', '6'].includes(resp.trim()),
        erroMsg: 'Escolhe um número de 1 a 6, mano!'
      },
      {
        id: 'descricao',
        pergunta: '📝 Descreve o gasto (ou manda "pular"):\nExemplo: "Almoço no restaurante", "Candongueiro para o trabalho"',
        validacao: () => true,
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

        // Busca ou cria categoria para o utilizador
        let categoria = await prisma.categoria.findFirst({
          where: { usuarioId, nome: nomeCategoria, excluido: false }
        });

        if (!categoria) {
          // Verifica categoria padrão do sistema
          categoria = await prisma.categoria.findFirst({
            where: { padrao: true, nome: nomeCategoria, excluido: false }
          });

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

        // Busca cartão principal ativo
        const cartao = await prisma.cartao.findFirst({
          where: { usuarioId, ativo: true, excluido: false },
          orderBy: { saldoAtual: 'desc' } // Usa o cartão com mais saldo por padrão
        });

        if (!cartao) {
          return '⚠️ Precisas adicionar um cartão ou conta primeiro, kamba! Vai em "Cartões" na app e adiciona.';
        }

        if (cartao.saldoAtual < valor) {
          return `⚠️ Saldo insuficiente na conta *${cartao.nome}*!\nTens apenas ${cartao.saldoAtual.toLocaleString('pt-AO')} AOA disponíveis. Tens outra conta?`;
        }

        // Transação atómica: cria gasto + atualiza saldo
        const resultado = await prisma.$transaction(async (tx) => {
          const descricaoFinal = dados.descricao && dados.descricao.toLowerCase() !== 'pular'
            ? dados.descricao.trim()
            : `Gasto em ${nomeCategoria}`;

          const gasto = await tx.gasto.create({
            data: {
              usuarioId,
              cartaoId: cartao.id,
              categoriaId: categoria.id,
              valor,
              descricao: descricaoFinal,
              tipo: 'DESPESA',
              data: new Date(),
              excluido: false,
              local: null,
              tags: []
            }
          });

          const novoSaldo = cartao.saldoAtual - valor;
          await tx.cartao.update({
            where: { id: cartao.id },
            data: {
              saldoAtual: novoSaldo,
              saldoDisponivel: novoSaldo
            }
          });

          return { gasto, novoSaldo };
        });

        return `✅ Gasto registado, kamba!

💸 Valor: ${valor.toLocaleString('pt-AO')} AOA
📂 Categoria: ${nomeCategoria}
💳 Conta: ${cartao.nome}
📝 Descrição: ${resultado.gasto.descricao}

💰 Saldo restante: ${resultado.novoSaldo.toLocaleString('pt-AO')} AOA`;

      } catch (err) {
        console.error('[WIZARD] Erro ao registar gasto:', err);
        return '❌ Eish, deu erro ao registar o gasto. Verifica se tens conta ativa e tenta novamente.';
      }
    }
  },

  analise_mensal: {
    nome: 'Análise do Mês',
    icone: '📊',
    passos: [
      {
        id: 'confirmacao',
        pergunta: '📊 Queres uma análise completa deste mês?\n\n1️⃣ Sim, bora!\n2️⃣ Não, obrigado',
        validacao: (resp) => ['1', '2', 'sim', 'não', 'nao', 's', 'n'].includes(resp.trim().toLowerCase()),
        erroMsg: 'Responde 1 (sim) ou 2 (não), kamba!'
      }
    ],
    concluir: async (dados, usuarioId) => {
      try {
        const resposta = dados.confirmacao.toLowerCase().trim();
        if (['2', 'não', 'nao', 'n'].includes(resposta)) {
          return 'Tranquilo, kamba! Quando quiseres uma análise é só dizer "análise do mês". 👊';
        }

        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

        const [gastos, user] = await Promise.all([
          prisma.gasto.findMany({
            where: {
              usuarioId,
              data: { gte: inicioMes, lte: fimMes },
              excluido: false,
              tipo: 'DESPESA'
            },
            include: { categoria: true },
            orderBy: { valor: 'desc' }
          }),
          prisma.user.findUnique({
            where: { id: usuarioId },
            select: { rendaMensalMedia: true }
          })
        ]);

        const nomeMes = hoje.toLocaleDateString('pt-AO', { month: 'long', year: 'numeric' });

        if (gastos.length === 0) {
          return `📊 *Análise de ${nomeMes}*

Nenhum gasto registado este mês, kamba! Tás a poupar muito ou ainda não registaste nada? 😄

Regista os teus gastos para eu te dar uma análise real.`;
        }

        const totalGasto = gastos.reduce((acc, g) => acc + Number(g.valor), 0);

        // Agrupa por categoria
        const porCategoria = gastos.reduce((acc, g) => {
          const cat = g.categoria?.nome || 'Sem categoria';
          if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
          acc[cat].total += Number(g.valor);
          acc[cat].count += 1;
          return acc;
        }, {});

        const top3 = Object.entries(porCategoria)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 3)
          .map(([cat, d]) => `  • ${cat}: ${d.total.toLocaleString('pt-AO')} AOA (${d.count}x)`)
          .join('\n');

        const diasPassados = Math.max(hoje.getDate(), 1);
        const mediaDiaria = totalGasto / diasPassados;

        // Avaliação relativa à renda
        let avaliacaoRenda = '';
        if (user?.rendaMensalMedia > 0) {
          const percRenda = Math.round((totalGasto / user.rendaMensalMedia) * 100);
          if (percRenda > 90) avaliacaoRenda = `\n⚠️ Já gastaste ${percRenda}% da tua renda, kamba! Controla o kumbú.`;
          else if (percRenda > 70) avaliacaoRenda = `\n🟡 ${percRenda}% da renda gasta. Estás a caminhar bem, mas cuidado.`;
          else avaliacaoRenda = `\n✅ ${percRenda}% da renda gasta. Bom ritmo, kamba!`;
        }

        return `📊 *Análise de ${nomeMes}*

💸 Total gasto: ${totalGasto.toLocaleString('pt-AO')} AOA
📝 Transações: ${gastos.length}
📅 Média diária: ${Math.round(mediaDiaria).toLocaleString('pt-AO')} AOA${avaliacaoRenda}

🔥 Top categorias:
${top3}

Quer criar um plano de corte de gastos? Diz "criar meta" para começar. 💡`;

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
 * Inicia novo fluxo guiado
 */
const iniciarFluxo = (usuarioId, tipoFluxo) => {
  const fluxo = FLUXOS[tipoFluxo];
  if (!fluxo) return null;

  wizardStates.delete(usuarioId); // Limpa estado anterior

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
 * Processa resposta no fluxo atual com proteção contra race condition
 */
const processarRespostaFluxo = async (usuarioId, resposta) => {
  // Adquire lock para evitar processamento concorrente
  const lockAcquired = await acquireLock(usuarioId);
  if (!lockAcquired) {
    return {
      continuar: true,
      mensagem: 'Eish, kamba! Aguarda um momento, estou a processar... 🔄'
    };
  }

  try {
    const estado = wizardStates.get(usuarioId);

    if (!estado) {
      return {
        continuar: false,
        mensagem: 'Nenhum fluxo ativo. Diz "criar meta" ou "registar gasto" para começar!'
      };
    }

    const fluxo = FLUXOS[estado.fluxo];

    if (!fluxo) {
      wizardStates.delete(usuarioId);
      return {
        continuar: false,
        mensagem: 'Fluxo inválido. Começa de novo, kamba.'
      };
    }

    const passoAtual = fluxo.passos[estado.passoAtual];
    const respostaTrimmed = resposta.trim();

    // Validação da resposta
    if (!passoAtual.validacao(respostaTrimmed)) {
      return {
        continuar: true,
        mensagem: `❌ ${passoAtual.erroMsg}\n\n${passoAtual.pergunta}`
      };
    }

    // Aplica transformação se existir, e sanitiza
    const valorFinal = (passoAtual.transform ? passoAtual.transform(respostaTrimmed) : respostaTrimmed)
      .replace(/[<>]/g, ''); // Remove tags HTML

    estado.dados[passoAtual.id] = valorFinal;
    estado.passoAtual++;

    // Verifica se há mais passos
    if (estado.passoAtual < fluxo.passos.length) {
      return {
        continuar: true,
        mensagem: fluxo.passos[estado.passoAtual].pergunta
      };
    }

    // Fluxo completo - executa ação
    const resultado = await fluxo.concluir(estado.dados, usuarioId);
    wizardStates.delete(usuarioId);

    return {
      continuar: false,
      mensagem: resultado,
      concluido: true
    };

  } catch (err) {
    console.error('[WIZARD] Erro ao processar resposta:', err);
    wizardStates.delete(usuarioId);

    return {
      continuar: false,
      mensagem: '❌ Deu erro ao processar, kamba. Tenta novamente.',
      concluido: false,
      erro: true
    };
  } finally {
    releaseLock(usuarioId); // Sempre liberta o lock
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
    : 'Não havia nenhum fluxo ativo, mano.';
};

/**
 * Verifica se utilizador tem fluxo ativo
 * Limpeza automática de fluxos expirados (30 min)
 */
const temFluxoAtivo = (usuarioId) => {
  const agora = Date.now();
  const EXPIRACAO = 30 * 60 * 1000; // 30 minutos

  for (const [uid, estado] of wizardStates.entries()) {
    if (agora - estado.iniciado > EXPIRACAO) {
      wizardStates.delete(uid);
    }
  }

  return wizardStates.has(usuarioId);
};

/**
 * Detecta intenção de iniciar fluxo na mensagem
 */
const detectarIntencaoFluxo = (mensagem) => {
  if (!mensagem || typeof mensagem !== 'string') return null;

  const msg = mensagem.toLowerCase().trim();

  if (/criar meta|nova meta|novo objetivo|quero poupar para|quero juntar|começar meta/.test(msg)) {
    return 'criar_meta';
  }

  if (/registar gasto|adicionar gasto|quero registar|acabei de gastar|gastei|fiz uma despesa/.test(msg)) {
    return 'registar_gasto';
  }

  if (/análise|analise|resumo do mês|como (estou|vou|tô) (financeiramente|este mês)|ver os gastos do mês/.test(msg)) {
    return 'analise_mensal';
  }

  return null;
};

/**
 * Lista fluxos disponíveis formatada
 */
const listarFluxos = () => {
  return `🧙‍♂️ *Fluxos Guiados disponíveis:*

${Object.entries(FLUXOS).map(([key, fluxo], i) =>
  `${i + 1}️⃣ *${fluxo.icone} ${fluxo.nome}*`
).join('\n')}

Diz o nome do fluxo para começar, kamba!
Exemplos: *"criar meta"*, *"registar gasto"* ou *"análise do mês"*`;
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