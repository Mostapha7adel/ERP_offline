-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdvanceAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "AdvanceAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdvanceAllocation_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "CustomerAdvance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdvanceAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AdvanceAllocation" ("advanceId", "amount", "appliedAt", "companyId", "createdAt", "createdBy", "deletedAt", "id", "invoiceId") SELECT "advanceId", "amount", "appliedAt", "companyId", "createdAt", "createdBy", "deletedAt", "id", "invoiceId" FROM "AdvanceAllocation";
DROP TABLE "AdvanceAllocation";
ALTER TABLE "new_AdvanceAllocation" RENAME TO "AdvanceAllocation";
CREATE INDEX "AdvanceAllocation_advanceId_idx" ON "AdvanceAllocation"("advanceId");
CREATE INDEX "AdvanceAllocation_invoiceId_idx" ON "AdvanceAllocation"("invoiceId");
CREATE TABLE "new_AssetDepreciationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "accumulated" REAL NOT NULL DEFAULT 0,
    "journalId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "AssetDepreciationRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetDepreciationRun_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AssetDepreciationRun" ("accumulated", "amount", "assetId", "companyId", "createdAt", "createdBy", "deletedAt", "id", "journalId", "period") SELECT "accumulated", "amount", "assetId", "companyId", "createdAt", "createdBy", "deletedAt", "id", "journalId", "period" FROM "AssetDepreciationRun";
DROP TABLE "AssetDepreciationRun";
ALTER TABLE "new_AssetDepreciationRun" RENAME TO "AssetDepreciationRun";
CREATE INDEX "AssetDepreciationRun_companyId_assetId_idx" ON "AssetDepreciationRun"("companyId", "assetId");
CREATE UNIQUE INDEX "AssetDepreciationRun_companyId_assetId_period_key" ON "AssetDepreciationRun"("companyId", "assetId", "period");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

