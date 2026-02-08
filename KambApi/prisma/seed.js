// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Categorias padrão do sistema (atualizadas para novos tipos)
const categorias = [
  // ESSENCIAIS (Despesas obrigatórias)
  { nome: 'Casa/Renda', tipo: 'ESSENCIAL', cor: '#ef4444', icone: 'home', ordem: 1 },
  { nome: 'Alimentação', tipo: 'ESSENCIAL', cor: '#f97316', icone: 'utensils', ordem: 2 },
  { nome: 'Transporte', tipo: 'ESSENCIAL', cor: '#f59e0b', icone: 'car', ordem: 3 },
  { nome: 'Saúde', tipo: 'ESSENCIAL', cor: '#06b6d4', icone: 'heart-pulse', ordem: 4 },
  { nome: 'Educação', tipo: 'ESSENCIAL', cor: '#3b82f6', icone: 'graduation-cap', ordem: 5 },
  
  // FLEXÍVEIS (Despesas controláveis)
  { nome: 'Lazer', tipo: 'FLEXIVEL', cor: '#8b5cf6', icone: 'gamepad-2', ordem: 6 },
  { nome: 'Restaurantes', tipo: 'FLEXIVEL', cor: '#ec4899', icone: 'utensils-crossed', ordem: 7 },
  { nome: 'Compras', tipo: 'FLEXIVEL', cor: '#f43f5e', icone: 'shopping-bag', ordem: 8 },
  { nome: 'Viagens', tipo: 'FLEXIVEL', cor: '#10b981', icone: 'plane', ordem: 9 },
  
  // POUPANÇA
  { nome: 'Fundo Emergência', tipo: 'POUPANCA', cor: '#14b8a6', icone: 'shield', ordem: 10 },
  { nome: 'Investimentos', tipo: 'POUPANCA', cor: '#22c55e', icone: 'trending-up', ordem: 11 },
  { nome: 'Metas', tipo: 'POUPANCA', cor: '#84cc16', icone: 'target', ordem: 12 },
  
  // RENDIMENTOS
  { nome: 'Salário', tipo: 'RENDIMENTO', cor: '#10b981', icone: 'briefcase', ordem: 13 },
  { nome: 'Freelance', tipo: 'RENDIMENTO', cor: '#22c55e', icone: 'laptop', ordem: 14 },
  { nome: 'Negócio', tipo: 'RENDIMENTO', cor: '#16a34a', icone: 'store', ordem: 15 },
  { nome: 'Outros Ganhos', tipo: 'RENDIMENTO', cor: '#15803d', icone: 'gift', ordem: 16 }
];

async function main() {
  console.log('🌱 Iniciando seeding das categorias padrão...');

  // Limpar categorias padrão existentes antes de criar novas
  const deleted = await prisma.categoria.deleteMany({
    where: { padrao: true }
  });
  
  console.log(`🗑️  ${deleted.count} categorias padrão antigas removidas`);

  // Criar todas as categorias padrão
  let criadas = 0;
  
  for (const cat of categorias) {
    try {
      await prisma.categoria.create({
        data: {
          nome: cat.nome,
          tipo: cat.tipo,
          cor: cat.cor,
          icone: cat.icone,
          padrao: true,
          ordem: cat.ordem,
          excluido: false,
          ativa: true,
          usuarioId: null // Categorias padrão não pertencem a nenhum usuário
        }
      });
      criadas++;
      console.log(`   ✓ ${cat.nome} (${cat.tipo})`);
    } catch (error) {
      console.error(`   ✗ Erro ao criar ${cat.nome}:`, error.message);
    }
  }

  console.log(`\n✅ ${criadas} de ${categorias.length} categorias padrão criadas com sucesso!`);
  
  // Mostra resumo por tipo
  const resumo = await prisma.categoria.groupBy({
    by: ['tipo'],
    where: { padrao: true },
    _count: true
  });
  
  console.log('\n📊 Resumo por tipo:');
  resumo.forEach(r => {
    console.log(`   ${r.tipo}: ${r._count} categorias`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Erro no seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });