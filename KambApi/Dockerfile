# KambApi/Dockerfile — F-023 (multi-stage)
#
# ATENÇÃO: o ambiente de desenvolvimento atual não tem Docker, portanto este
# build NÃO foi executado localmente (validado por revisão). O deploy atual
# (Render, via git) não depende deste ficheiro; ele habilita deploys em
# contêiner no futuro e ambientes prod-like locais.
#
#   docker build -t kambapi .
#   docker run -p 3001:3001 \
#     -e DATABASE_URL=... -e JWT_SECRET=... -e REFRESH_SECRET=... kambapi

# ---------- etapa 1: dependências + generate do Prisma ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Schema primeiro: o generate corre antes de copiar o código para que a cache
# da camada de dependências só invalide quando o schema mudar
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# ---------- etapa 2: runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copia o resultado completo da etapa build (inclui node_modules com o cliente
# Prisma gerado — as duas etapas usam a MESMA base alpine/musl, garantindo
# compatibilidade dos engines do Prisma)
COPY --from=build /app ./

EXPOSE 3001
CMD ["node", "server.js"]
