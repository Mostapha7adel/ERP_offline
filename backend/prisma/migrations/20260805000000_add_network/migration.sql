-- LAN workspace: one active workspace per company holding the join code that
-- other devices on the same WiFi use to connect to the host (super admin).
CREATE TABLE "NetworkWorkspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "hostDeviceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "NetworkWorkspace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NetworkWorkspace_joinCode_key" ON "NetworkWorkspace"("joinCode");
CREATE UNIQUE INDEX "NetworkWorkspace_companyId_key" ON "NetworkWorkspace"("companyId");
CREATE INDEX "NetworkWorkspace_companyId_idx" ON "NetworkWorkspace"("companyId");

-- Registered devices: the host plus every client that joined the workspace.
-- `deviceId` is a stable id generated once per app installation, so a device
-- rejoining keeps its identity. `token` authenticates heartbeats.
CREATE TABLE "NetworkDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "token" TEXT,
    "currentUserId" TEXT,
    "currentUserName" TEXT,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "NetworkDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NetworkDevice_token_key" ON "NetworkDevice"("token");
CREATE UNIQUE INDEX "NetworkDevice_companyId_deviceId_key" ON "NetworkDevice"("companyId", "deviceId");
CREATE INDEX "NetworkDevice_companyId_idx" ON "NetworkDevice"("companyId");
