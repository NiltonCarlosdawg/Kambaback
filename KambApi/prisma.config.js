// prisma.config.js
const { defineConfig } = require('@prisma/config');
require('dotenv').config();

module.exports = defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    // No Prisma 7, a URL para migrações deve ser definida aqui via process.env
    url: process.env.DATABASE_URL,
  },
});
