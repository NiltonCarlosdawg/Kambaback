const prisma = require("../../../lib/prisma");
const redisClient = require("../services/core/redisClient");
const toolRegistry = require("../services/ai/toolRegistry");
const { extrairEntidades } = require("../services/ai/intentClassifier");

const WIZARD_PERSISTENCE_TTL = 24 * 60 * 60; // 24 horas
const WIZARD_ACTIVE_WINDOW = 15 * 60 * 1000; // 15 minutos considerado "ativo"
const LOCK_TTL = 5;

const wizardStatesMemoria = new Map();
const wizardLocksMemoria = new Map();

const getRedisKey = (usuarioId) => `wizard:state:${usuarioId}`;
const getLockKey = (usuarioId) => `wizard:lock:${usuarioId}`;

const acquireLock = async (usuarioId, timeout = 3000) => {
  if (redisClient.isDisponivel()) {
    const acquired = await redisClient.setLock(getLockKey(usuarioId), LOCK_TTL);
    if (acquired) return true;
    const inicio = Date.now();
    while (Date.now() - inicio < timeout) {
      await new Promise((r) => setTimeout(r, 50));
      const acquiredAgain = await redisClient.setLock(
        getLockKey(usuarioId),
        LOCK_TTL,
      );
      if (acquiredAgain) return true;
    }
    return false;
  }

  const inicio = Date.now();
  while (wizardLocksMemoria.get(usuarioId)) {
    if (Date.now() - inicio > timeout) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
  wizardLocksMemoria.set(usuarioId, true);
  return true;
};

const releaseLock = async (usuarioId) => {
  if (redisClient.isDisponivel()) {
    await redisClient.releaseLock(getLockKey(usuarioId));
    return;
  }
  wizardLocksMemoria.delete(usuarioId);
};

const getEstado = async (usuarioId) => {
  if (redisClient.isDisponivel()) {
    const dados = await redisClient.hgetall(getRedisKey(usuarioId));
    if (dados && dados.fluxo) return dados;
    return null;
  }
  return wizardStatesMemoria.get(usuarioId) || null;
};

const setEstado = async (usuarioId, estado) => {
  estado.atualizadoEm = Date.now();
  if (redisClient.isDisponivel()) {
    for (const [campo, valor] of Object.entries(estado)) {
      await redisClient.hset(getRedisKey(usuarioId), campo, valor);
    }
    await redisClient.expire(getRedisKey(usuarioId), WIZARD_PERSISTENCE_TTL);
    return;
  }
  wizardStatesMemoria.set(usuarioId, estado);
};

const delEstado = async (usuarioId) => {
  if (redisClient.isDisponivel()) {
    await redisClient.del(getRedisKey(usuarioId));
    return;
  }
  wizardStatesMemoria.delete(usuarioId);
};

const FLUXOS = {
  criar_meta: {
    nome: "Criar Meta Financeira",
    icone: "🎯",
    passos: [
      {
        id: "nome",
        pergunta:
          ' Fixe! Qual é o nome da tua meta?\nExemplo: "Comprar moto", "Viagem para Benguela", "Trocar de telemóvel"',
        validacao: (resp) =>
          resp && resp.trim().length >= 3 && resp.trim().length <= 100,
        erroMsg:
          'Nome muito curto ou longo, kamba. Entre 3 e 100 caracteres. Exemplo: "Comprar moto"',
      },
      {
        id: "valor",
        pergunta:
          " Quanto precisas juntar em AOA?\nExemplo: 500000 (para 500 mil Kwanzas)",
        validacao: (resp) => {
          const num = parseFloat(resp.replace(/[.,\s]/g, "").replace(",", "."));
          return !isNaN(num) && num > 0 && num < 1_000_000_000;
        },
        transform: (resp) => resp.replace(/[.\s]/g, "").replace(",", "."),
        erroMsg:
          "Preciso de um valor válido, kamba. Exemplo: 500000 (máx 1 bilião AOA)",
      },
      {
        id: "prazo",
        pergunta:
          " Em quantos meses queres atingir?\nExemplo: 6 (para 6 meses), 12 (para 1 ano)",
        validacao: (resp) => {
          const num = parseInt(resp);
          return !isNaN(num) && num > 0 && num <= 120;
        },
        validacaoAsync: async (resp, usuarioId, dados) => {
          try {
            const meses = parseInt(resp);
            const valorAlvo = parseFloat(dados.valor);
            const esforcoMensal = valorAlvo / meses;

            // Chamar ferramenta para ver perfil/renda
            const user = await prisma.user.findUnique({
              where: { id: usuarioId },
              select: { rendaMensalMedia: true },
            });

            if (user?.rendaMensalMedia > 0) {
              const renda = Number(user.rendaMensalMedia);
              if (esforcoMensal > renda * 0.5) {
                return {
                  valido: false,
                  mensagem: `⚠️ Kamba, ${esforcoMensal.toLocaleString("pt-AO")} AOA/mês é mais de 50% da tua renda (${renda.toLocaleString("pt-AO")} AOA). Vai ser muito difícil manter! Sugiro um prazo maior (ex: ${Math.ceil(valorAlvo / (renda * 0.3))} meses).`,
                };
              }
            }
            return { valido: true };
          } catch (err) {
            return { valido: true }; // Fallback em caso de erro técnico
          }
        },
        erroMsg:
          "Quantos meses, kamba? Use um número entre 1 e 120. Exemplo: 6 ou 12",
      },
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
            descricao: `Meta: poupar ${valorAlvo.toLocaleString("pt-AO")} AOA em ${prazoMeses} meses`,
            categoria: "PESSOAL",
            prioridade: "MEDIA",
            cor: "#10b981",
            icone: "target",
            excluido: false,
            concluido: false,
          },
        });

        return ` Meta criada com sucesso, kamba!

*${dados.nome}*
 Valor alvo: ${valorAlvo.toLocaleString("pt-AO")} AOA
 Prazo: ${prazoMeses} meses (até ${dataPrazo.toLocaleDateString("pt-AO")})
 Poupar por mês: ${mensal.toLocaleString("pt-AO")} AOA

Vamos chegar lá juntos! Digita "como vão meus objetivos?" a qualquer momento para ver o progresso. `;
      } catch (err) {
        console.error("[WIZARD] Erro ao criar meta:", err);
        return " Eish, deu erro ao salvar a meta. Tenta novamente ou contacta o suporte.";
      }
    },
  },

  registar_gasto: {
    nome: "Registar Gasto Rápido",
    icone: "💸",
    passos: [
      {
        id: "valor",
        pergunta: " Quanto gastaste (em AOA)?\nExemplo: 5000",
        validacao: (resp) => {
          const num = parseFloat(resp.replace(/[.\s]/g, "").replace(",", "."));
          return !isNaN(num) && num > 0 && num < 100_000_000;
        },
        transform: (resp) => resp.replace(/[.\s]/g, "").replace(",", "."),
        erroMsg:
          "Preciso de um valor válido, kamba. Exemplo: 5000 (máx 100 milhões AOA)",
      },
      {
        id: "categoria",
        pergunta:
          " Em que categoria?\n\n1️⃣ Alimentação\n2️⃣ Transporte\n3️⃣ Saúde\n4️⃣ Lazer\n5️⃣ Educação\n6️⃣ Outro\n\nResponde com o número.",
        validacao: (resp) =>
          ["1", "2", "3", "4", "5", "6"].includes(resp.trim()),
        transform: (resp) => resp.trim(),
        erroMsg: "Escolhe um número de 1 a 6, mano!",
      },
      {
        id: "recorrente",
        pergunta:
          " É uma despesa recorrente (mensal)?\n\n1️⃣ Sim\n2️⃣ Não",
        validacao: (resp) => ["1", "2", "sim", "não", "nao"].includes(resp.toLowerCase().trim()),
        condicao: (dados) => ["1", "2", "5"].includes(dados.categoria), // Só pergunta se for Alimentação, Transporte ou Educação
        erroMsg: "Responde 1 para Sim ou 2 para Não, kamba.",
      },
      {
        id: "descricao",
        pergunta:
          ' Descreve o gasto (ou manda "pular"):\nExemplo: "Almoço no restaurante", "Candongueiro para o trabalho"',
        validacao: () => true,
        opcional: true,
      },
    ],
    concluir: async (dados, usuarioId) => {
      try {
        const categoriaMap = {
          1: "Alimentação",
          2: "Transporte",
          3: "Saúde",
          4: "Lazer",
          5: "Educação",
          6: "Outro",
        };

        const nomeCategoria = categoriaMap[dados.categoria];
        const valor = parseFloat(dados.valor);

        let categoria = await prisma.categoria.findFirst({
          where: { usuarioId, nome: nomeCategoria, excluido: false },
        });

        if (!categoria) {
          categoria = await prisma.categoria.findFirst({
            where: { padrao: true, nome: nomeCategoria, excluido: false },
          });

          if (!categoria) {
            categoria = await prisma.categoria.create({
              data: {
                usuarioId,
                nome: nomeCategoria,
                tipo: "FLEXIVEL",
                cor: "#FF6B6B",
                icone: "category",
                padrao: false,
                excluido: false,
              },
            });
          }
        }

        const cartao = await prisma.cartao.findFirst({
          where: { usuarioId, ativo: true, excluido: false },
          orderBy: { saldoAtual: "desc" },
        });

        if (!cartao) {
          return ' Precisas adicionar um cartão ou conta primeiro, kamba! Vai em "Cartões" na app e adiciona.';
        }

        if (cartao.saldoAtual < valor) {
          return ` Saldo insuficiente na conta *${cartao.nome}*!\nTens apenas ${cartao.saldoAtual.toLocaleString("pt-AO")} AOA disponíveis. Tens outra conta?`;
        }

        const resultado = await prisma.$transaction(async (tx) => {
          const descricaoFinal =
            dados.descricao && dados.descricao.toLowerCase() !== "pular"
              ? dados.descricao.trim()
              : `Gasto em ${nomeCategoria}`;

          const gasto = await tx.gasto.create({
            data: {
              usuarioId,
              cartaoId: cartao.id,
              categoriaId: categoria.id,
              valor,
              descricao: descricaoFinal,
              tipo: "DESPESA",
              data: new Date(),
              excluido: false,
              local: null,
              tags: [],
            },
          });

          const novoSaldo = cartao.saldoAtual - valor;
          await tx.cartao.update({
            where: { id: cartao.id },
            data: { saldoAtual: novoSaldo, saldoDisponivel: novoSaldo },
          });

          return { gasto, novoSaldo };
        });

        return ` Gasto registado, kamba!

 Valor: ${valor.toLocaleString("pt-AO")} AOA
 Categoria: ${nomeCategoria}
 Conta: ${cartao.nome}
 Descrição: ${resultado.gasto.descricao}

 Saldo restante: ${resultado.novoSaldo.toLocaleString("pt-AO")} AOA`;
      } catch (err) {
        console.error("[WIZARD] Erro ao registar gasto:", err);
        return " Eish, deu erro ao registar o gasto. Verifica se tens conta ativa e tenta novamente.";
      }
    },
  },

  analise_mensal: {
    nome: "Análise do Mês",
    icone: "📊",
    passos: [
      {
        id: "confirmacao",
        pergunta:
          " Queres uma análise completa deste mês?\n\n1️⃣ Sim, bora!\n Não, obrigado",
        validacao: (resp) =>
          ["1", "2", "sim", "não", "nao", "s", "n"].includes(
            resp.trim().toLowerCase(),
          ),
        erroMsg: "Responde 1 (sim) ou 2 (não), kamba!",
      },
    ],
    concluir: async (dados, usuarioId) => {
      try {
        const resposta = dados.confirmacao.toLowerCase().trim();
        if (["2", "não", "nao", "n"].includes(resposta)) {
          return 'Tranquilo, kamba! Quando quiseres uma análise é só dizer "análise do mês". ';
        }

        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(
          hoje.getFullYear(),
          hoje.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );

        const [gastos, user] = await Promise.all([
          prisma.gasto.findMany({
            where: {
              usuarioId,
              data: { gte: inicioMes, lte: fimMes },
              excluido: false,
              tipo: "DESPESA",
            },
            include: { categoria: true },
            orderBy: { valor: "desc" },
          }),
          prisma.user.findUnique({
            where: { id: usuarioId },
            select: { rendaMensalMedia: true },
          }),
        ]);

        const nomeMes = hoje.toLocaleDateString("pt-AO", {
          month: "long",
          year: "numeric",
        });

        if (gastos.length === 0) {
          return ` *Análise de ${nomeMes}*

Nenhum gasto registado este mês, kamba! Tás a poupar muito ou ainda não registaste nada? 

Regista os teus gastos para eu te dar uma análise real.`;
        }

        const totalGasto = gastos.reduce((acc, g) => acc + Number(g.valor), 0);

        const porCategoria = gastos.reduce((acc, g) => {
          const cat = g.categoria?.nome || "Sem categoria";
          if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
          acc[cat].total += Number(g.valor);
          acc[cat].count += 1;
          return acc;
        }, {});

        const top3 = Object.entries(porCategoria)
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 3)
          .map(
            ([cat, d]) =>
              `  • ${cat}: ${d.total.toLocaleString("pt-AO")} AOA (${d.count}x)`,
          )
          .join("\n");

        const diasPassados = Math.max(hoje.getDate(), 1);
        const mediaDiaria = totalGasto / diasPassados;

        let avaliacaoRenda = "";
        if (user?.rendaMensalMedia > 0) {
          const percRenda = Math.round(
            (totalGasto / user.rendaMensalMedia) * 100,
          );
          if (percRenda > 90)
            avaliacaoRenda = `\n Já gastaste ${percRenda}% da tua renda, kamba! Controla o kumbú.`;
          else if (percRenda > 70)
            avaliacaoRenda = `\n ${percRenda}% da renda gasta. Estás a caminhar bem, mas cuidado.`;
          else
            avaliacaoRenda = `\n ${percRenda}% da renda gasta. Bom ritmo, kamba!`;
        }

        return ` *Análise de ${nomeMes}*

 Total gasto: ${totalGasto.toLocaleString("pt-AO")} AOA
 Transações: ${gastos.length}
 Média diária: ${Math.round(mediaDiaria).toLocaleString("pt-AO")} AOA${avaliacaoRenda}

 Top categorias:
${top3}

Quer criar um plano de corte de gastos? Diz "criar meta" para começar. `;
      } catch (err) {
        console.error("[WIZARD] Erro na análise:", err);
        return " Deu erro ao gerar a análise, kamba. Tenta mais tarde.";
      }
    },
  },

  registar_cartao: {
    nome: "Registar Novo Cartão",
    icone: "💳",
    passos: [
      {
        id: "nome",
        pergunta:
          ' Qual é o nome ou apelido para este cartão?\nExemplo: "Meu Multicaixa", "Cartão BAI", "Poupanca"',
        validacao: (resp) =>
          resp && resp.trim().length >= 2 && resp.trim().length <= 50,
        erroMsg: "Nome inválido. Usa entre 2 e 50 caracteres.",
      },
      {
        id: "tipo",
        pergunta:
          " Qual é o tipo de conta?\n\n1️⃣ Débito (Conta Corrente)\n2️⃣ Crédito\n3️⃣ Poupança",
        validacao: (resp) => ["1", "2", "3"].includes(resp.trim()),
        erroMsg: "Escolhe 1, 2 ou 3, kamba!",
      },
      {
        id: "banco",
        pergunta: ' Qual é o banco?\nExemplo: "BAI", "BFA", "BIC", "SOL"',
        validacao: (resp) => resp && resp.trim().length >= 2,
        erroMsg: "Diz o nome do banco, mano.",
      },
      {
        id: "saldo",
        pergunta: " Qual é o saldo actual em AOA?\nExemplo: 50000",
        validacao: (resp) => {
          const num = parseFloat(resp.replace(/[.\s]/g, "").replace(",", "."));
          return !isNaN(num) && num >= 0;
        },
        transform: (resp) => resp.replace(/[.\s]/g, "").replace(",", "."),
        erroMsg: "Introduz um saldo válido (ex: 50000).",
      },
    ],
    concluir: async (dados, usuarioId) => {
      try {
        const tipoMap = { 1: "DEBITO", 2: "CREDITO", 3: "POUPANCA" };
        const tipo = tipoMap[dados.tipo];
        const saldo = parseFloat(dados.saldo);

        const cartao = await prisma.cartao.create({
          data: {
            usuarioId,
            nome: dados.nome.trim(),
            tipo,
            banco: dados.banco.trim(),
            saldoAtual: saldo,
            saldoDisponivel: saldo,
            ativo: true,
            excluido: false,
            cor: "#6366f1",
            icone: "credit-card",
          },
        });

        return ` Cartão registado com sucesso, kamba!

*${cartao.nome}* (${cartao.banco})
 Tipo: ${tipo}
 Saldo: ${saldo.toLocaleString("pt-AO")} AOA

Agora já podes registar gastos usando esta conta! 🚀`;
      } catch (err) {
        console.error("[WIZARD] Erro ao registar cartão:", err);
        return " Eish, deu erro ao salvar o cartão. Tenta novamente.";
      }
    },
  },
};

const iniciarFluxo = async (usuarioId, tipoFluxo, dadosIniciais = {}) => {
  const fluxo = FLUXOS[tipoFluxo];
  if (!fluxo) return null;

  await delEstado(usuarioId);

  const estado = {
    fluxo: tipoFluxo,
    passoAtual: 0,
    dados: {},
    iniciado: Date.now(),
  };

  // 1. Tentar preencher TODOS os dados iniciais que forem válidos (mesmo fora de ordem)
  for (const passo of fluxo.passos) {
    const valorInicial = dadosIniciais[passo.id];
    if (valorInicial !== undefined && valorInicial !== null) {
      const valorStr = String(valorInicial);
      if (passo.validacao(valorStr)) {
        estado.dados[passo.id] = passo.transform
          ? passo.transform(valorStr)
          : valorStr;
      }
    }
  }

  // 2. Encontrar o primeiro passo que ainda precisa de resposta (vazio ou condição falsa)
  let indexPrimeiroVazio = 0;
  while (indexPrimeiroVazio < fluxo.passos.length) {
    const passo = fluxo.passos[indexPrimeiroVazio];
    const jaTemDado = estado.dados[passo.id] !== undefined;
    const condicaoAtendida = !passo.condicao || passo.condicao(estado.dados);

    if (jaTemDado && condicaoAtendida) {
      indexPrimeiroVazio++;
    } else if (!condicaoAtendida) {
      indexPrimeiroVazio++;
    } else {
      break;
    }
  }

  estado.passoAtual = indexPrimeiroVazio;

  // Se todos os passos foram preenchidos ou pulados, conclui logo
  if (estado.passoAtual >= fluxo.passos.length) {
    const resultado = await fluxo.concluir(estado.dados, usuarioId);
    return { concluido: true, mensagem: resultado };
  }

  const proximoPasso = fluxo.passos[estado.passoAtual];
  let pergunta = proximoPasso.pergunta;
  if (proximoPasso.prepararPergunta) {
    pergunta = await proximoPasso.prepararPergunta(estado.dados, usuarioId);
  }

  await setEstado(usuarioId, estado);
  return {
    concluido: false,
    mensagem: pergunta,
  };
};

const processarRespostaFluxo = async (usuarioId, resposta) => {
  const lockAcquired = await acquireLock(usuarioId);
  if (!lockAcquired) {
    return {
      continuar: true,
      mensagem: "Eish, kamba! Aguarda um momento, estou a processar... ",
    };
  }

  try {
    const estado = await getEstado(usuarioId);

    if (!estado) {
      return {
        continuar: false,
        mensagem:
          'Nenhum fluxo ativo. Diz "criar meta" ou "registar gasto" para começar!',
      };
    }

    const fluxo = FLUXOS[estado.fluxo];

    if (!fluxo) {
      await delEstado(usuarioId);
      return {
        continuar: false,
        mensagem: "Fluxo inválido. Começa de novo, kamba.",
      };
    }

    const passoAtual = fluxo.passos[estado.passoAtual];
    const respostaTrimmed = resposta.trim();

    // 1. Validação Síncrona
    if (!passoAtual.validacao(respostaTrimmed)) {
      return {
        continuar: true,
        mensagem: ` ${passoAtual.erroMsg}\n\n${passoAtual.pergunta}`,
      };
    }

    // 2. Validação Assíncrona (Tools/BD)
    if (passoAtual.validacaoAsync) {
      const valAsync = await passoAtual.validacaoAsync(respostaTrimmed, usuarioId, estado.dados);
      if (!valAsync.valido) {
        return {
          continuar: true,
          mensagem: ` ${valAsync.mensagem}\n\n${passoAtual.pergunta}`,
        };
      }
    }

    const valorFinal = (
      passoAtual.transform
        ? passoAtual.transform(respostaTrimmed)
        : respostaTrimmed
    ).replace(/[<>]/g, "");

    estado.dados[passoAtual.id] = valorFinal;

    // 3. Hook de Ação
    if (passoAtual.acao) {
      await passoAtual.acao(estado.dados, usuarioId);
    }

    // 4. LÓGICA DE NAVEGAÇÃO: Pular passos já preenchidos ou com condição falsa
    let novoIndex = estado.passoAtual + 1;
    while (novoIndex < fluxo.passos.length) {
      const proximo = fluxo.passos[novoIndex];
      const condicaoAtendida = !proximo.condicao || proximo.condicao(estado.dados);
      const jaTemDadoValido = estado.dados[proximo.id] !== undefined;

      if (!condicaoAtendida || jaTemDadoValido) {
        novoIndex++;
      } else {
        break;
      }
    }
    estado.passoAtual = novoIndex;

    if (estado.passoAtual < fluxo.passos.length) {
      const proximoPasso = fluxo.passos[estado.passoAtual];
      let pergunta = proximoPasso.pergunta;

      if (proximoPasso.prepararPergunta) {
        pergunta = await proximoPasso.prepararPergunta(estado.dados, usuarioId);
      }

      await setEstado(usuarioId, estado);
      return {
        continuar: true,
        mensagem: pergunta,
      };
    }

    const resultado = await fluxo.concluir(estado.dados, usuarioId);
    await delEstado(usuarioId);

    return {
      continuar: false,
      mensagem: resultado,
      concluido: true,
    };
  } catch (err) {
    console.error("[WIZARD] Erro ao processar resposta:", err);
    await delEstado(usuarioId);

    return {
      continuar: false,
      mensagem: " Deu erro ao processar, kamba. Tenta novamente.",
      concluido: false,
      erro: true,
    };
  } finally {
    await releaseLock(usuarioId);
  }
};

const cancelarFluxo = async (usuarioId) => {
  const estado = await getEstado(usuarioId);
  await delEstado(usuarioId);
  return estado
    ? "Fluxo cancelado, kamba! Qualquer coisa, é só chamar. "
    : "Não havia nenhum fluxo ativo, mano.";
};

const temFluxoAtivo = async (usuarioId) => {
  const estado = await getEstado(usuarioId);
  if (!estado) return false;

  const agora = Date.now();
  const tempoInativo = agora - (estado.atualizadoEm || estado.iniciado || 0);

  if (tempoInativo > WIZARD_ACTIVE_WINDOW) {
    return false;
  }

  return true;
};

/**
 * Verifica se existe um fluxo que pode ser recuperado (abandonado mas persistente)
 */
const verificarRecuperacao = async (usuarioId) => {
  const estado = await getEstado(usuarioId);
  if (!estado) return null;

  const agora = Date.now();
  const tempoInativo = agora - (estado.atualizadoEm || estado.iniciado || 0);

  // Se está na janela ativa, não é recuperação, é fluxo normal
  if (tempoInativo <= WIZARD_ACTIVE_WINDOW) return null;

  // Se passou de 24h, limpamos
  if (tempoInativo > WIZARD_PERSISTENCE_TTL * 1000) {
    await delEstado(usuarioId);
    return null;
  }

  const fluxo = FLUXOS[estado.fluxo];
  return {
    fluxoNome: fluxo ? fluxo.nome : "um registo anterior",
    tipo: estado.fluxo,
  };
};

const detectarIntencaoFluxo = (mensagem) => {
  if (!mensagem || typeof mensagem !== "string") return null;

  const msg = mensagem.toLowerCase().trim();
  const entidades = extrairEntidades(msg);
  let tipo = null;
  const dadosIniciais = {};

  if (
    /criar meta|nova meta|novo objetivo|quero poupar para|quero juntar|começar meta/.test(
      msg,
    )
  ) {
    tipo = "criar_meta";
    if (entidades.valorMonetario) {
      dadosIniciais.valor = entidades.valorMonetario.valor;
    } else if (entidades.valoresNumericos.length > 0) {
      dadosIniciais.valor = entidades.valoresNumericos[0];
    }
    const metaMatch = msg.match(
      /(?:para|meta|objetivo|juntar para|comprar)\s+([^0-9,.]{3,50})/,
    );
    if (metaMatch) {
      dadosIniciais.nome = metaMatch[1].trim();
    }
  }
 else if (
    /registar gasto|adicionar gasto|quero registar|acabei de gastar|gastei|fiz uma despesa/.test(
      msg,
    )
  ) {
    tipo = "registar_gasto";
    if (entidades.valorMonetario) {
      dadosIniciais.valor = entidades.valorMonetario.valor;
    } else if (entidades.valoresNumericos.length > 0) {
      dadosIniciais.valor = entidades.valoresNumericos[0];
    }

    if (entidades.categoriaGasto) {
      const catMap = {
        Alimentação: "1",
        Transporte: "2",
        Saúde: "3",
        Lazer: "4",
        Educação: "5",
        Casa: "6",
      };
      dadosIniciais.categoria = catMap[entidades.categoriaGasto];
    }

    const descMatch = msg.match(
      /(?:gastei|gasto de|no|na|com|para)\s+([^0-9,.]{3,50})/,
    );
    if (descMatch) {
      dadosIniciais.descricao = descMatch[1].trim();
    }
  } else if (
    /adicionar cartão|novo cartão|registar cartão|cadastrar cartão|adicionar conta|nova conta|mudar de cartão/.test(
      msg,
    )
  ) {
    tipo = "registar_cartao";
    if (entidades.banco) {
      dadosIniciais.banco = entidades.banco;
    }
    if (entidades.valorMonetario) {
      dadosIniciais.saldo = entidades.valorMonetario.valor;
    } else if (entidades.valoresNumericos.length > 0) {
      dadosIniciais.saldo = entidades.valoresNumericos[0];
    }
  }
 else if (
    /^(quero uma |faz(e|) uma |preciso de uma |manda (uma|aí) )?(análise|analise) (completa |do mês|mensal|rápida|)$|^(como (estou|vou|tô) (financeiramente|este mês|neste mês))$|^(resumo do mês)$|^(ver os gastos do mês)$/.test(
      msg,
    )
  ) {
    tipo = "analise_mensal";
  }

  return tipo ? { tipo, dadosIniciais } : null;
};

const listarFluxos = () => {
  return ` *Fluxos Guiados disponíveis:*

${Object.entries(FLUXOS)
  .map(([key, fluxo], i) => `${i + 1}️⃣ *${fluxo.icone} ${fluxo.nome}*`)
  .join("\n")}

Diz o nome do fluxo para começar, kamba!
Exemplos: *"criar meta"*, *"registar gasto"* ou *"análise do mês"*`;
};

module.exports = {
  iniciarFluxo,
  processarRespostaFluxo,
  cancelarFluxo,
  temFluxoAtivo,
  detectarIntencaoFluxo,
  listarFluxos,
  FLUXOS,
  getEstado,
  setEstado,
  verificarRecuperacao,
};
