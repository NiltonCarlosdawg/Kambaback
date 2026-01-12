// scripts/migrate-api-keys.js
require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { encrypt } = require('../src/utils/encryption');

async function migrateApiKeys() {
  const users = await prisma.user.findMany({
    where: { aiApiKey: { not: null } }
  });

  for (const user of users) {
    // Verifica se já está criptografado
    if (user.aiApiKey.includes(':')) {
      console.log(`User ${user.id} - já criptografado`);
      continue;
    }

    // Criptografa
    const encrypted = encrypt(user.aiApiKey);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { aiApiKey: encrypted }
    });

    console.log(`✅ User ${user.id} - API key criptografada`);
  }

  console.log('\n✅ Migração concluída!');
  await prisma.$disconnect();
}

migrateApiKeys().catch(console.error);