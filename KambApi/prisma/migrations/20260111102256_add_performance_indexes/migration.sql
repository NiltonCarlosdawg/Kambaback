/*
  Warnings:

  - You are about to drop the `contas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `transacoes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usuarios` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "contas" DROP CONSTRAINT "contas_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "transacoes" DROP CONSTRAINT "transacoes_contaId_fkey";

-- DropTable
DROP TABLE "contas";

-- DropTable
DROP TABLE "transacoes";

-- DropTable
DROP TABLE "usuarios";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "senha" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "sexo" TEXT NOT NULL,
    "morada" TEXT NOT NULL,
    "rendaMensalMedia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perfilDeRisco" TEXT NOT NULL DEFAULT 'moderado',
    "role" TEXT NOT NULL DEFAULT 'user',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" TEXT,
    "senhaAlteradaEm" TIMESTAMP(3),
    "ultimoLogin" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cartao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "banco" TEXT,
    "numero" TEXT,
    "saldoAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limiteCredito" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disponivel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cor" TEXT NOT NULL DEFAULT '#1e40af',
    "icone" TEXT NOT NULL DEFAULT 'credit_card',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cartao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'despesa',
    "cor" TEXT NOT NULL DEFAULT '#6B7280',
    "icone" TEXT NOT NULL DEFAULT 'category',
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 999,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cartaoId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "tipo" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "local" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parcelado" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excluido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objetivo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT,
    "valorAlvo" DOUBLE PRECISION NOT NULL,
    "valorAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataFinal" TIMESTAMP(3) NOT NULL,
    "prioridade" TEXT NOT NULL DEFAULT 'media',
    "cor" TEXT NOT NULL DEFAULT '#10b981',
    "icone" TEXT NOT NULL DEFAULT 'target',
    "porcentagemDistribuicao" INTEGER NOT NULL DEFAULT 0,
    "modoDistribuicao" TEXT NOT NULL DEFAULT 'manual',
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objetivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telefone_key" ON "User"("telefone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_ativo_bloqueado_idx" ON "User"("ativo", "bloqueado");

-- CreateIndex
CREATE INDEX "Cartao_usuarioId_ativo_idx" ON "Cartao"("usuarioId", "ativo");

-- CreateIndex
CREATE INDEX "Cartao_usuarioId_tipo_idx" ON "Cartao"("usuarioId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Cartao_usuarioId_numero_key" ON "Cartao"("usuarioId", "numero");

-- CreateIndex
CREATE INDEX "Categoria_padrao_ativa_idx" ON "Categoria"("padrao", "ativa");

-- CreateIndex
CREATE INDEX "Categoria_usuarioId_tipo_idx" ON "Categoria"("usuarioId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_usuarioId_nome_key" ON "Categoria"("usuarioId", "nome");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_data_idx" ON "Gasto"("usuarioId", "data" DESC);

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_tipo_data_idx" ON "Gasto"("usuarioId", "tipo", "data");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_categoriaId_data_idx" ON "Gasto"("usuarioId", "categoriaId", "data");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_excluido_data_idx" ON "Gasto"("usuarioId", "excluido", "data");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_tipo_excluido_data_idx" ON "Gasto"("usuarioId", "tipo", "excluido", "data");

-- CreateIndex
CREATE INDEX "Gasto_cartaoId_idx" ON "Gasto"("cartaoId");

-- CreateIndex
CREATE INDEX "Gasto_tags_idx" ON "Gasto"("tags");

-- CreateIndex
CREATE INDEX "Objetivo_usuarioId_concluido_dataFinal_idx" ON "Objetivo"("usuarioId", "concluido", "dataFinal");

-- CreateIndex
CREATE INDEX "Objetivo_usuarioId_modoDistribuicao_concluido_idx" ON "Objetivo"("usuarioId", "modoDistribuicao", "concluido");

-- CreateIndex
CREATE INDEX "Objetivo_usuarioId_prioridade_idx" ON "Objetivo"("usuarioId", "prioridade");

-- AddForeignKey
ALTER TABLE "Cartao" ADD CONSTRAINT "Cartao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "Cartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objetivo" ADD CONSTRAINT "Objetivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
