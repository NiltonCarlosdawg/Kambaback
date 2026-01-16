/*
  Warnings:

  - A unique constraint covering the columns `[usuarioId,nome,tipo]` on the table `Categoria` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Categoria" DROP CONSTRAINT "Categoria_usuarioId_fkey";

-- DropIndex
DROP INDEX "Cartao_usuarioId_numero_key";

-- DropIndex
DROP INDEX "Cartao_usuarioId_tipo_idx";

-- DropIndex
DROP INDEX "Categoria_padrao_ativa_idx";

-- DropIndex
DROP INDEX "Categoria_usuarioId_nome_key";

-- DropIndex
DROP INDEX "Categoria_usuarioId_tipo_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_categoriaId_data_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_data_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_excluido_data_idx";

-- DropIndex
DROP INDEX "Gasto_usuarioId_tipo_data_idx";

-- AlterTable
ALTER TABLE "Categoria" ALTER COLUMN "tipo" DROP DEFAULT,
ALTER COLUMN "cor" DROP NOT NULL,
ALTER COLUMN "cor" DROP DEFAULT,
ALTER COLUMN "icone" DROP NOT NULL,
ALTER COLUMN "icone" DROP DEFAULT,
ALTER COLUMN "ordem" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Gasto" ALTER COLUMN "descricao" DROP NOT NULL,
ALTER COLUMN "descricao" DROP DEFAULT,
ALTER COLUMN "data" DROP DEFAULT;

-- CreateTable
CREATE TABLE "kamba_memoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kamba_memoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kamba_usage" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "modelo" TEXT NOT NULL DEFAULT 'gpt-oss-120b',
    "sucesso" BOOLEAN NOT NULL DEFAULT true,
    "latencia" INTEGER,
    "erro" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kamba_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kamba_lembretes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "agendadoPara" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kamba_lembretes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kamba_feedback" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mensagemId" TEXT,
    "avaliacao" TEXT NOT NULL,
    "comentario" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kamba_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kamba_memoria_usuarioId_timestamp_idx" ON "kamba_memoria"("usuarioId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "kamba_usage_usuarioId_timestamp_idx" ON "kamba_usage"("usuarioId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "kamba_lembretes_usuarioId_enviado_agendadoPara_idx" ON "kamba_lembretes"("usuarioId", "enviado", "agendadoPara");

-- CreateIndex
CREATE INDEX "kamba_feedback_usuarioId_avaliacao_idx" ON "kamba_feedback"("usuarioId", "avaliacao");

-- CreateIndex
CREATE INDEX "kamba_feedback_mensagemId_idx" ON "kamba_feedback"("mensagemId");

-- CreateIndex
CREATE INDEX "Categoria_padrao_ordem_nome_idx" ON "Categoria"("padrao", "ordem", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_usuarioId_nome_tipo_key" ON "Categoria"("usuarioId", "nome", "tipo");

-- CreateIndex
CREATE INDEX "Gasto_usuarioId_excluido_data_idx" ON "Gasto"("usuarioId", "excluido", "data" DESC);

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kamba_memoria" ADD CONSTRAINT "kamba_memoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kamba_usage" ADD CONSTRAINT "kamba_usage_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kamba_lembretes" ADD CONSTRAINT "kamba_lembretes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kamba_feedback" ADD CONSTRAINT "kamba_feedback_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
