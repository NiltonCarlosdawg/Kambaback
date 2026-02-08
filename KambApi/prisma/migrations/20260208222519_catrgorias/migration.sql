/*
  Warnings:

  - The values [FIXA,VARIAVEL,INVESTIMENTO,LAZER,OUTROS] on the enum `TipoCategoria` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TipoCategoria_new" AS ENUM ('ESSENCIAL', 'FLEXIVEL', 'POUPANCA', 'RENDIMENTO');
ALTER TABLE "Categoria" ALTER COLUMN "tipo" TYPE "TipoCategoria_new" USING ("tipo"::text::"TipoCategoria_new");
ALTER TYPE "TipoCategoria" RENAME TO "TipoCategoria_old";
ALTER TYPE "TipoCategoria_new" RENAME TO "TipoCategoria";
DROP TYPE "public"."TipoCategoria_old";
COMMIT;

-- DropIndex
DROP INDEX "Categoria_nome_key";

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "ativa" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Categoria_tipo_idx" ON "Categoria"("tipo");
