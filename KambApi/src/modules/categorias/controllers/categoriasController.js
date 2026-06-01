// src/controllers/categoriasController.js
const prisma = require('../../../lib/prisma');
const AppError = require('../../../middleware/AppError');
const { invalidarCacheUsuario } = require('../../insights/controllers/insightsController');

/**
 * ==========================================
 * CATEGORIAS PADRÃO DO SISTEMA
 * ==========================================
 */
const CATEGORIAS_PADRAO = [
  // ESSENCIAIS (Despesas obrigatórias)
  { nome: 'Casa/Renda', tipo: 'ESSENCIAL', cor: '#ef4444', icone: 'home' },
  { nome: 'Alimentação', tipo: 'ESSENCIAL', cor: '#f97316', icone: 'utensils' },
  { nome: 'Transporte', tipo: 'ESSENCIAL', cor: '#f59e0b', icone: 'car' },
  { nome: 'Saúde', tipo: 'ESSENCIAL', cor: '#06b6d4', icone: 'heart-pulse' },
  { nome: 'Educação', tipo: 'ESSENCIAL', cor: '#3b82f6', icone: 'graduation-cap' },
  
  // FLEXÍVEIS (Despesas controláveis)
  { nome: 'Lazer', tipo: 'FLEXIVEL', cor: '#8b5cf6', icone: 'gamepad-2' },
  { nome: 'Restaurantes', tipo: 'FLEXIVEL', cor: '#ec4899', icone: 'utensils-crossed' },
  { nome: 'Compras', tipo: 'FLEXIVEL', cor: '#f43f5e', icone: 'shopping-bag' },
  { nome: 'Viagens', tipo: 'FLEXIVEL', cor: '#10b981', icone: 'plane' },
  
  // POUPANÇA
  { nome: 'Fundo Emergência', tipo: 'POUPANCA', cor: '#14b8a6', icone: 'shield' },
  { nome: 'Investimentos', tipo: 'POUPANCA', cor: '#22c55e', icone: 'trending-up' },
  { nome: 'Metas', tipo: 'POUPANCA', cor: '#84cc16', icone: 'target' },
  
  // RENDIMENTOS
  { nome: 'Salário', tipo: 'RENDIMENTO', cor: '#10b981', icone: 'briefcase' },
  { nome: 'Freelance', tipo: 'RENDIMENTO', cor: '#22c55e', icone: 'laptop' },
  { nome: 'Negócio', tipo: 'RENDIMENTO', cor: '#16a34a', icone: 'store' },
  { nome: 'Outros Ganhos', tipo: 'RENDIMENTO', cor: '#15803d', icone: 'gift' }
];

/**
 * ==========================================
 * LISTAR TODAS AS CATEGORIAS
 * ==========================================
 * Retorna categorias padrão + personalizadas do usuário
 * Agora com suporte a filtro por tipo e agrupamento
 */
const listarCategorias = async (req, res, next) => {
  try {
    const { tipo } = req.query; // Filtro opcional por tipo
    
    const where = {
      OR: [
        { padrao: true },                    // categorias padrão do sistema
        { usuarioId: req.user.id }           // categorias criadas pelo usuário
      ],
      AND: {
        excluido: false
      },
      ...(tipo && { tipo }) // Filtro por tipo se fornecido
    };

    const categorias = await prisma.categoria.findMany({
      where,
      orderBy: [
        { tipo: 'asc' },      // Agrupa por tipo primeiro
        { padrao: 'desc' },   // Padrão primeiro dentro de cada tipo
        { ordem: 'asc' },
        { nome: 'asc' }
      ]
    });

    // Agrupa por tipo para melhor organização no frontend
    const agrupadas = categorias.reduce((acc, cat) => {
      if (!acc[cat.tipo]) acc[cat.tipo] = [];
      acc[cat.tipo].push(cat);
      return acc;
    }, {});

    res.json({
      success: true,
      message: 'Categorias carregadas com sucesso',
      total: categorias.length,
      agrupadas, // Novo: categorias agrupadas por tipo
      padrao: categorias.filter(c => c.padrao),
      personalizadas: categorias.filter(c => !c.padrao && c.usuarioId === req.user.id),
      categorias, // Mantém compatibilidade com frontend antigo
      tiposDisponiveis: ['ESSENCIAL', 'FLEXIVEL', 'POUPANCA', 'RENDIMENTO']
    });

  } catch (err) {
    next(err);
  }
};

/**
 * ==========================================
 * CRIAR CATEGORIA PERSONALIZADA
 * ==========================================
 */
const criarCategoria = async (req, res, next) => {
  const { nome, tipo, cor, icone } = req.body;

  if (!nome || nome.trim().length < 2) {
    return next(new AppError('Nome da categoria é obrigatório e deve ter pelo menos 2 caracteres', 400));
  }

  if (!tipo || !['ESSENCIAL', 'FLEXIVEL', 'POUPANCA', 'RENDIMENTO'].includes(tipo)) {
    return next(new AppError('Tipo de categoria inválido. Use: ESSENCIAL, FLEXIVEL, POUPANCA ou RENDIMENTO', 400));
  }

  try {
    // Verifica se já existe categoria com este nome para este usuário
    const existe = await prisma.categoria.findFirst({
      where: {
        usuarioId: req.user.id,
        nome: { equals: nome.trim(), mode: 'insensitive' }, // Case insensitive
        excluido: false
      }
    });

    if (existe) {
      return next(new AppError('Já tens uma categoria com este nome', 409));
    }

    const categoria = await prisma.categoria.create({
      data: {
        nome: nome.trim(),
        tipo, // Enum: ESSENCIAL, FLEXIVEL, POUPANCA, RENDIMENTO
        cor: cor || getCorPadraoPorTipo(tipo),
        icone: icone || 'tag',
        padrao: false,
        usuarioId: req.user.id,
        ordem: 999, // será reordenado depois se necessário
        excluido: false,
        ativa: true
      }
    });

    // Invalida cache pois categorias mudaram
    await invalidarCacheUsuario(req.user.id);

    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso!',
      categoria
    });

  } catch (err) {
    if (err.code === 'P2002') { // Unique constraint violation
      return next(new AppError('Já tens uma categoria com este nome', 409));
    }
    next(err);
  }
};

/**
 * ==========================================
 * ATUALIZAR CATEGORIA PERSONALIZADA
 * ==========================================
 */
const atualizarCategoria = async (req, res, next) => {
  const { id } = req.params;
  const { nome, cor, icone, ordem, ativa } = req.body;
  const dados = {};

  // Constrói objeto com apenas os campos fornecidos
  if (nome !== undefined) dados.nome = nome.trim();
  if (cor !== undefined) dados.cor = cor;
  if (icone !== undefined) dados.icone = icone;
  if (ordem !== undefined) dados.ordem = ordem;
  if (ativa !== undefined) dados.ativa = ativa;

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nada para atualizar', 400));
  }

  try {
    // Verifica se é uma categoria personalizada do usuário
    const categoriaExistente = await prisma.categoria.findFirst({
      where: {
        id,
        usuarioId: req.user.id,
        padrao: false, // não permite editar categorias padrão
        excluido: false
      }
    });

    if (!categoriaExistente) {
      return next(new AppError('Categoria não encontrada ou não pode ser editada', 404));
    }

    // Se estiver atualizando o nome, verifica duplicidade
    if (dados.nome) {
      const duplicado = await prisma.categoria.findFirst({
        where: {
          usuarioId: req.user.id,
          nome: { equals: dados.nome, mode: 'insensitive' },
          id: { not: id }, // exclui a própria categoria da verificação
          excluido: false
        }
      });

      if (duplicado) {
        return next(new AppError('Já existe outra categoria com este nome', 409));
      }
    }

    const categoria = await prisma.categoria.update({
      where: { id },
      data: dados
    });

    // Invalida cache
    await invalidarCacheUsuario(req.user.id);

    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      categoria
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return next(new AppError('Já existe outra categoria com este nome', 409));
    }
    if (err.code === 'P2025') {
      return next(new AppError('Categoria não encontrada', 404));
    }
    next(err);
  }
};

/**
 * ==========================================
 * DELETAR CATEGORIA PERSONALIZADA
 * ==========================================
 * Verifica dependências e faz soft/hard delete conforme necessário
 */
const deletarCategoria = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Verifica se a categoria existe, é do usuário e é personalizada (não padrão)
    const categoria = await prisma.categoria.findFirst({
      where: {
        id,
        usuarioId: req.user.id,
        padrao: false, // não permite deletar categorias padrão do sistema
        excluido: false
      }
    });

    if (!categoria) {
      return next(new AppError('Categoria não encontrada ou não pode ser removida', 404));
    }

    // Verifica se há gastos associados a esta categoria
    const gastosAssociados = await prisma.gasto.count({
      where: {
        categoriaId: id,
        usuarioId: req.user.id,
        excluido: false
      }
    });

    if (gastosAssociados > 0) {
      // Soft delete: marca como inativa em vez de remover
      await prisma.categoria.update({
        where: { id },
        data: { 
          ativa: false,
          excluido: true,
          nome: `${categoria.nome} (removida)` // renomear para evitar conflitos futuros
        }
      });

      // Invalida cache
      await invalidarCacheUsuario(req.user.id);
      
      return res.json({
        success: true,
        message: `Categoria arquivada (estava em uso em ${gastosAssociados} transações)`
      });
    }

    // Hard delete se não tem gastos associados
    await prisma.categoria.delete({
      where: { id }
    });

    // Invalida cache pois categorias mudaram
    await invalidarCacheUsuario(req.user.id);

    res.json({
      success: true,
      message: 'Categoria removida com sucesso'
    });

  } catch (err) {
    if (err.code === 'P2025') {
      return next(new AppError('Categoria não encontrada', 404));
    }
    next(err);
  }
};

/**
 * ==========================================
 * HELPER: Cor padrão por tipo
 * ==========================================
 */
function getCorPadraoPorTipo(tipo) {
  const cores = {
    'ESSENCIAL': '#ef4444',
    'FLEXIVEL': '#8b5cf6',
    'POUPANCA': '#14b8a6',
    'RENDIMENTO': '#10b981'
  };
  return cores[tipo] || '#6b7280';
}

module.exports = {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria,
  CATEGORIAS_PADRAO // Exporta para seed/migração
};
