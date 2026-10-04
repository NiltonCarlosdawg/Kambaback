const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { invalidarCacheUsuario } = require('../../insights/controllers/insightsController');
const { calcularNovosSaldos } = require('../services/saldoCartaoService');

const arredondarDinheiro = (valor) =>
  Math.round((Number(valor) + Number.EPSILON) * 100) / 100;

// F-013: pesos RELATIVOS — reparte o pool pela soma real das percentagens
// (idêntico ao antigo quando a soma = 100%; não rebenta mais com soma ≠ 100%).
const distribuirPoolPorPesos = (objetivos, pool) => {
  const totalPesos = objetivos.reduce(
    (acc, objetivo) => acc + Number(objetivo.porcentagemDistribuicao || 0),
    0,
  );

  if (!objetivos.length || totalPesos <= 0) return [];

  let acumulado = 0;
  return objetivos.map((objetivo, index) => {
    const peso = Number(objetivo.porcentagemDistribuicao || 0);
    const valor =
      index === objetivos.length - 1
        ? arredondarDinheiro(pool - acumulado)
        : arredondarDinheiro((pool * peso) / totalPesos);
    acumulado += valor;
    return { objetivo, valor };
  });
};

const obterCategoriaAjusteSaldo = async (tx, usuarioId) => {
  const categoriaUsuario = await tx.categoria.findFirst({
    where: {
      usuarioId,
      excluido: false,
      nome: { contains: 'Ajuste', mode: 'insensitive' }
    },
    orderBy: { nome: 'asc' }
  });

  if (categoriaUsuario) return categoriaUsuario;

  const categoriaPadrao = await tx.categoria.findFirst({
    where: {
      padrao: true,
      excluido: false,
      nome: { contains: 'Ajuste', mode: 'insensitive' }
    },
    orderBy: { nome: 'asc' }
  });

  if (categoriaPadrao) return categoriaPadrao;

  return tx.categoria.create({
    data: {
      usuarioId,
      nome: 'Ajuste de Saldo',
      tipo: 'ESSENCIAL',
      cor: '#64748b',
      icone: 'sliders-horizontal',
      padrao: false,
      ordem: 999,
      excluido: false,
      ativa: true
    }
  });
};

/**
 * ==========================================
 * LISTAR TODOS OS CARTÕES DO USUÁRIO
 * ==========================================
 */
const listarCartoes = async (req, res, next) => {
  try {
    const cartoes = await prisma.cartao.findMany({
      where: {
        usuarioId: req.user.id,
        ativo: true,
        excluido: false
      },
      orderBy: { criadoEm: 'desc' }
    });

    let totalSaldo = 0;
    let totalDisponivel = 0;
    let totalReservado = 0;

    cartoes.forEach(c => {
      totalSaldo += Number(c.saldoAtual) || 0;
      totalDisponivel += Number(c.saldoDisponivel) || 0;
      totalReservado += Number(c.saldoReservado) || 0;
    });

    const cartoesVista = cartoes.map((c) => {
      // F-033: número cifrado na BD — a API nunca devolve o valor completo
      const enc = require('../../../utils/encryption');
      let numeroMascarado = c.numero;
      try {
        numeroMascarado = c.numero
          ? enc.maskSensitiveData(enc.isEncrypted(c.numero) ? enc.decrypt(c.numero) : c.numero)
          : null;
      } catch {
        numeroMascarado = '****';
      }
      return { ...c, numero: numeroMascarado };
    });

    res.json({
      success: true,
      message: 'Cartões carregados com sucesso',
      cartoes: cartoesVista,
      resumo: {
        totalCartoes: cartoes.length,
        saldoTotal: totalSaldo,
        disponivelTotal: totalDisponivel,
        reservadoTotal: totalReservado
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * CRIAR NOVO CARTÃO
 * ==========================================
 */
const criarCartao = async (req, res, next) => {
  const {
    nome,
    tipo,
    banco,
    numero,
    saldoAtual,
    limiteCredito,
    diaFechamento,
    diaVencimento,
    cor = '#6366f1',
    icone = 'credit-card',
    distribuirParaObjetivos = false,
    percentualDistribuicaoPoupanca = 0
  } = req.body;

  const tiposValidos = ['DEBITO', 'CREDITO', 'POUPANCA'];
  if (!tiposValidos.includes(tipo)) {
    return next(new AppError('Tipo de cartão inválido. Use: DEBITO, CREDITO ou POUPANCA', 400));
  }

  try {
    // Verifica duplicidade de número (F-033: números encriptados — compara pelo
    // valor em texto claro, decifrando os existentes do próprio utilizador)
    if (numero) {
      const enc = require('../../../utils/encryption');
      const meus = await prisma.cartao.findMany({
        where: { usuarioId: req.user.id, excluido: false, numero: { not: null } },
        select: { numero: true }
      });

      const duplicado = meus.some((c) => {
        try {
          return (enc.isEncrypted(c.numero) ? enc.decrypt(c.numero) : c.numero) === numero.trim();
        } catch {
          return false;
        }
      });

      if (duplicado) {
        return next(new AppError('Já tens um cartão com este número', 409));
      }
    }

    let saldoInicialAtual = 0;
    let saldoInicialDisponivel = 0;
    let limiteCredFinal = 0;

    if (tipo === 'CREDITO') {
      limiteCredFinal = parseFloat(limiteCredito) || 0;
      saldoInicialDisponivel = limiteCredFinal;
      saldoInicialAtual = 0; 
    } else {
      saldoInicialAtual = parseFloat(saldoAtual) || 0;
      saldoInicialDisponivel = saldoInicialAtual;
      limiteCredFinal = 0; 
    }

    const cartao = await prisma.cartao.create({
      data: {
        usuarioId: req.user.id,
        nome: nome.trim(),
        tipo,
        banco: banco?.trim() || 'Sem banco',
        // F-033: o número é cifrado com AES-256-GCM — nunca em texto claro
        numero: numero?.trim() ? require('../../../utils/encryption').encrypt(numero.trim()) : null,
        saldoAtual: saldoInicialAtual,
        saldoDisponivel: saldoInicialDisponivel,
        saldoReservado: 0,
        limiteCredito: limiteCredFinal,
        diaFechamento: tipo === 'CREDITO' ? diaFechamento : null,
        diaVencimento: tipo === 'CREDITO' ? diaVencimento : null,
        cor,
        icone,
        distribuirParaObjetivos: !!distribuirParaObjetivos,
        percentualDistribuicaoPoupanca: distribuirParaObjetivos
          ? parseFloat(percentualDistribuicaoPoupanca) || 0
          : 0,
        ativo: true,
        excluido: false
      }
    });

    await invalidarCacheUsuario(req.user.id);

    res.status(201).json({
      success: true,
      message: `Cartão de ${tipo.toLowerCase()} adicionado com sucesso!`,
      cartao: numero?.trim()
        ? { ...cartao, numero: require('../../../utils/encryption').maskSensitiveData(numero.trim()) }
        : cartao
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return next(new AppError('Já tens um cartão com este número', 409));
    }
    next(err);
  }
};

/**
 * ==========================================
 * ATUALIZAR CARTÃO
 * ==========================================
 */
const atualizarCartao = async (req, res, next) => {
  const { id } = req.params;
  
  const camposPermitidos = [
    'nome', 'banco', 'cor', 'icone', 'ativo', 
    'distribuirParaObjetivos', 'limiteCredito',
    'diaFechamento', 'diaVencimento',
    'percentualDistribuicaoPoupanca'
  ];
  
  const dados = {};

  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      if (campo === 'distribuirParaObjetivos' || campo === 'ativo') {
        dados[campo] = !!req.body[campo];
      } else if (campo === 'limiteCredito') {
        dados[campo] = parseFloat(req.body[campo]) || 0;
      } else if (['diaFechamento', 'diaVencimento'].includes(campo)) {
        dados[campo] = parseInt(req.body[campo]) || null;
      } else {
        dados[campo] = req.body[campo]?.trim?.() || req.body[campo];
      }
    }
  }

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nenhum dado válido para atualizar', 400));
  }

  try {
    // Verificar se o cartão existe e pertence ao usuário
    const cartaoExistente = await prisma.cartao.findFirst({
      where: { 
        id, 
        usuarioId: req.user.id,
        excluido: false 
      }
    });

    if (!cartaoExistente) {
      return next(new AppError('Cartão não encontrado', 404));
    }

    if (dados.limiteCredito !== undefined && cartaoExistente.tipo === 'CREDITO') {
      const diferencaLimite = dados.limiteCredito - Number(cartaoExistente.limiteCredito);
      dados.saldoDisponivel = Number(cartaoExistente.saldoDisponivel) + diferencaLimite;
    }

    if (dados.distribuirParaObjetivos === false) {
      dados.percentualDistribuicaoPoupanca = 0;
    }

    if (
      dados.distribuirParaObjetivos === true &&
      dados.percentualDistribuicaoPoupanca === undefined &&
      Number(cartaoExistente.percentualDistribuicaoPoupanca || 0) <= 0
    ) {
      return next(new AppError('Define a percentagem de distribuição da poupança antes de activar a distribuição automática', 400));
    }

    const cartao = await prisma.cartao.update({
      where: { id },
      data: dados
    });

    if (dados.ativo !== undefined || dados.distribuirParaObjetivos !== undefined) {
      await invalidarCacheUsuario(req.user.id);
    }

    res.json({
      success: true,
      message: 'Cartão atualizado com sucesso',
      cartao
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * ATUALIZAR SALDO DO CARTÃO (REFATORADO)
 * =========================================
 */
const atualizarSaldo = async (req, res, next) => {
  const { id } = req.params;
  const { valor, tipoTransacao } = req.body;

  if (!['DESPESA', 'RECEITA'].includes(tipoTransacao)) {
    return next(new AppError('Tipo de transação inválido. Use "DESPESA" ou "RECEITA"', 400));
  }

  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum <= 0) {
    return next(new AppError('Valor inválido', 400));
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const cartao = await tx.cartao.findFirst({
        where: { id, usuarioId: req.user.id, ativo: true, excluido: false }
      });

      if (!cartao) {
        throw new AppError('Cartão não encontrado ou inativo', 404);
      }

      const percentualPoupanca = Number(cartao.percentualDistribuicaoPoupanca || 0);

      // Regra única por tipo de cartão (F-005) — ver saldoCartaoService:
      // no CREDITO, saldoAtual = dívida (DESPESA aumenta, RECEITA é pagamento).
      // Lança AppError 400 quando não há saldo/limite disponível.
      const base = calcularNovosSaldos(cartao, tipoTransacao, valorNum);
      let novoSaldoAtual = base.saldoAtual;
      let novoSaldoDisponivel = base.saldoDisponivel;
      let novoSaldoReservado = base.saldoReservado;
      let distribuicoes = [];

      // ==========================================
      // LÓGICA DE RECEITA
      // ==========================================
      if (tipoTransacao === 'RECEITA') {
        if (cartao.distribuirParaObjetivos && percentualPoupanca > 0) {
          const objetivos = await tx.objetivo.findMany({
            where: {
              usuarioId: req.user.id,
              concluido: false,
              excluido: false,
              porcentagemDistribuicao: { gt: 0 }
            },
            orderBy: { prioridade: 'desc' }
          });

          if (objetivos.length === 0) {
            throw new AppError(
              'A distribuição automática está activa, mas não existem objetivos configurados',
              400,
            );
          }

          const poolDistribuicao = arredondarDinheiro(
            (valorNum * percentualPoupanca) / 100,
          );
          const distribuicoesPool = distribuirPoolPorPesos(
            objetivos,
            poolDistribuicao,
          );

          let totalDistribuido = 0;

          for (const item of distribuicoesPool) {
            const { objetivo, valor } = item;
            const objetivoAtualizado = await tx.objetivo.update({
              where: { id: objetivo.id },
              data: {
                valorAtual: {
                  increment: valor
                }
              }
            });

            totalDistribuido += valor;
            distribuicoes.push({
              objetivoId: objetivo.id,
              titulo: objetivo.titulo,
              porcentagem: Number(objetivo.porcentagemDistribuicao),
              valor,
              novoValorAtual: Number(objetivoAtualizado.valorAtual)
            });
          }


          if (totalDistribuido > 0) {
            novoSaldoDisponivel -= totalDistribuido;
            novoSaldoReservado += totalDistribuido;
          }
        }
      }


      const cartaoAtualizado = await tx.cartao.update({
        where: { id },
        data: { 
          saldoAtual: novoSaldoAtual,
          saldoDisponivel: novoSaldoDisponivel,
          saldoReservado: novoSaldoReservado
        }
      });

      const categoriaAjuste = await obterCategoriaAjusteSaldo(tx, req.user.id);

      await tx.gasto.create({
        data: {
          usuarioId: req.user.id,
          cartaoId: id,
          categoriaId: categoriaAjuste.id,
          tipo: tipoTransacao,
          valor: valorNum,
          descricao: `Ajuste manual de saldo - ${tipoTransacao}`,
          data: new Date(),
          local: null,
          parcelado: false,
          totalParcelas: 1,
          parcelaAtual: 1,
          tags: ['ajuste-saldo'],
          excluido: false,
          distribuicaoAutomatica: false
        }
      });

      return {
        cartao: cartaoAtualizado,
        distribuicoes
      };
    });

    await invalidarCacheUsuario(req.user.id);

    const response = {
      success: true,
      message: 'Saldo atualizado com sucesso',
      cartao: resultado.cartao
    };


    if (resultado.distribuicoes && resultado.distribuicoes.length > 0) {
      response.distribuicaoAutomatica = {
        totalDistribuido: resultado.distribuicoes.reduce((acc, d) => acc + d.valor, 0),
        objetivos: resultado.distribuicoes
      };
      response.message = `Saldo atualizado e ${resultado.distribuicoes.length} objetivo(s) financiado(s) automaticamente`;
    }

    res.json(response);

  } catch (err) {
    next(err instanceof AppError ? err : new AppError('Erro ao atualizar saldo', 500));
  }
};

/**
 * ==========================================
 * DELETAR CARTÃO
 * ==========================================
 */
const deletarCartao = async (req, res, next) => {
  const { id } = req.params;

  try {
    const cartao = await prisma.cartao.findFirst({
      where: { id, usuarioId: req.user.id, excluido: false }
    });

    if (!cartao) {
      return next(new AppError('Cartão não encontrado', 404));
    }

    // Verificar transações associadas
    const transacoes = await prisma.gasto.count({
      where: { cartaoId: id, usuarioId: req.user.id, excluido: false }
    });

    if (transacoes > 0) {
      return next(new AppError(
        `Não é possível deletar este cartão porque existem ${transacoes} transações associadas.`, 
        409
      ));
    }

    // Soft delete
    await prisma.cartao.update({
      where: { id },
      data: { 
        ativo: false, 
        excluido: true, 
        numero: null 
      }
    });

    await invalidarCacheUsuario(req.user.id);

    res.json({ 
      success: true, 
      message: 'Cartão removido com sucesso' 
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  listarCartoes,
  criarCartao,
  atualizarCartao,
  atualizarSaldo,
  deletarCartao
};
