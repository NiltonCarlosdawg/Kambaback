/*
  Warnings:

  - Added the required column `tipo` to the `KambaLembrete` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `KambaMemoria` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `KambaMemoria` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "KambaLembrete" ADD COLUMN     "enviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo" VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE "KambaMemoria" ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "role" VARCHAR(20) NOT NULL;

-- AlterTable
ALTER TABLE "KambaUsage" ADD COLUMN     "erro" TEXT,
ADD COLUMN     "latencia" INTEGER,
ADD COLUMN     "modelo" VARCHAR(100),
ADD COLUMN     "sucesso" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "KambaLembrete_usuarioId_enviado_dataHora_idx" ON "KambaLembrete"("usuarioId", "enviado", "dataHora");

-- CreateIndex
CREATE INDEX "KambaMemoria_usuarioId_criadoEm_idx" ON "KambaMemoria"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "KambaUsage_usuarioId_criadoEm_idx" ON "KambaUsage"("usuarioId", "criadoEm");
