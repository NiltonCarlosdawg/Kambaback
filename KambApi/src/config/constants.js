// src/config/constants.js
// VERSÃO DEFINITIVA – 100% COMPLETA – NUNCA MAIS VAI FALTAR NADA!

const TIPOS_CARTOES = [
  { valor: 'multicaixa', label: 'Multicaixa' },
  { valor: 'conta_bancaria', label: 'Conta Bancária' },
  { valor: 'ekwanza', label: 'E-Kwanza' },
  { valor: 'credito', label: 'Cartão de Crédito' },
  { valor: 'debito', label: 'Cartão de Débito' },
  { valor: 'investimento', label: 'Investimento' }
];

const CATEGORIAS_OBJETIVOS = [
  { valor: 'casa', label: 'Casa' },
  { valor: 'carro', label: 'Carro' },
  { valor: 'educacao', label: 'Educação' },
  { valor: 'viagem', label: 'Viagem' },
  { valor: 'emergencia', label: 'Fundo de Emergência' },
  { valor: 'negocio', label: 'Negócio' },
  { valor: 'casamento', label: 'Casamento' },
  { valor: 'aposentadoria', label: 'Aposentadoria' },
  { valor: 'outro', label: 'Outro' }
];

const PRIORIDADES_OBJETIVO = [
  { valor: 'baixa', label: 'Baixa' },
  { valor: 'media', label: 'Média' },
  { valor: 'alta', label: 'Alta' },
  { valor: 'urgente', label: 'Urgente' }
];

const STATUS_OBJETIVO = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  ATRASADO: 'Atrasado'
};

const CATEGORIAS_GASTOS_PADRAO = [
  { nome: 'Alimentação', chave: 'alimentacao', icon: 'Utensils', color: '#FF6384' },
  { nome: 'Transporte', chave: 'transporte', icon: 'Fuel', color: '#36A2EB' },
  { nome: 'Casa', chave: 'casa', icon: 'Home', color: '#FFCE56' },
  { nome: 'Saúde', chave: 'saude', icon: 'Heart', color: '#4BC0C0' },
  { nome: 'Lazer', chave: 'lazer', icon: 'Music', color: '#9966FF' },
  { nome: 'Educação', chave: 'educacao', icon: 'Book', color: '#FF9F40' },
  { nome: 'Vestuário', chave: 'vestuario', icon: 'ShoppingBag', color: '#E91E63' },
  { nome: 'Outros', chave: 'outros', icon: 'MoreHorizontal', color: '#9E9E9E' }
];

const CATEGORIAS_RECEITAS_PADRAO = [
  { nome: 'Salário', chave: 'salario', icon: 'Briefcase', color: '#4CAF50' },
  { nome: 'Freelance', chave: 'freelance', icon: 'Laptop', color: '#2196F3' },
  { nome: 'Investimentos', chave: 'investimentos', icon: 'TrendingUp', color: '#FF9800' },
  { nome: 'Outras Receitas', chave: 'outras_receitas', icon: 'Gift', color: '#9C27B0' }
];

const MOEDA_PADRAO = 'AOA';

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
};

// EXPORTA TUDO CORRETAMENTE
module.exports = {
  TIPOS_CARTOES,
  CATEGORIAS_OBJETIVOS,
  PRIORIDADES_OBJETIVO,
  STATUS_OBJETIVO,
  CATEGORIAS_GASTOS_PADRAO,
  CATEGORIAS_RECEITAS_PADRAO,
  MOEDA_PADRAO,
  HTTP_STATUS
};