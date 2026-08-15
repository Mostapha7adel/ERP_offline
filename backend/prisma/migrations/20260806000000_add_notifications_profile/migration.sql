-- Profile: job title on users + avatar on roles.
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "Role" ADD COLUMN "avatarUrl" TEXT;

-- In-app notifications feed shared across every device in the workspace.
-- Kind maps to info|success|warning|error; actorName is the display name of
-- whoever triggered the notification (e.g. "who added this customer").
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");
CREATE INDEX "Notification_companyId_read_idx" ON "Notification"("companyId", "read");
