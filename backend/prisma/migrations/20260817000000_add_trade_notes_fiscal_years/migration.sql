-- Credit / debit notes (stock + invoice adjustments) and fiscal years.

-- CreateTable
CREATE TABLE "TradeNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "noteType" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "invoiceId" TEXT,
    "partyId" TEXT,
    "warehouseId" TEXT,
    "noteDate" DATETIME NOT NULL,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "reason" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "TradeNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TradeNote_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TradeNote_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeNote_companyId_number_key" ON "TradeNote"("companyId", "number");

-- CreateIndex
CREATE INDEX "TradeNote_companyId_type_status_idx" ON "TradeNote"("companyId", "type", "status");

-- CreateIndex
CREATE INDEX "TradeNote_companyId_noteDate_idx" ON "TradeNote"("companyId", "noteDate");

-- CreateIndex
CREATE INDEX "TradeNote_invoiceId_idx" ON "TradeNote"("invoiceId");

-- CreateIndex
CREATE INDEX "TradeNote_partyId_idx" ON "TradeNote"("partyId");

-- CreateIndex
CREATE INDEX "TradeNote_warehouseId_idx" ON "TradeNote"("warehouseId");

-- CreateTable
CREATE TABLE "TradeNoteLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noteId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "lineTotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "TradeNoteLine_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "TradeNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeNoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TradeNoteLine_noteId_idx" ON "TradeNoteLine"("noteId");

-- CreateIndex
CREATE INDEX "TradeNoteLine_productId_idx" ON "TradeNoteLine"("productId");

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closingJournalId" TEXT,
    "closedAt" DATETIME,
    "closedBy" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "FiscalYear_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_companyId_name_key" ON "FiscalYear"("companyId", "name");

-- CreateIndex
CREATE INDEX "FiscalYear_companyId_status_idx" ON "FiscalYear"("companyId", "status");

-- CreateIndex
CREATE INDEX "FiscalYear_companyId_startDate_endDate_idx" ON "FiscalYear"("companyId", "startDate", "endDate");
