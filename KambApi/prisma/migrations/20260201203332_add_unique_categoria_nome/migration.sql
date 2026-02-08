/*
  Warnings:

  - You are about to drop the column `bloqueado` on the `Cartao` table. All the data in the column will be lost.
  - You are about to drop the column `disponivel` on the `Cartao` table. All the data in the column will be lost.
  - You are about to alter the column `nome` on the `Cartao` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `banco` on the `Cartao` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `numero` on the `Cartao` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `saldoAtual` on the `Cartao` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `limiteCredito` on the `Cartao` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `cor` on the `Cartao` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(7)`.
  - You are about to alter the column `icone` on the `Cartao` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to drop the column `ativa` on the `Categoria` table. All the data in the column will be lost.
  - You are about to alter the column `nome` on the `Categoria` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `cor` on the `Categoria` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(7)`.
  - You are about to alter the column `icone` on the `Categoria` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `tipo` on the `DispositivoPush` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `valor` on the `Gasto` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `descricao` on the `Gasto` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `local` on the `Gasto` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - The `parcelado` column on the `Gasto` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `excluido` on the `KambaMemoria` table. All the data in the column will be lost.
  - You are about to drop the column `mensagem` on the `KambaMemoria` table. All the data in the column will be lost.
  - You are about to drop the column `resposta` on the `KambaMemoria` table. All the data in the column will be lost.
  - You are about to alter the column `titulo` on the `NotificacaoPush` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `tipo` on the `NotificacaoPush` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to drop the column `modoDistribuicao` on the `Objetivo` table. All the data in the column will be lost.
  - You are about to alter the column `titulo` on the `Objetivo` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to alter the column `categoria` on the `Objetivo` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `valorAlvo` on the `Objetivo` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `valorAtual` on the `Objetivo` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - The `prioridade` column on the `Objetivo` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `cor` on the `Objetivo` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(7)`.
  - You are about to alter the column `icone` on the `Objetivo` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `porcentagemDistribuicao` on the `Objetivo` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(5,2)`.
  - You are about to drop the column `atualizadoEm` on the `PreferenciasUsuario` table. All the data in the column will be lost.
  - You are about to alter the column `idioma` on the `PreferenciasUsuario` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `tema` on the `PreferenciasUsuario` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `moedaPadrao` on the `PreferenciasUsuario` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `nome` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `telefone` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `senha` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `morada` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `rendaMensalMedia` on the `User` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - The `perfilDeRisco` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `kamba_feedback` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kamba_lembretes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `kamba_usage` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[nome]` on the table `Categoria` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `atualizadoEm` to the `Cartao` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `tipo` on the `Cartao` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `banco` on table `Cartao` required. This step will fail if there are existing NULL values in that column.
  - Made the column `cor` on table `Cartao` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icone` on table `Cartao` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `tipo` on the `Categoria` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `cor` on table `Categoria` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `atualizadoEm` to the `Gasto` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `tipo` on the `Gasto` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `descricao` on table `Gasto` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contexto` on table `KambaMemoria` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `atualizadoEm` to the `Objetivo` table without a default value. This is not possible if the table is not empty.
  - Made the column `cor` on table `Objetivo` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icone` on table `Objetivo` required. This step will fail if there are existing NULL values in that column.
  - Made the column `porcentagemDistribuicao` on table `Objetivo` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `sexo` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MASCULINO', 'FEMININO', 'OUTRO', 'PREFIRO_NAO_DIZER');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'MODERADOR');

-- CreateEnum
CREATE TYPE "PerfilRisco" AS ENUM ('CONSERVADOR', 'MOD_ERADO', 'ARROJADO');

-- CreateEnum
CREATE TYPE "TipoCartao" AS ENUM ('DEBITO', 'CREDITO', 'POUPANCA');

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('DESPESA', 'RECEITA');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('FIXA', 'VARIAVEL', 'INVESTIMENTO', 'LAZER', 'OUTROS');

-- DropForeignKey
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Gasto" DROP CONSTRAINT "Gasto_cartaoId_fkey";

-- DropForeignKey
ALTER TABLE "kamba_feedback" DROP CONSTRAINT "kamba_feedback_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "kamba_lembretes" DROP CONSTRAINT "kamba_lembretes_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "kamba_usage" DROP CONSTRAINT "kamba_usage_usuarioId_fkey";

-- DropIndex
DROP INDEX "Cartao_usuarioId_ativo_idx";

-- DropIndex
DROP INDEX "Cartao_usuarioId_criadoEm_idx";

-- DropIndex
DROP INDEX "Categoria_usuarioId_padrao_idx";

-- DropIndex
DROP INDEX "Categoria_usuarioId_tipo_ordem_idx";

-- DropIndex
DROP INDEX "DispositivoPush_usuarioId_ativo_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_cartaoId_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_categoriaId_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_data_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_excluido_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_tipo_idx";

-- DropIndex
DROP INDEX "KambaMemoria_usuarioId_criadoEm_idx";

-- DropIndex
DROP INDEX "NotificacaoPush_usuarioId_lida_criadoEm_idx";

-- DropIndex
DROP INDEX "Objetivo_usuarioId_concluido_dataPrevista_idx";

-- DropIndex
DROP INDEX "Objetivo_usuarioId_concluido_idx";

-- DropIndex
DROP INDEX "Objetivo_usuarioId_dataPrevista_idx";

-- DropIndex
DROP INDEX "User_refreshToken_idx";

-- DropIndex
DROP INDEX "User_ultimoLogin_idx";

-- AlterTable
ALTER TABLE "Cartao" DROP COLUMN "bloqueado",
DROP COLUMN "disponivel",
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "diaFechamento" INTEGER,
ADD COLUMN     "diaVencimento" INTEGER,
ADD COLUMN     "distribuirParaObjetivos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "saldoDisponivel" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "saldoReservado" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "nome" SET DATA TYPE VARCHAR(100),
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoCartao" NOT NULL,
ALTER COLUMN "banco" SET NOT NULL,
ALTER COLUMN "banco" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "numero" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "saldoAtual" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "limiteCredito" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "cor" SET NOT NULL,
ALTER COLUMN "cor" SET DEFAULT '#6366f1',
ALTER COLUMN "cor" SET DATA TYPE VARCHAR(7),
ALTER COLUMN "icone" SET NOT NULL,
ALTER COLUMN "icone" SET DEFAULT 'credit-card',
ALTER COLUMN "icone" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Categoria" DROP COLUMN "ativa",
ALTER COLUMN "nome" SET DATA TYPE VARCHAR(100),
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoCategoria" NOT NULL,
ALTER COLUMN "cor" SET NOT NULL,
ALTER COLUMN "cor" SET DEFAULT '#94a3b8',
ALTER COLUMN "cor" SET DATA TYPE VARCHAR(7),
ALTER COLUMN "icone" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "DispositivoPush" ALTER COLUMN "tipo" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "distribuicaoAutomatica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "objetivoId" TEXT,
ADD COLUMN     "parcelaAtual" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalParcelas" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoGasto" NOT NULL,
ALTER COLUMN "valor" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "descricao" SET NOT NULL,
ALTER COLUMN "descricao" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "local" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "data" SET DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "parcelado",
ADD COLUMN     "parcelado" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "KambaMemoria" DROP COLUMN "excluido",
DROP COLUMN "mensagem",
DROP COLUMN "resposta",
ALTER COLUMN "contexto" SET NOT NULL,
ALTER COLUMN "contexto" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "NotificacaoPush" ALTER COLUMN "titulo" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "tipo" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "Objetivo" DROP COLUMN "modoDistribuicao",
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "titulo" SET DATA TYPE VARCHAR(200),
ALTER COLUMN "categoria" SET DEFAULT 'Geral',
ALTER COLUMN "categoria" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "valorAlvo" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "valorAtual" SET DATA TYPE DECIMAL(12,2),
DROP COLUMN "prioridade",
ADD COLUMN     "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
ALTER COLUMN "cor" SET NOT NULL,
ALTER COLUMN "cor" SET DEFAULT '#10b981',
ALTER COLUMN "cor" SET DATA TYPE VARCHAR(7),
ALTER COLUMN "icone" SET NOT NULL,
ALTER COLUMN "icone" SET DEFAULT 'target',
ALTER COLUMN "icone" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "porcentagemDistribuicao" SET NOT NULL,
ALTER COLUMN "porcentagemDistribuicao" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "PreferenciasUsuario" DROP COLUMN "atualizadoEm",
ALTER COLUMN "idioma" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "tema" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "moedaPadrao" SET DEFAULT 'Kz',
ALTER COLUMN "moedaPadrao" SET DATA TYPE VARCHAR(10);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "nome" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "telefone" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "senha" SET DATA TYPE VARCHAR(255),
DROP COLUMN "sexo",
ADD COLUMN     "sexo" "Sexo" NOT NULL,
ALTER COLUMN "morada" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "rendaMensalMedia" SET DATA TYPE DECIMAL(12,2),
DROP COLUMN "perfilDeRisco",
ADD COLUMN     "perfilDeRisco" "PerfilRisco" NOT NULL DEFAULT 'MOD_ERADO',
DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "kamba_feedback";

-- DropTable
DROP TABLE "kamba_lembretes";

-- DropTable
DROP TABLE "kamba_usage";

-- CreateTable
CREATE TABLE "KambaUsage" (
    "id" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KambaUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KambaLembrete" (
    "id" TEXT NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "mensagem" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "KambaLembrete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KambaFeedback" (
    "id" TEXT NOT NULL,
    "avaliacao" INTEGER NOT NULL,
    "comentario" TEXT,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "KambaFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cartao_usuarioId_idx" ON "Cartao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE INDEX "Categoria_usuarioId_idx" ON "Categoria"("usuarioId");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_idx" ON "Gasto"("usuarioId");

-- CreateIndex
CREATE INDEX "Gasto_cartaoId_idx" ON "Gasto"("cartaoId");

-- CreateIndex
CREATE INDEX "Gasto_categoriaId_idx" ON "Gasto"("categoriaId");

-- CreateIndex
CREATE INDEX "Gasto_objetivoId_idx" ON "Gasto"("objetivoId");

-- CreateIndex
CREATE INDEX "Objetivo_usuarioId_idx" ON "Objetivo"("usuarioId");

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "Cartao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_objetivoId_fkey" FOREIGN KEY ("objetivoId") REFERENCES "Objetivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KambaUsage" ADD CONSTRAINT "KambaUsage_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KambaLembrete" ADD CONSTRAINT "KambaLembrete_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KambaFeedback" ADD CONSTRAINT "KambaFeedback_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
