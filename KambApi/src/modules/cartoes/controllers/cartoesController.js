const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { invalidarCacheUsuario } = require('../../insights/controllers/insightsController');

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

    res.json({
      success: true,
      message: 'Cartões carregados com sucesso',
      cartoes,
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
    distribuirParaObjetivos = false
  } = req.body;

  const tiposValidos = ['DEBITO', 'CREDITO', 'POUPANCA'];
  if (!tiposValidos.includes(tipo)) {
    return next(new AppError('Tipo de cartão inválido. Use: DEBITO, CREDITO ou POUPANCA', 400));
  }

  try {
    // Verifica duplicidade de número
    if (numero) {
      const existe = await prisma.cartao.findFirst({
        where: {
          usuarioId: req.user.id,
          numero: numero.trim(),
          excluido: false
        }
      });

      if (existe) {
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
        numero: numero?.trim() || null,
        saldoAtual: saldoInicialAtual,
        saldoDisponivel: saldoInicialDisponivel,
        saldoReservado: 0,
        limiteCredito: limiteCredFinal,
        diaFechamento: tipo === 'CREDITO' ? diaFechamento : null,
        diaVencimento: tipo === 'CREDITO' ? diaVencimento : null,
        cor,
        icone,
        distribuirParaObjetivos: !!distribuirParaObjetivos,
        ativo: true,
        excluido: false
      }
    });

    await invalidarCacheUsuario(req.user.id);

    res.status(201).json({
      success: true,
      message: `Cartão de ${tipo.toLowerCase()} adicionado com sucesso!`,
      cartao
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
    'diaFechamento', 'diaVencimento'
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

      const saldoAtual = Number(cartao.saldoAtual);
      const saldoDisponivel = Number(cartao.saldoDisponivel);
      const saldoReservado = Number(cartao.saldoReservado);

      let novoSaldoAtual = saldoAtual;
      let novoSaldoDisponivel = saldoDisponivel;
      let novoSaldoReservado = saldoReservado;
      let distribuicoes = [];

      // ==========================================
      // LÓGICA DE RECEITA
      // ==========================================
      if (tipoTransacao === 'RECEITA') {
        if (cartao.tipo === 'CREDITO') {
          
          novoSaldoAtual = Math.max(0, saldoAtual - valorNum);
          novoSaldoDisponivel = saldoDisponivel + valorNum;
        } else {
          
          novoSaldoAtual = saldoAtual + valorNum;
          novoSaldoDisponivel = saldoDisponivel + valorNum;
        }

       
        if (cartao.distribuirParaObjetivos) {
          const objetivos = await tx.objetivo.findMany({
            where: {
              usuarioId: req.user.id,
              concluido: false,
              excluido: false,
              porcentagemDistribuicao: { gt: 0 }
            },
            orderBy: { prioridade: 'desc' }
          });

          if (objetivos.length > 0) {
            let totalDistribuido = 0;

            for (const objetivo of objetivos) {
              const porcentagem = Number(objetivo.porcentagemDistribuicao);
              const valorObjetivo = (valorNum * porcentagem) / 100;
              
            
              const objetivoAtualizado = await tx.objetivo.update({
                where: { id: objetivo.id },
                data: {
                  valorAtual: {
                    increment: valorObjetivo
                  }
                }
              });

              totalDistribuido += valorObjetivo;
              distribuicoes.push({
                objetivoId: objetivo.id,
                titulo: objetivo.titulo,
                porcentagem,
                valor: valorObjetivo,
                novoValorAtual: Number(objetivoAtualizado.valorAtual)
              });
            }

            
            if (totalDistribuido > 0) {
              novoSaldoDisponivel -= totalDistribuido;
              novoSaldoReservado += totalDistribuido;
            }
          }
        }
      }

      // ==========================================
      // LÓGICA DE DESPESA
      // ==========================================
      else if (tipoTransacao === 'DESPESA') {
        if (cartao.tipo === 'CREDITO') {
        
          if (saldoDisponivel < valorNum) {
            throw new AppError(
              `Limite de crédito insuficiente no cartão ${cartao.nome}. ` +
              `Disponível: ${saldoDisponivel.toFixed(2)} Kz`,
              400
            );
          }
          novoSaldoAtual = saldoAtual + valorNum;
          novoSaldoDisponivel = saldoDisponivel - valorNum;
        } else {
          
          if (saldoDisponivel < valorNum) {
            throw new AppError(
              `Saldo disponível insuficiente no cartão ${cartao.nome}. ` +
              `Disponível: ${saldoDisponivel.toFixed(2)} Kz`,
              400
            );
          }
          novoSaldoAtual = saldoAtual - valorNum;
          novoSaldoDisponivel = saldoDisponivel - valorNum;
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