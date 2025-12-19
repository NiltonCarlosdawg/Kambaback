const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 A iniciar o seeding da base de dados...');

  // 1. Criar Categorias Padrão
  const categorias = [
    { nome: 'Alimentação', tipo: 'despesa', cor: '#FF5733', icone: 'utensils' },
    { nome: 'Transporte', tipo: 'despesa', cor: '#33B5FF', icone: 'car' },
    { nome: 'Lazer', tipo: 'despesa', cor: '#8E44AD', icone: 'gamepad' },
    { nome: 'Salário', tipo: 'receita', cor: '#2ECC71', icone: 'money-bill-wave' },
    { nome: 'Saúde', tipo: 'despesa', cor: '#E74C3C', icone: 'heartbeat' },
    { nome: 'Educação', tipo: 'despesa', cor: '#F1C40F', icone: 'graduation-cap' },
  ];

  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where: { nome: cat.nome }, // Evita duplicados se correres o script 2x
      update: {},
      create: cat,
    });
  }
  console.log('✅ Categorias criadas.');

  console.log('🚀 Seeding concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });