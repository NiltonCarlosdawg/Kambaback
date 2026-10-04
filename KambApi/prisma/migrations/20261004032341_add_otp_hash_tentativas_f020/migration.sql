-- DropIndex
DROP INDEX "PasswordResetToken_otp_idx";

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "salt" VARCHAR(32) NOT NULL DEFAULT '',
ADD COLUMN     "tentativas" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "otp" SET DATA TYPE VARCHAR(64);
