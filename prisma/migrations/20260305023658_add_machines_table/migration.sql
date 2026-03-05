-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ip" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenId" TEXT NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "machines_tokenId_idx" ON "machines"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "machines_tokenId_machineId_key" ON "machines"("tokenId", "machineId");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MigrateExistingData: copiar machineId existentes a la tabla machines
INSERT INTO "machines" ("id", "machineId", "deviceInfo", "ip", "addedAt", "tokenId")
SELECT gen_random_uuid(), t."machineId", t."redemptionDeviceInfo",
       t."redemptionIp", COALESCE(t."redemptionTimestamp", t."redeemedAt", NOW()), t."id"
FROM "tokens" t WHERE t."machineId" IS NOT NULL;
