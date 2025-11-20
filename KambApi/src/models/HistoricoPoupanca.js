// src/models/HistoricoPoupanca.js
const mongoose = require('mongoose');
const { MOEDA_PADRAO } = require('../config/constants');

/**
 * ==========================================
 * HISTÓRICO MENSAL DE POUPANÇA / PATRIMÔNIO
 * ==========================================
 * Um registro por mês/ano para cada usuário
 * Usado nos gráficos de evolução e relatórios
 */
const historicoPoupancaSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Histórico precisa de um usuário'],
    index: true
  },

  ano: {
    type: Number,
    required: true,
    min: [2020, 'Ano muito antigo'],
    max: [2100, 'Ano muito futuro']
  },

  mes: {
    type: Number,
    required: true,
    min: [1, 'Mês deve ser de 1 a 12'],
    max: [12, 'Mês deve ser de 1 a 12']
  },

  // Valores no FINAL do mês
  saldoTotal: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  totalReceitas: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  totalDespesas: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  poupancaLiquida: {
    type: Number,
    default: function() {
      return this.totalReceitas - this.totalDespesas;
    }
  },

  // Percentual de poupança do mês
  taxaPoupanca: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Quantidade de transações no mês
  totalTransacoes: {
    type: Number,
    default: 0,
    min: 0
  },

  moeda: {
    type: String,
    enum: ['AOA', 'USD', 'EUR'],
    default: MOEDA_PADRAO
  },

  // Metadados
  calculadoEm: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

/**
 * ==========================================
 * ÍNDICES (cruciais para performance de gráficos)
 * ==========================================
 */
historicoPoupancaSchema.index({ usuario: 1, ano: -1, mes: -1 }, { unique: true });
historicoPoupancaSchema.index({ usuario: 1, calculadoEm: -1 });

/**
 * ==========================================
 * COMPOUND INDEX PARA GRÁFICOS
 * ==========================================
 */
historicoPoupancaSchema.index({ usuario: 1, ano: 1, mes: 1 });

/**
 * ==========================================
 * VIRTUALS
 * ==========================================
 */
historicoPoupancaSchema.virtual('mesNome').get(function() {
  const nomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return nomes[this.mes - 1];
});

historicoPoupancaSchema.virtual('periodoFormatado').get(function() {
  return `${this.mesNome} ${this.ano}`;
});

historicoPoupancaSchema.virtual('saldoFormatado').get(function() {
  return this.saldoTotal.toLocaleString('pt-AO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + ' AOA';
});

/**
 * ==========================================
 * MÉTODOS ESTÁTICOS - MUITO PODEROSOS
 * ==========================================
 */

// Gera ou atualiza o histórico do mês atual
historicoPoupancaSchema.statics.atualizarMesAtual = async function(usuarioId) {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  // Busca totais do mês via aggregation direta no Gasto + Cartao
  const resultado = await mongoose.model('Gasto').aggregate([
    {
      $match: {
        usuario: mongoose.Types.ObjectId(usuarioId),
        data: {
          $gte: new Date(ano, mes - 1, 1),
          $lt: new Date(ano, mes, 0, 23, 59, 59)
        },
        excluido: false
      }
    },
    {
      $group: {
        _id: '$tipo',
        total: { $sum: '$valor' },
        count: { $sum: 1 }
      }
    }
  ]);

  const cartoes = await mongoose.model('Cartao').find({ usuario: usuarioId, ativo: true });
  const saldoTotal = cartoes.reduce((acc, c) => acc + c.saldoAtual, 0);

  let receitas = 0;
  let despesas = 0;
  let transacoes = 0;

  resultado.forEach(r => {
    transacoes += r.count;
    if (r._id === 'receita') receitas = r.total;
    if (r._id === 'despesa') despesas = r.total;
  });

  const poupanca = receitas - despesas;
  const taxa = receitas > 0 ? Math.round((poupanca / receitas) * 100) : 0;

  return this.findOneAndUpdate(
    { usuario: usuarioId, ano, mes },
    {
      saldoTotal,
      totalReceitas: receitas,
      totalDespesas: despesas,
      poupancaLiquida: poupanca,
      taxaPoupanca: taxa,
      totalTransacoes: transacoes,
      calculadoEm: new Date()
    },
    { upsert: true, new: true }
  );
};

// Retorna histórico completo para gráficos (últimos 24 meses)
historicoPoupancaSchema.statics.getGraficoEvolucao = async function(usuarioId, anos = 2) {
  const dataLimite = new Date();
  dataLimite.setFullYear(dataLimite.getFullYear() - anos);

  return this.find({
    usuario: usuarioId,
    calculadoEm: { $gte: dataLimite }
  })
  .sort({ ano: 1, mes: 1 })
  .select('ano mes saldoTotal poupancaLiquida taxaPoupanca mesNome periodoFormatado');
};

module.exports = mongoose.model('HistoricoPoupanca', historicoPoupancaSchema);