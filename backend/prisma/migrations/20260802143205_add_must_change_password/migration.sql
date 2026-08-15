-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatarUrl", "companyId", "createdAt", "deletedAt", "email", "id", "lastLoginAt", "name", "passwordHash", "phone", "roleId", "status", "updatedAt") SELECT "avatarUrl", "companyId", "createdAt", "deletedAt", "email", "id", "lastLoginAt", "name", "passwordHash", "phone", "roleId", "status", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE INDEX "User_companyId_roleId_idx" ON "User"("companyId", "roleId");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
