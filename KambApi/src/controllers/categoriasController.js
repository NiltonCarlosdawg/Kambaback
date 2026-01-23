// src/controllers/categoriasController.js
const prisma = require('../lib/prisma');
const AppError = require('../middleware/AppError');

/**
 * ==========================================
 * LISTAR TODAS AS CATEGORIAS (padrão + personalizadas do usuário)
 * ==========================================
 */
const listarCategorias = async (req, res, next) => {
  try {
    const categorias = await prisma.categoria.findMany({
      where: {
        OR: [
          { padrao: true },                    // categorias padrão do sistema
          { usuarioId: req.user.id }           // categorias criadas pelo usuário
        ]
      },
      orderBy: [
        { padrao: 'desc' },   // padrão primeiro
        { ordem: 'asc' },
        { nome: 'asc' }
      ]
    });

    res.json({
      success: true,
      message: 'Categorias carregadas com sucesso',
      total: categorias.length,
      padrao: categorias.filter(c => c.padrao),
      personalizadas: categorias.filter(c => !c.padrao),
      categorias // mantém compatibilidade com frontend antigo
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
  const { nome, tipo = 'despesa', cor, icone = 'category' } = req.body;

  if (!nome || nome.trim().length < 2) {
    return next(new AppError('Nome da categoria é obrigatório e deve ter pelo menos 2 caracteres', 400));
  }

  try {
    const categoria = await prisma.categoria.create({
      data: {
        nome: nome.trim(),
        tipo,
        cor: cor || '#6B7280',
        icone: icone || 'category',
        padrao: false,
        usuarioId: req.user.id,
        ordem: 999 // será reordenado depois se necessário
      }
    });

    res.status(201).json({
      success: true,
      message: 'Categoria criada com sucesso!',
      categoria
    });

  } catch (err) {
    if (err.code === 'P2002') { // Unique constraint violation (nome duplicado por usuário)
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
  const camposPermitidos = ['nome', 'cor', 'icone', 'ordem', 'ativa'];
  const dados = {};

  for (const campo of camposPermitidos) {
    if (req.body[campo] !== undefined) {
      dados[campo] = req.body[campo];
    }
  }

  if (Object.keys(dados).length === 0) {
    return next(new AppError('Nada para atualizar', 400));
  }

  try {
    const categoria = await prisma.categoria.updateMany({
      where: {
        id,
        usuarioId: req.user.id,
        padrao: false // não permite editar categorias padrão
      },
      data: dados
    });

    if (categoria.count === 0) {
      return next(new AppError('Categoria não encontrada ou não pode ser editada', 404));
    }

    const atualizada = await prisma.categoria.findUnique({ where: { id } });

    res.json({
      success: true,
      message: 'Categoria atualizada com sucesso',
      categoria: atualizada
    });

  } catch (err) {
    if (err.code === 'P2002') {
      return next(new AppError('Já existe outra categoria com este nome', 409));
    }
    next(err);
  }
};

/**
 * ==========================================
 * DELETAR CATEGORIA PERSONALIZADA (só se não estiver em uso)
 * ==========================================
 */
const deletarCategoria = async (req, res, next) => {
  const { id } = req.params;

  try {
    const atualizado = await prisma.gasto.update({
      where: { id, usuarioId: req.user.id },
      data: { excluido: true }
    });

    // Invalida cache se tiver
    await invalidarCacheUsuario(req.user.id);

    res.json({
      success: true,
      message: 'Gasto removido com sucesso (movido para lixeira)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  deletarCategoria
};