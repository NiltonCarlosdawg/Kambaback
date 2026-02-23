-- AlterTable
ALTER TABLE "Cartao" ADD COLUMN     "fundoAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFundoEmergencia" BOOLEAN NOT NULL DEFAULT false;
