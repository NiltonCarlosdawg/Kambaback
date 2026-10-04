-- F-003: corrige a deriva entre schema.prisma e o histórico de migrations.
-- Estes objetos existiam apenas no schema e foram criados manualmente nas BDs de dev;
-- esta migration é IDEMPOTENTE para poder aplicar-se tanto a BDs já existentes
-- (onde os objetos já foram criados manualmente) como a BDs novas (migrate deploy).

-- AlterTable
ALTER TABLE "Cartao" ADD COLUMN IF NOT EXISTS "moeda" TEXT NOT NULL DEFAULT 'AOA';

-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN IF NOT EXISTS "moeda" TEXT NOT NULL DEFAULT 'AOA',
ADD COLUMN IF NOT EXISTS "taxaCambio" DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS "valorOriginal" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "appleId" TEXT,
ADD COLUMN IF NOT EXISTS "fontesRenda" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "googleId" TEXT,
ADD COLUMN IF NOT EXISTS "percentualDolar" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "rendaEmDolar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "rendaFixaMensal" DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS "rendaVariavelMedia" DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS "tipoRenda" TEXT DEFAULT 'FIXO',
ADD COLUMN IF NOT EXISTS "tutorialConcluido" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "senha" DROP NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "kixikilas" (
    "id" TEXT NOT NULL,
    "organizadorId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contribuicaoMensal" DECIMAL(15,2) NOT NULL,
    "totalMembros" INTEGER NOT NULL,
    "periodicidade" TEXT NOT NULL DEFAULT 'MENSAL',
    "cicloActual" INTEGER NOT NULL DEFAULT 1,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kixikilas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "kixikila_membros" (
    "id" TEXT NOT NULL,
    "kixikilaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nome" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "jaRecebeu" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kixikila_membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "kixikila_contribuicoes" (
    "id" TEXT NOT NULL,
    "kixikilaId" TEXT NOT NULL,
    "membroId" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "periodo" TIMESTAMP(3) NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kixikila_contribuicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otp" VARCHAR(6) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usadoEm" TIMESTAMP(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "kixikila_membros_kixikilaId_posicao_key" ON "kixikila_membros"("kixikilaId", "posicao");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordResetToken_otp_idx" ON "PasswordResetToken"("otp");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_appleId_key" ON "User"("appleId");

-- AddForeignKey (condicional: BDs antigas já as têm criadas manualmente)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kixikilas_organizadorId_fkey') THEN
        ALTER TABLE "kixikilas" ADD CONSTRAINT "kixikilas_organizadorId_fkey" FOREIGN KEY ("organizadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kixikila_membros_kixikilaId_fkey') THEN
        ALTER TABLE "kixikila_membros" ADD CONSTRAINT "kixikila_membros_kixikilaId_fkey" FOREIGN KEY ("kixikilaId") REFERENCES "kixikilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kixikila_membros_usuarioId_fkey') THEN
        ALTER TABLE "kixikila_membros" ADD CONSTRAINT "kixikila_membros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kixikila_contribuicoes_kixikilaId_fkey') THEN
        ALTER TABLE "kixikila_contribuicoes" ADD CONSTRAINT "kixikila_contribuicoes_kixikilaId_fkey" FOREIGN KEY ("kixikilaId") REFERENCES "kixikilas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kixikila_contribuicoes_membroId_fkey') THEN
        ALTER TABLE "kixikila_contribuicoes" ADD CONSTRAINT "kixikila_contribuicoes_membroId_fkey" FOREIGN KEY ("membroId") REFERENCES "kixikila_membros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey') THEN
        ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
