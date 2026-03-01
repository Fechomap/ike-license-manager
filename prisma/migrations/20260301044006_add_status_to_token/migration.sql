-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('active', 'expired', 'suspended', 'revoked', 'cancelled');

-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "status" "TokenStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "statusReason" TEXT;

-- CreateIndex
CREATE INDEX "tokens_status_idx" ON "tokens"("status");
