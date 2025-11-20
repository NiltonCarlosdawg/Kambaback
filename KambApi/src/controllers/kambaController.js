// src/controllers/kambaController.js
const Gasto = require('../models/Gasto');
const Cartao = require('../models/Cartao');
const Objetivo = require('../models/Objetivo');
const { successResponse } = require('../utils/responseFormatter');

/**
 * ==========================================
 * KAMBA – ASSISTENTE VIRTUAL ANGOLANO
 * ==========================================
 */
const conversarComKamba = async (req, res, next) => {
  try {
    const { mensagem } = req.body;
    const usuarioId = req.usuarioId;

    const msg = mensagem.toLowerCase().trim();

    // ==========================================
    // 1. SALDOS E CARTÕES
    // ==========================================
    if (msg.includes('saldo') || msg.includes('quanto tenho') || msg.includes('dinheiro')) {
      const cartoes = await Cartao.find({ usuario: usuarioId, ativo: true });
      const total = cartoes.reduce((acc, c) => acc + c.saldoAtual, 0);

      if (total === 0) {
        return kambaResponse(res, 'Mano... o teu saldo tá a zero. Hora de trabalhar ou poupar mais! 💪');
      }

      const nomes = cartoes.map(c => c.nome).join(', ');
      return kambaResponse(res, 
        `Tens ${total.toLocaleString('pt-AO')} AOA no total! 💰\nCartões: ${nomes}\nBora gastar com cabeça ou guardar pro futuro, kamba!`
      );
    }

    // ==========================================
    // 2. ÚLTIMO GASTO
    // ==========================================
    if (msg.includes('último gasto') || msg.includes('gasto mais recente') || msg.includes('comprei o quê')) {
      const ultimo = await Gasto.findOne({ usuario: usuarioId, excluido: false })
        .sort({ data: -1 })
        .populate('cartao', 'nome');

      if (!ultimo) {
        return kambaResponse(res, 'Ainda não tens nenhum gasto registrado, mano! Tá tudo limpo! 🎉');
      }

      const valor = ultimo.valor.toLocaleString('pt-AO');
      const data = new Date(ultimo.data).toLocaleDateString('pt-AO');
      return kambaResponse(res, 
        `Teu último gasto foi ${valor} AOA em *${ultimo.categoria}* 💸\nNo cartão: ${ultimo.cartao.nome}\nDia: ${data}\n${ultimo.descricao ? '("' + ultimo.descricao + '")' : ''}`
      );
    }

    // ==========================================
    // 3. GASTOS DO MÊS
    // ==========================================
    if (msg.includes('gastei quanto') || msg.includes('este mês') || msg.includes('quanto gastei')) {
      const inicio = new Date();
      inicio.setDate(1);
      const total = await Gasto.aggregate([
        { $match: { usuario: usuarioId, tipo: 'despesa', data: { $gte: inicio }, excluido: false } },
        { $group: { _id: null, total: { $sum: '$valor' } } }
      ]);

      const gasto = total[0]?.total || 0;
      if (gasto === 0) {
        return kambaResponse(res, 'Este mês ainda não gastaste nada! Tá de parabéns, kamba! 🏆');
      }

      return kambaResponse(res, 
        `Este mês já gastaste ${gasto.toLocaleString('pt-AO')} AOA 💸\nControla aí, mano! Ainda tem muito mês pela frente!`
      );
    }

    // ==========================================
    // 4. OBJETIVOS
    // ==========================================
    if (msg.includes('objetivo') || msg.includes('sonho') || msg.includes('poupar')) {
      const objetivos = await Objetivo.find({ usuario: usuarioId, ativo: true, status: 'EM_ANDAMENTO' })
        .sort({ dataPrevista: 1 })
        .limit(3);

      if (objetivos.length === 0) {
        return kambaResponse(res, 'Ainda não tens objetivos, kamba! Bora criar um? Clica em Objetivos e vamos sonhar alto! 🇦🇴');
      }

      const proximo = objetivos[0];
      const faltam = proximo.valorFaltante.toLocaleString('pt-AO');
      const progresso = Math.round(proximo.progressoPercentual);

      return kambaResponse(res, 
        `Teu próximo objetivo é: *${proximo.titulo}* 🎯\nFaltam ${faltam} AOA (${progresso}% feito)\nVamos lá, kamba! Tu consegues! 🔥`
      );
    }

    // ==========================================
    // 5. MOTIVAÇÃO / SAUDAÇÃO
    // ==========================================
    if (msg.includes('oi') || msg.includes('olá') || msg.includes('kamba') || msg.includes('tudo bem')) {
      const hora = new Date().getHours();
      const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
      return kambaResponse(res, `${saudacao}, kamba! 💪\nComo tá a gestão do dinheiro hoje? Quer saber saldo, último gasto ou objetivo? Só falar!`);
    }

    // ==========================================
    // RESPOSTA PADRÃO (sempre útil)
    // ==========================================
    return kambaResponse(res, 
      `E aí, kamba! 😎\nPodes perguntar:\n• "Quanto tenho de saldo?"\n• "Qual foi o último gasto?"\n• "Quanto gastei este mês?"\n• "Como tá meu objetivo?"\n\nOu só dizer "oi" que eu te respondo na hora! 🚀`
    );

  } catch (err) {
    next(err);
  }
};

// Helper para resposta formatada do Kamba
const kambaResponse = (res, texto) => {
  return successResponse(res, {
    mensagem: texto,
    kamba: true,
    timestamp: new Date()
  });
};

module.exports = {
  conversarComKamba
};