/*
  Warnings:

  - The values [revoked] on the enum `TokenStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TokenStatus_new" AS ENUM ('active', 'expired', 'suspended', 'cancelled');
ALTER TABLE "public"."tokens" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tokens" ALTER COLUMN "status" TYPE "TokenStatus_new" USING ("status"::text::"TokenStatus_new");
ALTER TYPE "TokenStatus" RENAME TO "TokenStatus_old";
ALTER TYPE "TokenStatus_new" RENAME TO "TokenStatus";
DROP TYPE "public"."TokenStatus_old";
ALTER TABLE "tokens" ALTER COLUMN "status" SET DEFAULT 'active';
COMMIT;
