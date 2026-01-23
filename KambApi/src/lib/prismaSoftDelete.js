// src/lib/prismaSoftDelete.ts
import prisma from './prisma';

// Wrapper para findMany / findFirst / count / etc que ignora excluídos
export const prismaNoDeleted = {
  $queryRaw: prisma.$queryRaw,
  $executeRaw: prisma.$executeRaw,

  gasto: {
    findMany: (args: any) => prisma.gasto.findMany({ ...args, where: { ...args?.where, excluido: false } }),
    findFirst: (args: any) => prisma.gasto.findFirst({ ...args, where: { ...args?.where, excluido: false } }),
    count: (args: any) => prisma.gasto.count({ ...args, where: { ...args?.where, excluido: false } }),
    // adiciona outros métodos que usas
  },

  cartao: {
    findMany: (args: any) => prisma.cartao.findMany({ ...args, where: { ...args?.where, excluido: false } }),
    findFirst: (args: any) => prisma.cartao.findFirst({ ...args, where: { ...args?.where, excluido: false } }),
    // ...
  },

  objetivo: {
    findMany: (args: any) => prisma.objetivo.findMany({ ...args, where: { ...args?.where, excluido: false } }),
    // ...
  },

  categoria: {
    findMany: (args: any) => prisma.categoria.findMany({ ...args, where: { ...args?.where, excluido: false } }),
    // ...
  },

  // Adiciona para outros modelos conforme necessário
};

// Exporta o prisma normal para casos onde precisas ver excluídos (ex: admin)
export { prisma as prismaAdmin };