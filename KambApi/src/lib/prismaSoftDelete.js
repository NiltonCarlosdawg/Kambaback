// src/lib/prismaSoftDelete.js
const prisma = require('./prisma');

// Wrapper para findMany / findFirst / count / etc que ignora excluídos
const prismaNoDeleted = {
  $queryRaw: prisma.$queryRaw,
  $executeRaw: prisma.$executeRaw,

  gasto: {
    findMany: (args) => prisma.gasto.findMany({ ...args, where: { ...args?.where, excluido: false } }),
    findFirst: (args) => prisma.gasto.findFirst({ ...args, where: { ...args?.where, excluido: false } }),
    count: (args) => prisma.gasto.count({ ...args, where: { ...args?.where, excluido: false } }),
    update: (args) => prisma.gasto.update({ 
      ...args, 
      where: { ...args?.where, excluido: false },
      data: args.data 
    }),
    updateMany: (args) => prisma.gasto.updateMany({ 
      ...args, 
      where: { ...args?.where, excluido: false },
      data: args.data 
    }),
    delete: (args) => prisma.gasto.delete({ 
      ...args, 
      where: { ...args?.where, excluido: false } 
    }),
    deleteMany: (args) => prisma.gasto.deleteMany({ 
      ...args, 
      where: { ...args?.where, excluido: false } 
    }),
  },

  cartao: {
    findMany: (args) => prisma.cartao.findMany({ ...args, where: { ...args?.where, excluido: false } }),
    findFirst: (args) => prisma.cartao.findFirst({ ...args, where: { ...args?.where, excluido: false } }),
    count: (args) => prisma.cartao.count({ ...args, where: { ...args?.where, excluido: false } }),
    update: (args) => prisma.cartao.update({ 
      ...args, 
      where: { ...args?.where, excluido: false },
      data: args.data 
    }),
    updateMany: (args) => prisma.cartao.updateMany({ 
      ...args, 
      where: { ...args?.where, excluido: false },
      data: args.data 
    }),
  },

  objetivo: {
    findMany: (args) => prisma.objetivo.findMany({ ...args, where: { ...args?.where, excluido: false } }),
    findFirst: (args) => prisma.objetivo.findFirst({ ...args, where: { ...args?.where, excluido: false } }),
    count: (args) => prisma.objetivo.count({ ...args, where: { ...args?.where, excluido: false } }),
    update: (args) => prisma.objetivo.update({ 
      ...args, 
      where: { ...args?.where, excluido: false },
      data: args.data 
    }),
  },

  categoria: {
    findMany: (args) => prisma.categoria.findMany({ ...args, where: { ...args?.where, excluido: false } }),
    findFirst: (args) => prisma.categoria.findFirst({ ...args, where: { ...args?.where, excluido: false } }),
    count: (args) => prisma.categoria.count({ ...args, where: { ...args?.where, excluido: false } }),
    update: (args) => prisma.categoria.update({ 
      ...args, 
      where: { ...args?.where, excluido: false },
      data: args.data 
    }),
  },

  // Soft delete helpers - marcam como excluído em vez de deletar
  softDelete: {
    gasto: (args) => prisma.gasto.update({
      where: args.where,
      data: { excluido: true, ativo: false }
    }),
    cartao: (args) => prisma.cartao.update({
      where: args.where,
      data: { excluido: true, ativo: false }
    }),
    objetivo: (args) => prisma.objetivo.update({
      where: args.where,
      data: { excluido: true }
    }),
    categoria: (args) => prisma.categoria.update({
      where: args.where,
      data: { excluido: true, ativa: false }
    }),
  }
};

// Exporta o prisma normal para casos onde precisas ver excluídos (ex: admin)
const prismaAdmin = prisma;

module.exports = {
  prismaNoDeleted,
  prismaAdmin
};