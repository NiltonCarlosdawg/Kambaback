-- AlterTable
ALTER TABLE "KambaUsage" ADD COLUMN     "confianca" DOUBLE PRECISION,
ADD COLUMN     "feedbackId" TEXT,
ADD COLUMN     "ferramentas" JSONB,
ADD COLUMN     "intencao" VARCHAR(50),
ADD COLUMN     "promptVersao" VARCHAR(20),
ADD COLUMN     "sentimento" VARCHAR(20);

-- CreateTable
CREATE TABLE "KambaPromptTest" (
    "id" TEXT NOT NULL,
    "versao" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "promptContent" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "usuariosAlocados" INTEGER NOT NULL DEFAULT 0,
    "scoreMedio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRespostas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KambaPromptTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KambaPromptTest_ativo_versao_idx" ON "KambaPromptTest"("ativo", "versao");

-- CreateIndex
CREATE INDEX "KambaUsage_intencao_idx" ON "KambaUsage"("intencao");

-- CreateIndex
CREATE INDEX "KambaUsage_promptVersao_idx" ON "KambaUsage"("promptVersao");
