-- AlterTable
ALTER TABLE "Cartao" ADD COLUMN     "excluido" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "excluido" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "KambaMemoria" ADD COLUMN     "excluido" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Objetivo" ADD COLUMN     "excluido" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "kamba_feedback" ADD COLUMN     "excluido" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "kamba_lembretes" ADD COLUMN     "excluido" BOOLEAN NOT NULL DEFAULT false;
