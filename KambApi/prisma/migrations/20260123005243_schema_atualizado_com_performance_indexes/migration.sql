/*
  Warnings:

  - You are about to drop the column `atualizadoEm` on the `Cartao` table. All the data in the column will be lost.
  - You are about to drop the column `reservado` on the `Cartao` table. All the data in the column will be lost.
  - You are about to drop the column `atualizadoEm` on the `Categoria` table. All the data in the column will be lost.
  - You are about to drop the column `criadoEm` on the `Categoria` table. All the data in the column will be lost.
  - You are about to drop the column `atualizadoEm` on the `Gasto` table. All the data in the column will be lost.
  - You are about to drop the column `atualizadoEm` on the `Objetivo` table. All the data in the column will be lost.
  - You are about to drop the column `dataFinal` on the `Objetivo` table. All the data in the column will be lost.
  - You are about to drop the column `dataInicio` on the `Objetivo` table. All the data in the column will be lost.
  - You are about to drop the column `modelo` on the `kamba_usage` table. All the data in the column will be lost.
  - You are about to drop the column `tokens` on the `kamba_usage` table. All the data in the column will be lost.
  - You are about to drop the `kamba_memoria` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usuarios` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `categoriaId` on table `Gasto` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `dataPrevista` to the `Objetivo` table without a default value. This is not possible if the table is not empty.
  - Made the column `categoria` on table `Objetivo` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Cartao" DROP CONSTRAINT "Cartao_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Gasto" DROP CONSTRAINT "Gasto_categoriaId_fkey";

-- DropForeignKey
ALTER TABLE "Gasto" DROP CONSTRAINT "Gasto_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Objetivo" DROP CONSTRAINT "Objetivo_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "kamba_feedback" DROP CONSTRAINT "kamba_feedback_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "kamba_lembretes" DROP CONSTRAINT "kamba_lembretes_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "kamba_memoria" DROP CONSTRAINT "kamba_memoria_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "kamba_usage" DROP CONSTRAINT "kamba_usage_usuarioId_fkey";

-- DropIndex
DROP INDEX "Categoria_padrao_ordem_nome_idx";

-- DropIndex
DROP INDEX "Categoria_usuarioId_nome_tipo_key";

-- DropIndex
DROP INDEX "Gasto_cartaoId_idx";

-- DropIndex
DROP INDEX "Gasto_tags_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_excluido_data_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_tipo_excluido_data_idx";

-- DropIndex
DROP INDEX "Objetivo_usuarioId_concluido_dataFinal_idx";

-- DropIndex
DROP INDEX "Objetivo_usuarioId_modoDistribuicao_concluido_idx";

-- DropIndex
DROP INDEX "Objetivo_usuarioId_prioridade_idx";

-- AlterTable
ALTER TABLE "Cartao" DROP COLUMN "atualizadoEm",
DROP COLUMN "reservado",
ALTER COLUMN "limiteCredito" DROP NOT NULL,
ALTER COLUMN "disponivel" DROP NOT NULL,
ALTER COLUMN "disponivel" DROP DEFAULT,
ALTER COLUMN "cor" DROP NOT NULL,
ALTER COLUMN "cor" DROP DEFAULT,
ALTER COLUMN "icone" DROP NOT NULL,
ALTER COLUMN "icone" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Categoria" DROP COLUMN "atualizadoEm",
DROP COLUMN "criadoEm";

-- AlterTable
ALTER TABLE "Gasto" DROP COLUMN "atualizadoEm",
ALTER COLUMN "categoriaId" SET NOT NULL,
ALTER COLUMN "tags" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Objetivo" DROP COLUMN "atualizadoEm",
DROP COLUMN "dataFinal",
DROP COLUMN "dataInicio",
ADD COLUMN     "dataPrevista" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "descricao" DROP NOT NULL,
ALTER COLUMN "descricao" DROP DEFAULT,
ALTER COLUMN "categoria" SET NOT NULL,
ALTER COLUMN "cor" DROP NOT NULL,
ALTER COLUMN "cor" DROP DEFAULT,
ALTER COLUMN "icone" DROP NOT NULL,
ALTER COLUMN "icone" DROP DEFAULT,
ALTER COLUMN "porcentagemDistribuicao" DROP NOT NULL,
ALTER COLUMN "porcentagemDistribuicao" SET DEFAULT 0,
ALTER COLUMN "porcentagemDistribuicao" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "modoDistribuicao" SET DEFAULT 'automatico';

-- AlterTable
ALTER TABLE "kamba_usage" DROP COLUMN "modelo",
DROP COLUMN "tokens",
ADD COLUMN     "model" TEXT NOT NULL DEFAULT 'gpt-oss-120b';

-- DropTable
DROP TABLE "kamba_memoria";

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
CREATE TABLE "KambaMemoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "contexto" JSONB,
    "mensagem" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KambaMemoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispositivoPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispositivoPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacaoPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "tipo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacaoPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenciasUsuario" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'pt',
    "tema" TEXT NOT NULL DEFAULT 'light',
    "notificacoesAtivas" BOOLEAN NOT NULL DEFAULT true,
    "moedaPadrao" TEXT NOT NULL DEFAULT 'AOA',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenciasUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_telefone_key" ON "User"("telefone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_telefone_idx" ON "User"("telefone");

-- CreateIndex
CREATE INDEX "User_refreshToken_idx" ON "User"("refreshToken");

-- CreateIndex
CREATE INDEX "User_ultimoLogin_idx" ON "User"("ultimoLogin" DESC);

-- CreateIndex
CREATE INDEX "KambaMemoria_usuarioId_criadoEm_idx" ON "KambaMemoria"("usuarioId", "criadoEm" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoPush_token_key" ON "DispositivoPush"("token");

-- CreateIndex
CREATE INDEX "DispositivoPush_usuarioId_ativo_idx" ON "DispositivoPush"("usuarioId", "ativo");

-- CreateIndex
CREATE INDEX "NotificacaoPush_usuarioId_lida_criadoEm_idx" ON "NotificacaoPush"("usuarioId", "lida", "criadoEm" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PreferenciasUsuario_usuarioId_key" ON "PreferenciasUsuario"("usuarioId");

-- CreateIndex
CREATE INDEX "Cartao_usuarioId_criadoEm_idx" ON "Cartao"("usuarioId", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX "Categoria_usuarioId_padrao_idx" ON "Categoria"("usuarioId", "padrao");

-- CreateIndex
CREATE INDEX "Categoria_usuarioId_tipo_ordem_idx" ON "Categoria"("usuarioId", "tipo", "ordem");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_data_idx" ON "Gasto"("usuarioId", "data" DESC);

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_tipo_idx" ON "Gasto"("usuarioId", "tipo");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_categoriaId_idx" ON "Gasto"("usuarioId", "categoriaId");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_cartaoId_idx" ON "Gasto"("usuarioId", "cartaoId");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_excluido_idx" ON "Gasto"("usuarioId", "excluido");

-- CreateIndex
CREATE INDEX "Gasto_data_idx" ON "Gasto"("data");

-- CreateIndex
CREATE INDEX "Objetivo_usuarioId_concluido_idx" ON "Objetivo"("usuarioId", "concluido");

-- CreateIndex
CREATE INDEX "Objetivo_usuarioId_dataPrevista_idx" ON "Objetivo"("usuarioId", "dataPrevista");

-- CreateIndex
CREATE INDEX "Objetivo_usuarioId_concluido_dataPrevista_idx" ON "Objetivo"("usuarioId", "concluido", "dataPrevista");

-- AddForeignKey
ALTER TABLE "Cartao" ADD CONSTRAINT "Cartao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objetivo" ADD CONSTRAINT "Objetivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KambaMemoria" ADD CONSTRAINT "KambaMemoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kamba_usage" ADD CONSTRAINT "kamba_usage_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kamba_lembretes" ADD CONSTRAINT "kamba_lembretes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kamba_feedback" ADD CONSTRAINT "kamba_feedback_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispositivoPush" ADD CONSTRAINT "DispositivoPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacaoPush" ADD CONSTRAINT "NotificacaoPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenciasUsuario" ADD CONSTRAINT "PreferenciasUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
