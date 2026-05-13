-- AlterTable
ALTER TABLE "KambaFeedback" ADD COLUMN     "mensagemId" TEXT;

-- CreateIndex
CREATE INDEX "KambaFeedback_usuarioId_criadoEm_idx" ON "KambaFeedback"("usuarioId", "criadoEm");
