-- AlterTable
ALTER TABLE "Cartao"
ADD COLUMN IF NOT EXISTS "percentualDistribuicaoPoupanca" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Gasto"
ADD COLUMN IF NOT EXISTS "distribuicaoAutomatica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "percentualDistribuicaoPoupanca" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "valorDistribuidoPoupanca" DECIMAL(12,2) NOT NULL DEFAULT 0;
