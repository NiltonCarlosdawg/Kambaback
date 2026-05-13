-- AlterTable
ALTER TABLE "KambaFeedback" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "KambaMemoria" ADD COLUMN     "threadId" TEXT NOT NULL DEFAULT 'default';

-- CreateTable
CREATE TABLE "KambaEmbedding" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contexto" VARCHAR(50) NOT NULL,
    "threadId" TEXT NOT NULL DEFAULT 'default',
    "embedding" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KambaEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KambaThread" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KambaThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KambaPreferencias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "temNegocio" BOOLEAN NOT NULL DEFAULT false,
    "preocupaComDolar" BOOLEAN NOT NULL DEFAULT false,
    "querPoupar" BOOLEAN NOT NULL DEFAULT false,
    "temDividas" BOOLEAN NOT NULL DEFAULT false,
    "estiloResposta" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "temasFrequentes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KambaPreferencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KambaEmbedding_usuarioId_criadoEm_idx" ON "KambaEmbedding"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "KambaEmbedding_usuarioId_threadId_idx" ON "KambaEmbedding"("usuarioId", "threadId");

-- CreateIndex
CREATE INDEX "KambaThread_usuarioId_ativa_idx" ON "KambaThread"("usuarioId", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "KambaPreferencias_usuarioId_key" ON "KambaPreferencias"("usuarioId");

-- CreateIndex
CREATE INDEX "KambaMemoria_usuarioId_threadId_idx" ON "KambaMemoria"("usuarioId", "threadId");

-- AddForeignKey
ALTER TABLE "KambaEmbedding" ADD CONSTRAINT "KambaEmbedding_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KambaThread" ADD CONSTRAINT "KambaThread_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KambaPreferencias" ADD CONSTRAINT "KambaPreferencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
