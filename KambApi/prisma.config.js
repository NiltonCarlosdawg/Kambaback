// prisma.config.js
import { defineConfig } from '@prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    // No Prisma 7, a URL para migrações deve ser definida aqui via process.env
    url: process.env.DATABASE_URL,
  },
});