CREATE TABLE "MaintenanceProgress" (
 "id" TEXT PRIMARY KEY,
 "cursor" TEXT,
 "lastRunAt" TIMESTAMP(3),
 "lastCompletedAt" TIMESTAMP(3),
 "lastScanned" INTEGER NOT NULL DEFAULT 0,
 "lastDeleted" INTEGER NOT NULL DEFAULT 0,
 "lastError" TEXT,
 "version" INTEGER NOT NULL DEFAULT 0
);
